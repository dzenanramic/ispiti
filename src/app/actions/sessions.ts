"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  answers,
  attempts,
  classes,
  questions,
  quizzes,
  sessions,
  students,
} from "@/db/schema";
import { generateCode, generateToken } from "@/lib/codes";
import { scoreAnswers } from "@/lib/grading";
import { requireUser } from "@/lib/guard";

function parseDuration(value: FormDataEntryValue | null): number {
  const duration = Number(value);
  if (!Number.isInteger(duration)) return 300;
  return Math.min(900, Math.max(120, duration));
}

async function loadOwnedSession(sessionId: string) {
  const user = await requireUser();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) redirect("/teacher");
  if (user.role !== "admin" && session.teacherId !== user.id) redirect("/teacher");
  return { user, session };
}

export async function createSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const classId = String(formData.get("classId") ?? "");
  const quizId = String(formData.get("quizId") ?? "");
  const durationSeconds = parseDuration(formData.get("duration"));

  const [cls] = await db
    .select({ id: classes.id, teacherId: classes.teacherId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  const [quiz] = await db
    .select({ id: quizzes.id, teacherId: quizzes.teacherId })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!cls || !quiz) redirect(`/teacher/classes/${classId}`);
  if (user.role !== "admin" && cls.teacherId !== user.id) {
    redirect("/teacher/classes");
  }
  if (user.role !== "admin" && quiz.teacherId !== user.id) {
    redirect(`/teacher/classes/${classId}`);
  }

  let code = generateCode();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [existing] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);
    if (!existing) break;
    code = generateCode();
  }

  const [created] = await db
    .insert(sessions)
    .values({
      quizId: quiz.id,
      classId: cls.id,
      teacherId: user.id,
      code,
      durationSeconds,
      status: "lobby",
    })
    .returning();

  revalidatePath(`/teacher/classes/${classId}`);
  redirect(`/teacher/sessions/${created.id}`);
}

export async function startSessionAction(sessionId: string): Promise<void> {
  const { session } = await loadOwnedSession(sessionId);
  if (session.status !== "lobby") return;

  const now = new Date();
  await db
    .update(sessions)
    .set({
      status: "active",
      startedAt: now,
      endsAt: new Date(now.getTime() + session.durationSeconds * 1000),
    })
    .where(eq(sessions.id, sessionId));

  revalidatePath(`/teacher/sessions/${sessionId}`);
}

export async function closeSessionAction(sessionId: string): Promise<void> {
  const { session } = await loadOwnedSession(sessionId);
  if (session.status === "closed") return;

  // Kratak grace period: odgovor koji je u letu (učenik je upravo tapnuo)
  // stigne prije nego što zaključamo sesiju. Bez ovoga se gubi zadnji odgovor.
  await new Promise((resolve) => setTimeout(resolve, 700));

  const quizQuestions = await db
    .select({ id: questions.id, type: questions.type, correct: questions.correct, points: questions.points })
    .from(questions)
    .where(eq(questions.quizId, session.quizId));

  const sessionAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.sessionId, sessionId));

  for (const attempt of sessionAttempts) {
    if (attempt.status === "submitted") continue;
    const answerRows = await db
      .select({ questionId: answers.questionId, value: answers.value })
      .from(answers)
      .where(eq(answers.attemptId, attempt.id));
    const score = scoreAnswers(quizQuestions, answerRows);
    await db
      .update(attempts)
      .set({ status: "submitted", score, submittedAt: new Date() })
      .where(eq(attempts.id, attempt.id));
  }

  await db
    .update(sessions)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  revalidatePath(`/teacher/sessions/${sessionId}`);
  revalidatePath(`/teacher/sessions/${sessionId}/results`);
}

export async function extendSessionAction(
  sessionId: string,
  seconds: number,
): Promise<void> {
  const { session } = await loadOwnedSession(sessionId);
  if (session.status !== "active" || !session.endsAt) return;

  const nextEndsAt = new Date(session.endsAt.getTime() + seconds * 1000);
  await db
    .update(sessions)
    .set({ endsAt: nextEndsAt })
    .where(eq(sessions.id, sessionId));

  revalidatePath(`/teacher/sessions/${sessionId}`);
}

export async function setJoinLockAction(
  sessionId: string,
  locked: boolean,
): Promise<void> {
  const { session } = await loadOwnedSession(sessionId);
  if (session.status === "closed") return;

  await db
    .update(sessions)
    .set({ joinLocked: locked })
    .where(eq(sessions.id, sessionId));

  revalidatePath(`/teacher/sessions/${sessionId}`);
}

export async function setManualScoreAction(
  sessionId: string,
  studentId: string,
  score: number,
): Promise<void> {
  const { session } = await loadOwnedSession(sessionId);

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        eq(students.classId, session.classId),
        eq(students.active, true),
      ),
    )
    .limit(1);

  if (!student) return;

  const quizQuestions = await db
    .select({ points: questions.points })
    .from(questions)
    .where(eq(questions.quizId, session.quizId));
  const max = quizQuestions.reduce((total, question) => total + question.points, 0);
  const value = Math.max(0, Math.min(Math.round(score), max));

  if (!Number.isFinite(value)) return;

  const [existing] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(eq(attempts.sessionId, sessionId), eq(attempts.studentId, studentId)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(attempts)
      .set({ status: "submitted", score: value, submittedAt: new Date() })
      .where(eq(attempts.id, existing.id));
  } else {
    await db.insert(attempts).values({
      sessionId,
      studentId,
      deviceToken: `manual-${generateToken()}`,
      token: generateToken(),
      status: "submitted",
      score: value,
      submittedAt: new Date(),
    });
  }

  revalidatePath(`/teacher/sessions/${sessionId}`);
  revalidatePath(`/teacher/sessions/${sessionId}/results`);
}

export async function resetAttemptAction(attemptId: string): Promise<void> {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: attempts.id,
      sessionId: attempts.sessionId,
      teacherId: sessions.teacherId,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!row) return;
  if (user.role !== "admin" && row.teacherId !== user.id) return;

  await db.delete(attempts).where(eq(attempts.id, attemptId));
  revalidatePath(`/teacher/sessions/${row.sessionId}`);
  revalidatePath(`/teacher/sessions/${row.sessionId}/results`);
}

export async function removeSessionAction(sessionId: string): Promise<void> {
  const { session } = await loadOwnedSession(sessionId);
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  revalidatePath(`/teacher/classes/${session.classId}`);
  redirect(`/teacher/classes/${session.classId}`);
}

export async function findActiveSessionForClass(
  classId: string,
): Promise<{ id: string; code: string } | null> {
  const user = await requireUser();
  const [row] = await db
    .select({ id: sessions.id, code: sessions.code, teacherId: sessions.teacherId })
    .from(sessions)
    .where(and(eq(sessions.classId, classId), eq(sessions.status, "active")))
    .limit(1);

  if (!row) return null;
  if (user.role !== "admin" && row.teacherId !== user.id) return null;
  return { id: row.id, code: row.code };
}

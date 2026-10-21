import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
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
import { finalizeAttempt, jsonError } from "@/lib/attempts";

async function loadAttempt(token: string) {
  const [row] = await db
    .select({
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      sessionId: sessions.id,
      sessionStatus: sessions.status,
      endsAt: sessions.endsAt,
      durationSeconds: sessions.durationSeconds,
      quizId: quizzes.id,
      quizTitle: quizzes.title,
      studentName: students.name,
      className: classes.name,
      code: sessions.code,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .innerJoin(students, eq(attempts.studentId, students.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(eq(attempts.token, token))
    .limit(1);

  return row ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const attempt = await loadAttempt(token);
  if (!attempt) return jsonError("Test nije pronađen.", 404);

  const meta = {
    quizTitle: attempt.quizTitle,
    studentName: attempt.studentName,
    className: attempt.className,
    code: attempt.code,
  };

  if (attempt.attemptStatus === "submitted") {
    return Response.json({ status: "submitted", ...meta });
  }

  if (attempt.sessionStatus === "closed") {
    await finalizeAttempt(attempt.attemptId, attempt.quizId);
    return Response.json({ status: "submitted", ...meta });
  }

  if (attempt.sessionStatus === "lobby") {
    return Response.json({ status: "lobby", ...meta });
  }

  if (attempt.endsAt && attempt.endsAt.getTime() + 5000 < Date.now()) {
    await finalizeAttempt(attempt.attemptId, attempt.quizId);
    return Response.json({ status: "submitted", reason: "time", ...meta });
  }

  const questionRows = await db
    .select({
      id: questions.id,
      type: questions.type,
      prompt: questions.prompt,
      options: questions.options,
      position: questions.position,
    })
    .from(questions)
    .where(eq(questions.quizId, attempt.quizId))
    .orderBy(questions.position);

  const savedRows = await db
    .select({ questionId: answers.questionId, value: answers.value })
    .from(answers)
    .where(eq(answers.attemptId, attempt.attemptId));

  return Response.json({
    status: "active",
    ...meta,
    endsAt: attempt.endsAt,
    serverNow: Date.now(),
    durationSeconds: attempt.durationSeconds,
    questions: questionRows,
    saved: savedRows,
  });
}

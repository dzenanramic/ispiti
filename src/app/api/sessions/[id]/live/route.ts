import { and, eq, inArray } from "drizzle-orm";
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
import { jsonError } from "@/lib/attempts";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return jsonError("Nisi prijavljen.", 401);

  const { id } = await params;

  const [session] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      joinLocked: sessions.joinLocked,
      endsAt: sessions.endsAt,
      durationSeconds: sessions.durationSeconds,
      code: sessions.code,
      teacherId: sessions.teacherId,
      classId: sessions.classId,
      quizId: sessions.quizId,
      quizTitle: quizzes.title,
      className: classes.name,
    })
    .from(sessions)
    .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!session) return jsonError("Test nije pronađen.", 404);
  if (user.role !== "admin" && session.teacherId !== user.id) {
    return jsonError("Nemaš pristup ovom testu.", 403);
  }

  const questionRows = await db
    .select({ id: questions.id, points: questions.points })
    .from(questions)
    .where(eq(questions.quizId, session.quizId));

  const maxPoints = questionRows.reduce((total, question) => total + question.points, 0);

  const studentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(and(eq(students.classId, session.classId), eq(students.active, true)))
    .orderBy(students.name);

  const attemptRows = await db
    .select({
      id: attempts.id,
      studentId: attempts.studentId,
      status: attempts.status,
      score: attempts.score,
      joinedAt: attempts.joinedAt,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(eq(attempts.sessionId, session.id));

  const attemptIds = attemptRows.map((attempt) => attempt.id);
  const answerRows =
    attemptIds.length > 0
      ? await db
          .select({
            attemptId: answers.attemptId,
            questionId: answers.questionId,
            isCorrect: answers.isCorrect,
          })
          .from(answers)
          .where(inArray(answers.attemptId, attemptIds))
      : [];

  return Response.json({
    session: {
      id: session.id,
      status: session.status,
      endsAt: session.endsAt,
      durationSeconds: session.durationSeconds,
      code: session.code,
      joinLocked: session.joinLocked,
      quizTitle: session.quizTitle,
      className: session.className,
      serverNow: Date.now(),
      maxPoints,
      totalStudents: studentRows.length,
    },
    students: studentRows.map((student) => {
      const attempt = attemptRows.find((row) => row.studentId === student.id);
      if (!attempt) {
        return { id: student.id, name: student.name, attempt: null };
      }
      const attemptAnswers = answerRows.filter(
        (answer) => answer.attemptId === attempt.id,
      );
      const liveScore =
        attempt.status === "submitted"
          ? attempt.score
          : attemptAnswers.filter((answer) => answer.isCorrect).length;

      return {
        id: student.id,
        name: student.name,
        attempt: {
          id: attempt.id,
          status: attempt.status,
          score: liveScore,
          answered: attemptAnswers.length,
          joinedAt: attempt.joinedAt,
          submittedAt: attempt.submittedAt,
        },
      };
    }),
  });
}

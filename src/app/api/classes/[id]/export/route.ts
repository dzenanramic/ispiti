import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import {
  attempts,
  classes,
  grades,
  questions,
  quizzes,
  sessions,
  students,
} from "@/db/schema";
import { jsonError } from "@/lib/attempts";
import { getSession } from "@/lib/auth";
import { csvCell } from "@/lib/csv";
import { TERMS, formatDate } from "@/lib/format";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return jsonError("Nisi prijavljen.", 401);

  const { id } = await params;

  const [cls] = await db
    .select({
      id: classes.id,
      name: classes.name,
      teacherId: classes.teacherId,
    })
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);

  if (!cls) return jsonError("Odjeljenje nije pronađeno.", 404);
  if (user.role !== "admin" && cls.teacherId !== user.id) {
    return jsonError("Nemaš pristup ovom odjeljenju.", 403);
  }

  const studentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(and(eq(students.classId, cls.id), eq(students.active, true)))
    .orderBy(students.name);

  const sessionRows = await db
    .select({
      id: sessions.id,
      quizId: sessions.quizId,
      quizTitle: quizzes.title,
      date: sessions.startedAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .where(and(eq(sessions.classId, cls.id), eq(sessions.status, "closed")))
    .orderBy(sessions.createdAt);

  const quizIds = [...new Set(sessionRows.map((session) => session.quizId))];
  const questionRows =
    quizIds.length > 0
      ? await db
          .select({ quizId: questions.quizId, points: questions.points })
          .from(questions)
          .where(inArray(questions.quizId, quizIds))
      : [];

  const maxByQuiz = new Map<string, number>();
  for (const question of questionRows) {
    maxByQuiz.set(
      question.quizId,
      (maxByQuiz.get(question.quizId) ?? 0) + question.points,
    );
  }

  const sessionIds = sessionRows.map((session) => session.id);
  const attemptRows =
    sessionIds.length > 0
      ? await db
          .select({
            sessionId: attempts.sessionId,
            studentId: attempts.studentId,
            status: attempts.status,
            score: attempts.score,
          })
          .from(attempts)
          .where(inArray(attempts.sessionId, sessionIds))
      : [];

  const gradeRows = await db
    .select()
    .from(grades)
    .where(eq(grades.classId, cls.id));

  const totalMax = sessionRows.reduce(
    (total, session) => total + (maxByQuiz.get(session.quizId) ?? 0),
    0,
  );

  const header = [
    "Učenik",
    ...sessionRows.map(
      (session) =>
        `${session.quizTitle} (${formatDate(session.date ?? session.createdAt)})`,
    ),
    "Ukupno",
    "Maksimum",
    "Procenat",
    "Ocjene",
  ];

  const lines = [header.map(csvCell).join(";")];

  for (const student of studentRows) {
    const sessionCells = sessionRows.map((session) => {
      const attempt = attemptRows.find(
        (row) => row.sessionId === session.id && row.studentId === student.id,
      );
      if (!attempt) return "—";
      const max = maxByQuiz.get(session.quizId) ?? 0;
      return `${attempt.score}/${max}`;
    });

    const totalScore = attemptRows
      .filter((attempt) => attempt.studentId === student.id)
      .reduce((total, attempt) => total + attempt.score, 0);

    const studentGrades = gradeRows.filter((grade) => grade.studentId === student.id);
    const gradesText = TERMS.map((term) => {
      const values = studentGrades
        .filter((grade) => grade.term === term)
        .map((grade) => grade.value);
      return values.length > 0 ? `${term}: ${values.join(", ")}` : null;
    })
      .filter(Boolean)
      .join("; ");

    const percent =
      totalMax > 0 ? `${Math.round((totalScore / totalMax) * 100)}%` : "—";

    lines.push(
      [
        student.name,
        ...sessionCells,
        totalScore,
        totalMax,
        percent,
        gradesText,
      ]
        .map(csvCell)
        .join(";"),
    );
  }

  const csv = `\uFEFF${lines.join("\r\n")}`;
  const fileName = `ocjene-${cls.name.replace(/[^a-zA-Z0-9]+/g, "-")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

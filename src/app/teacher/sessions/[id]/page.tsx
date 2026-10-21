import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, ClipboardList } from "lucide-react";
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
import { SessionConsole } from "@/components/SessionConsole";
import { PageHeader } from "@/components/ui";
import { getBaseUrl } from "@/lib/base-url";
import { pointWord, studentWord } from "@/lib/format";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Test" };

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [session] = await db
    .select({
      id: sessions.id,
      code: sessions.code,
      status: sessions.status,
      joinLocked: sessions.joinLocked,
      endsAt: sessions.endsAt,
      durationSeconds: sessions.durationSeconds,
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

  if (!session) notFound();
  if (user.role !== "admin" && session.teacherId !== user.id) {
    redirect("/teacher");
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
          .select({ attemptId: answers.attemptId, questionId: answers.questionId })
          .from(answers)
          .where(inArray(answers.attemptId, attemptIds))
      : [];

  const joinUrl = `${await getBaseUrl()}/j/${session.code}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    margin: 1,
    width: 360,
    color: { dark: "#0c4534", light: "#ffffff" },
  });

  const initial = {
    session: {
      id: session.id,
      status: session.status,
      joinLocked: session.joinLocked,
      endsAt: session.endsAt ? session.endsAt.toISOString() : null,
      durationSeconds: session.durationSeconds,
      code: session.code,
      quizTitle: session.quizTitle,
      className: session.className,
      // eslint-disable-next-line react-hooks/purity -- server component: trenutak renderovanja je "sada"
      serverNow: Date.now(),
      maxPoints,
      totalStudents: studentRows.length,
    },
    students: studentRows.map((student) => {
      const attempt = attemptRows.find((row) => row.studentId === student.id);
      if (!attempt) return { id: student.id, name: student.name, attempt: null };
      return {
        id: student.id,
        name: student.name,
        attempt: {
          id: attempt.id,
          status: attempt.status,
          score: attempt.score,
          answered: answerRows.filter((row) => row.attemptId === attempt.id).length,
          joinedAt: attempt.joinedAt.toISOString(),
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
        },
      };
    }),
  };

  return (
    <>
      <Link
        href={`/teacher/classes/${session.classId}`}
        data-nav-link="true"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {session.className}
      </Link>

      <PageHeader
        meta={`${session.className} · ${session.durationSeconds / 60} min`}
        title={session.quizTitle}
        description={`Kod ${session.code} · ${maxPoints} ${pointWord(maxPoints)} · ${studentRows.length} ${studentWord(studentRows.length)} na spisku`}
        actions={
          <Link
            href={`/teacher/sessions/${session.id}/results`}
            data-nav-link="true"
            className="btn btn-secondary"
          >
            <ClipboardList className="h-4 w-4" />
            Rezultati
          </Link>
        }
      />

      <SessionConsole
        sessionId={session.id}
        joinUrl={joinUrl}
        qrDataUrl={qrDataUrl}
        initial={initial}
      />
    </>
  );
}

import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, Percent, Target, Trophy, Users } from "lucide-react";
import { db } from "@/db";
import {
  attempts,
  classes,
  questions,
  quizzes,
  sessions,
  students,
  teachers,
} from "@/db/schema";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatDate, percent, pointWord, studentWord, testWord } from "@/lib/format";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "Uspjeh" };

function successTone(pct: number): string {
  if (pct >= 80) return "bg-emerald-600";
  if (pct >= 60) return "bg-brand";
  if (pct >= 40) return "bg-amber-500";
  return "bg-danger";
}

function successTextTone(pct: number): string {
  if (pct >= 60) return "text-brand-dark";
  if (pct >= 40) return "text-amber-700";
  return "text-danger";
}

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [cls] = await db
    .select({
      id: classes.id,
      name: classes.name,
      schoolYear: classes.schoolYear,
      teacherId: classes.teacherId,
      teacherName: teachers.name,
    })
    .from(classes)
    .innerJoin(teachers, eq(classes.teacherId, teachers.id))
    .where(eq(classes.id, id))
    .limit(1);

  if (!cls) notFound();
  if (user.role !== "admin" && cls.teacherId !== user.id) {
    redirect("/teacher/classes");
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
      status: sessions.status,
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

  // Test koji nije imao nijedan pokušaj ne ulazi u tabelu — inače greškom
  // otvoren i zatvoren test podiže maksimum svima.
  const gradedSessions = sessionRows.filter((session) =>
    attemptRows.some((attempt) => attempt.sessionId === session.id),
  );

  const totalMax = gradedSessions.reduce(
    (total, session) => total + (maxByQuiz.get(session.quizId) ?? 0),
    0,
  );

  const rows = studentRows.map((student) => {
    let totalScore = 0;
    let graded = 0;

    const cells = gradedSessions.map((session) => {
      const attempt = attemptRows.find(
        (row) => row.sessionId === session.id && row.studentId === student.id,
      );
      const max = maxByQuiz.get(session.quizId) ?? 0;

      if (!attempt) return { session, attempt: null, max };

      totalScore += attempt.score;
      if (attempt.status === "submitted") graded += 1;
      return { session, attempt, max };
    });

    const pct = graded > 0 ? percent(totalScore, totalMax) : null;
    return { student, cells, totalScore, graded, pct };
  });

  const withResults = rows.filter((row) => row.graded > 0);
  const classAverage =
    withResults.length > 0
      ? Math.round(
          withResults.reduce((total, row) => total + (row.pct ?? 0), 0) /
            withResults.length,
        )
      : null;
  const best =
    withResults.length > 0
      ? withResults.reduce((top, row) => ((row.pct ?? 0) > (top.pct ?? 0) ? row : top))
      : null;

  return (
    <>
      <PageHeader
        eyebrow={cls.schoolYear}
        title={cls.name}
        description="Uspjeh učenika po završenim testovima — bodovi se sabiraju, bez ocjena."
        actions={
          <a href={`/api/classes/${cls.id}/export`} className="btn btn-secondary">
            <Download className="h-4 w-4" />
            Izvezi CSV
          </a>
        }
      />

      <div className="mb-6 flex gap-1 border-b border-line text-sm">
        <Link
          href={`/teacher/classes/${cls.id}`}
          className="px-3 py-2 text-muted transition-colors hover:text-ink"
        >
          Učenici i testovi
        </Link>
        <span className="border-b-2 border-brand px-3 py-2 font-semibold text-brand">
          Uspjeh
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Testova
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {gradedSessions.length}
            <span className="text-xs font-normal text-muted">
              {" "}
              · {totalMax} {pointWord(totalMax)}
            </span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Učenika
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {studentRows.length}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            sa rezultatom {withResults.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Prosjek odjeljenja
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {classAverage === null ? "—" : `${classAverage}%`}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Najbolji rezultat
          </p>
          <p className="mt-1 truncate text-sm font-semibold">
            {best ? best.student.name : "—"}
          </p>
          {best ? (
            <p className="mt-0.5 text-xs text-muted">
              {best.totalScore}/{totalMax} · {best.pct}%
            </p>
          ) : null}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Uspjeh po testovima</h2>
            <p className="text-xs text-muted">
              {gradedSessions.length} {testWord(gradedSessions.length)} ·{" "}
              {studentRows.length} {studentWord(studentRows.length)}
            </p>
          </div>
          <Target className="h-4 w-4 text-muted" />
        </div>

        {studentRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="Nema učenika na spisku"
              description="Dodaj učenike na stranici odjeljenja, pa se vrati ovdje."
            />
          </div>
        ) : gradedSessions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Trophy}
              title="Još nema završenih testova"
              description="Kada učenici riješe bar jedan test, ovdje se pojavi njihov uspjeh."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="sticky left-0 z-10 bg-paper/95 px-4 py-2.5 font-bold">
                    Učenik
                  </th>
                  {gradedSessions.map((session) => (
                    <th key={session.id} className="px-3 py-2.5 text-center font-bold">
                      <span className="block max-w-[8rem] truncate normal-case tracking-normal text-ink">
                        {session.quizTitle}
                      </span>
                      <span className="block font-medium normal-case tracking-normal text-muted">
                        {formatDate(session.date ?? session.createdAt)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold">Ukupno</th>
                  <th className="px-3 py-2.5 font-bold">Uspjeh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, cells, totalScore, pct }) => (
                  <tr key={student.id} className="border-b border-line last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium">
                      <span className="block max-w-[13rem] truncate">
                        {student.name}
                      </span>
                    </td>

                    {cells.map(({ session, attempt, max }) => {
                      if (!attempt) {
                        return (
                          <td
                            key={session.id}
                            className="px-3 py-3 text-center text-muted"
                            title="Nije pristupio"
                          >
                            —
                          </td>
                        );
                      }

                      if (attempt.status !== "submitted") {
                        return (
                          <td
                            key={session.id}
                            className="px-3 py-3 text-center text-xs text-muted"
                          >
                            u toku
                          </td>
                        );
                      }

                      const cellPct = percent(attempt.score, max);
                      return (
                        <td key={session.id} className="px-3 py-3 text-center">
                          <span className={`font-semibold ${successTextTone(cellPct)}`}>
                            {attempt.score}
                          </span>
                          <span className="text-xs text-muted">/{max}</span>
                        </td>
                      );
                    })}

                    <td className="px-3 py-3 text-center font-semibold tabular-nums">
                      {totalScore}
                      <span className="text-xs font-normal text-muted">
                        /{totalMax}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      {pct === null ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                            <div
                              className={`h-full rounded-full ${successTone(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-xs font-semibold tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Odsutni učenici imaju „—“ u koloni testa i ne ulaze u prosjek. Ocjene se ne
        unose ovdje — aplikacija samo sabira bodove, a ocjenu daješ ti.
      </p>
    </>
  );
}

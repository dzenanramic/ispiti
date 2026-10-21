import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardList, Download, Plus, Users, X } from "lucide-react";
import { db } from "@/db";
import {
  attempts,
  classes,
  grades,
  questions,
  quizzes,
  sessions,
  students,
  teachers,
} from "@/db/schema";
import { addGradeAction, deleteGradeAction } from "@/app/actions/classes";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/ui";
import { TERMS, formatDate, percent, pointWord, testWord } from "@/lib/format";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "Ocjene" };

export default async function GradesPage({
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

  const gradeRows = await db
    .select()
    .from(grades)
    .where(eq(grades.classId, cls.id))
    .orderBy(desc(grades.createdAt));

  const totalMax = sessionRows.reduce(
    (total, session) => total + (maxByQuiz.get(session.quizId) ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={cls.schoolYear}
        title={`Ocjene · ${cls.name}`}
        description="Bodovi iz završenih testova na jednom mjestu. Ti upisuješ ocjenu — aplikacija samo sabira."
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
          Ocjene
        </span>
      </div>

      <form
        action={addGradeAction}
        className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_5.5rem_1fr_auto] lg:items-end"
      >
        <input type="hidden" name="classId" value={cls.id} />
        <div>
          <label htmlFor="studentId" className="label">
            Učenik
          </label>
          <select id="studentId" name="studentId" required className="select">
            {studentRows.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="term" className="label">
            Polugodište
          </label>
          <select id="term" name="term" className="select" defaultValue={TERMS[0]}>
            {TERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="value" className="label">
            Ocjena
          </label>
          <select id="value" name="value" className="select" defaultValue="4">
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="note" className="label">
            Napomena
          </label>
          <input
            id="note"
            name="note"
            className="input"
            placeholder="npr. usmeno ispitivanje"
            maxLength={200}
          />
        </div>
        <SubmitButton pendingLabel="Upisujem…">
          <Plus className="h-4 w-4" />
          Upiši ocjenu
        </SubmitButton>
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Tabela bodova i ocjena</h2>
            <p className="text-xs text-muted">
              {sessionRows.length} {testWord(sessionRows.length)} · maksimum {totalMax}{" "}
              {pointWord(totalMax)}
            </p>
          </div>
          <ClipboardList className="h-4 w-4 text-muted" />
        </div>

        {studentRows.length === 0 ? (
          <div className="p-6 text-sm text-muted">
            Nema učenika na spisku. Dodaj ih na stranici odjeljenja.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="sticky left-0 z-10 bg-paper/95 px-4 py-2.5 font-bold">
                    Učenik
                  </th>
                  {sessionRows.map((session) => (
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
                  <th className="px-3 py-2.5 text-center font-bold">%</th>
                  <th className="px-4 py-2.5 font-bold">Ocjene</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((student) => {
                  let totalScore = 0;
                  let submittedCount = 0;
                  const studentGrades = gradeRows.filter(
                    (grade) => grade.studentId === student.id,
                  );

                  return (
                    <tr key={student.id} className="border-b border-line last:border-0">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium">
                        <span className="block max-w-[13rem] truncate">{student.name}</span>
                      </td>
                      {sessionRows.map((session) => {
                        const attempt = attemptRows.find(
                          (row) =>
                            row.sessionId === session.id && row.studentId === student.id,
                        );
                        const max = maxByQuiz.get(session.quizId) ?? 0;

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

                        if (attempt.status === "submitted") {
                          totalScore += attempt.score;
                          submittedCount += 1;
                          const pct = percent(attempt.score, max);
                          return (
                            <td key={session.id} className="px-3 py-3 text-center">
                              <span
                                className={
                                  pct >= 60
                                    ? "font-semibold text-brand-dark"
                                    : "font-semibold text-danger"
                                }
                              >
                                {attempt.score}
                              </span>
                              <span className="text-xs text-muted">/{max}</span>
                            </td>
                          );
                        }

                        totalScore += attempt.score;
                        return (
                          <td
                            key={session.id}
                            className="px-3 py-3 text-center text-xs text-muted"
                          >
                            u toku
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center font-semibold tabular-nums">
                        {totalScore}
                        <span className="text-xs font-normal text-muted">
                          /{totalMax}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-muted">
                        {submittedCount > 0 ? `${percent(totalScore, totalMax)}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {TERMS.map((term) => {
                            const termGrades = studentGrades.filter(
                              (grade) => grade.term === term,
                            );
                            if (termGrades.length === 0) return null;
                            return (
                              <span
                                key={term}
                                className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[11px]"
                                title={term}
                              >
                                <span className="text-muted">
                                  {term.startsWith("1") ? "I" : "II"}:
                                </span>
                                {termGrades.map((grade) => (
                                  <span key={grade.id} className="inline-flex items-center">
                                    <span className="font-bold text-ink">{grade.value}</span>
                                    <ConfirmSubmit
                                      action={deleteGradeAction.bind(null, grade.id)}
                                      message={`Obrisati ocjenu ${grade.value}?`}
                                      className="ml-0.5 rounded p-0.5 text-muted hover:text-danger"
                                      title="Obriši ocjenu"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </ConfirmSubmit>
                                  </span>
                                ))}
                              </span>
                            );
                          })}
                          {studentGrades.length === 0 ? (
                            <span className="text-xs text-muted">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
        <Users className="h-3.5 w-3.5" />
        Odsutni učenici nemaju unos u koloni testa. Aplikacija ne predlaže završnu
        ocjenu — upisuješ je sam.
      </p>
    </>
  );
}

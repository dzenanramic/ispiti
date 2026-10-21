import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Download, X } from "lucide-react";
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
import { PrintButton } from "@/components/PrintButton";
import { Banner, PageHeader, StatRow } from "@/components/ui";
import { formatDateTime, percent, pointWord } from "@/lib/format";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rezultati" };

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function answerLabel(
  question: { type: string; options: string[] },
  value: unknown,
): string {
  if (value === null || value === undefined) return "—";
  if (question.type === "tf") return value === true ? "T" : "N";
  const index = Number(value);
  return LETTERS[index] ?? "?";
}

function answerTitle(
  question: { type: string; options: string[] },
  value: unknown,
): string {
  if (value === null || value === undefined) return "Bez odgovora";
  if (question.type === "tf") return value === true ? "Tačno" : "Netačno";
  const index = Number(value);
  return question.options[index] ?? "";
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [session] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      teacherId: sessions.teacherId,
      classId: sessions.classId,
      quizId: sessions.quizId,
      quizTitle: quizzes.title,
      className: classes.name,
      startedAt: sessions.startedAt,
      createdAt: sessions.createdAt,
      closedAt: sessions.closedAt,
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
    .select({
      id: questions.id,
      position: questions.position,
      type: questions.type,
      prompt: questions.prompt,
      options: questions.options,
      correct: questions.correct,
      points: questions.points,
    })
    .from(questions)
    .where(eq(questions.quizId, session.quizId))
    .orderBy(questions.position);

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
            value: answers.value,
            isCorrect: answers.isCorrect,
          })
          .from(answers)
          .where(inArray(answers.attemptId, attemptIds))
      : [];

  const maxPoints = questionRows.reduce((total, question) => total + question.points, 0);
  const submitted = attemptRows.filter((attempt) => attempt.status === "submitted");
  const average =
    submitted.length > 0
      ? submitted.reduce((total, attempt) => total + attempt.score, 0) / submitted.length
      : 0;

  return (
    <>
      <Link
        href={`/teacher/sessions/${session.id}`}
        data-nav-link="true"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink no-print"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Nazad na test
      </Link>

      <PageHeader
        meta={`${session.className} · ${formatDateTime(session.startedAt ?? session.createdAt)}`}
        title={`Rezultati · ${session.quizTitle}`}
        description={`${submitted.length} od ${studentRows.length} učenika je predalo · maksimum ${maxPoints} ${pointWord(maxPoints)}`}
        actions={
          <>
            <PrintButton />
            <a
              href={`/api/classes/${session.classId}/export`}
              className="btn btn-secondary no-print"
            >
              <Download className="h-4 w-4" />
              CSV
            </a>
            <Link
              href={`/teacher/classes/${session.classId}/grades`}
              data-nav-link="true"
              className="btn btn-primary no-print"
            >
              Uspjeh
            </Link>
          </>
        }
      />

      {session.status !== "closed" ? (
        <div className="mb-5 no-print">
          <Banner tone="warning">
            Test još nije završen. Rezultati se mogu mijenjati dok učenici predaju.
          </Banner>
        </div>
      ) : null}

      <StatRow
        items={[
          { label: "Predalo", value: `${submitted.length}/${studentRows.length}` },
          { label: "Prosjek", value: `${average.toFixed(1)}/${maxPoints}` },
          { label: "Prosjek %", value: `${percent(average, maxPoints)}%` },
        ]}
      />

      <div className="sheet overflow-hidden">
        <div className="border-b border-rule px-5 py-4">
          <h2 className="section-title">Matrica odgovora</h2>
          <p className="text-xs text-muted">
            Zeleno = tačno, crveno = netačno. Pređi mišem preko slova za pun
            odgovor.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper/60 text-[10px] uppercase tracking-wide text-muted">
                <th className="sticky left-0 z-10 bg-paper/95 px-4 py-2.5 text-left font-bold">
                  Učenik
                </th>
                {questionRows.map((question, index) => (
                  <th
                    key={question.id}
                    className="px-2 py-2.5 text-center font-bold"
                    title={question.prompt}
                  >
                    P{index + 1}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center font-bold">Bodovi</th>
                <th className="px-3 py-2.5 text-center font-bold">%</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((student) => {
                const attempt = attemptRows.find(
                  (row) => row.studentId === student.id,
                );
                const studentAnswers = attempt
                  ? answerRows.filter((row) => row.attemptId === attempt.id)
                  : [];

                return (
                  <tr key={student.id} className="border-b border-rule last:border-0">
                    <td className="sticky left-0 z-10 bg-lift px-4 py-2.5 font-medium">
                      <span className="block max-w-[13rem] truncate">
                        {student.name}
                      </span>
                      {!attempt ? (
                        <span className="text-[10px] font-normal text-muted">nije pristupio</span>
                      ) : attempt.status !== "submitted" ? (
                        <span className="text-[10px] font-normal text-ink-soft">u toku</span>
                      ) : studentAnswers.length === 0 && attempt.score > 0 ? (
                        <span className="text-[10px] font-normal text-muted">ručno upisano</span>
                      ) : null}
                    </td>

                    {questionRows.map((question) => {
                      const answer = studentAnswers.find(
                        (row) => row.questionId === question.id,
                      );

                      if (!answer) {
                        return (
                          <td
                            key={question.id}
                            className="px-2 py-2.5 text-center text-xs text-muted"
                          >
                            —
                          </td>
                        );
                      }

                      return (
                        <td key={question.id} className="px-1.5 py-2 text-center">
                          <span
                            className={
                              answer.isCorrect
                                ? "inline-flex h-7 min-w-7 items-center justify-center rounded-xs bg-forest-wash px-1.5 text-xs font-bold text-forest-deep"
                                : "inline-flex h-7 min-w-7 items-center justify-center rounded-xs bg-pencil-wash px-1.5 text-xs font-bold text-pencil"
                            }
                            title={`${answerTitle(question, answer.value)}${
                              answer.isCorrect ? " · tačno" : " · netačno"
                            }`}
                          >
                            {answerLabel(question, answer.value)}
                          </span>
                        </td>
                      );
                    })}

                    <td className="px-3 py-2.5 text-center font-semibold tabular-nums">
                      {attempt ? (
                        <>
                          {attempt.score}
                          <span className="text-xs font-normal text-muted">
                            /{maxPoints}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted">
                      {attempt ? `${percent(attempt.score, maxPoints)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-rule bg-paper/70 text-xs">
                <td className="sticky left-0 z-10 bg-paper px-4 py-2.5 font-bold">
                  Tačan odgovor
                </td>
                {questionRows.map((question) => (
                  <td key={question.id} className="px-1.5 py-2.5 text-center">
                    <span
                      className="inline-flex items-center gap-0.5 font-bold text-forest-deep"
                      title={answerTitle(question, question.correct)}
                    >
                      {question.type === "tf" ? null : (
                        <Check className="h-3 w-3" />
                      )}
                      {answerLabel(question, question.correct)}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center font-bold text-muted">
                  {maxPoints}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <section className="sheet mt-5 overflow-hidden">
        <div className="border-b border-rule px-5 py-4">
          <h2 className="section-title">Uspješnost po pitanju</h2>
          <p className="text-xs text-muted">
            Korisno za osvrt na početku sljedećeg časa.
          </p>
        </div>
        <ul className="divide-y divide-rule-soft">
          {questionRows.map((question, index) => {
            const questionAnswers = answerRows.filter(
              (answer) => answer.questionId === question.id,
            );
            const correctCount = questionAnswers.filter(
              (answer) => answer.isCorrect,
            ).length;
            const pct =
              questionAnswers.length > 0
                ? Math.round((correctCount / questionAnswers.length) * 100)
                : 0;

            return (
              <li key={question.id} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-xs bg-paper text-[10px] font-bold text-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-2 text-sm"
                      dir="auto"
                      title={question.prompt}
                    >
                      {question.prompt}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-px flex-1 bg-rule">
                        <div
                          className={pct >= 60 ? "h-px bg-forest" : "h-px bg-pencil"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-data text-xs text-muted">
                        {correctCount}/{questionAnswers.length} · {pct}%
                      </span>
                    </div>
                  </div>
                  {question.type === "tf" ? (
                    <span className="badge border-rule bg-paper text-muted">
                      T/N
                    </span>
                  ) : question.type === "cloze" ? (
                    <span className="badge border-rule bg-paper text-muted">
                      dopuna
                    </span>
                  ) : (
                    <span className="badge border-rule bg-paper text-muted">
                      odgovor
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted no-print">
        {submitted.length === 0 ? (
          <>
            <X className="h-3.5 w-3.5" />
            Još niko nije predao test.
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" />
            Rezultati su odmah dostupni u pregledu uspjeha odjeljenja.
          </>
        )}
      </p>
    </>
  );
}

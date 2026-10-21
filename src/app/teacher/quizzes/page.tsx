import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { BookOpen, Copy, Pencil, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/db";
import { classes, questions, quizzes, sessions } from "@/db/schema";
import { archiveQuizAction, duplicateQuizAction, restoreQuizAction } from "@/app/actions/quizzes";
import { startQuizSessionAction } from "@/app/actions/sessions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDate, questionWord } from "@/lib/format";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "Kvizovi" };

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? error : null;

  const quizRows = await db
    .select({
      id: quizzes.id,
      teacherId: quizzes.teacherId,
      classId: quizzes.classId,
      title: quizzes.title,
      lesson: quizzes.lesson,
      archived: quizzes.archived,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
      className: classes.name,
    })
    .from(quizzes)
    .leftJoin(classes, eq(quizzes.classId, classes.id))
    .where(
      user.role === "admin"
        ? undefined
        : eq(quizzes.teacherId, user.id),
    )
    .orderBy(desc(quizzes.updatedAt));

  const quizIds = quizRows.map((quiz) => quiz.id);

  const questionRows =
    quizIds.length > 0
      ? await db
          .select({ quizId: questions.quizId })
          .from(questions)
          .where(inArray(questions.quizId, quizIds))
      : [];

  const sessionRows =
    quizIds.length > 0
      ? await db
          .select({ quizId: sessions.quizId })
          .from(sessions)
          .where(inArray(sessions.quizId, quizIds))
      : [];

  const activeQuizzes = quizRows.filter((quiz) => !quiz.archived);
  const archivedQuizzes = quizRows.filter((quiz) => quiz.archived);

  function countFor(quizId: string, rows: { quizId: string }[]): number {
    return rows.filter((row) => row.quizId === quizId).length;
  }

  return (
    <>
      <PageHeader
        meta="Priprema"
        title="Kvizovi"
        description="Kviz pripada jednom razredu. Test je jedna sesija tog kviza — otvara se kodom ili QR-om."
        actions={
          <Link href="/teacher/quizzes/new" data-nav-link="true" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Novi kviz
          </Link>
        }
      />

      {errorMessage ? (
        <div className="mb-5 border-l-2 border-pencil bg-pencil-wash px-4 py-2 font-sans text-sm text-pencil">
          {errorMessage}
        </div>
      ) : null}

      {activeQuizzes.length === 0 ? (
        <EmptyState
          title="Još nema kvizova"
          description="Napravi prvi kviz — pet pitanja je dovoljno za pet minuta."
        >
          <Link href="/teacher/quizzes/new" data-nav-link="true" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Napravi kviz
          </Link>
        </EmptyState>
      ) : (
        <div className="sheet overflow-hidden">
          <ul className="divide-y divide-rule-soft">
            {activeQuizzes.map((quiz) => {
              const questionCount = countFor(quiz.id, questionRows);
              const sessionCount = countFor(quiz.id, sessionRows);
              const used = sessionCount > 0;

              return (
                <li
                  key={quiz.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-forest-wash text-forest">
                    <BookOpen className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{quiz.title}</h2>
                      {used ? (
                        <span className="badge border-rule bg-paper text-muted">
                          korišten {sessionCount}×
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {quiz.className ?? "Neraspoređen razred"} ·{" "}
                      {quiz.lesson || "bez naziva lekcije"} · {questionCount}{" "}
                      {questionWord(questionCount)} ·{" "}
                      {formatDate(quiz.updatedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {quiz.classId ? (
                      <form action={startQuizSessionAction}>
                        <input type="hidden" name="quizId" value={quiz.id} />
                        <input type="hidden" name="classId" value={quiz.classId} />
                        <input type="hidden" name="duration" value="300" />
                        <input
                          type="hidden"
                          name="fallback"
                          value="/teacher/quizzes"
                        />
                        <button
                          type="submit"
                          className="btn btn-primary !py-1.5 text-xs"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Pokreni
                        </button>
                      </form>
                    ) : null}

                    {used ? (
                      <form action={duplicateQuizAction.bind(null, quiz.id)}>
                        <button type="submit" className="btn btn-secondary !py-1.5 text-xs">
                          <Copy className="h-3.5 w-3.5" />
                          Duplikuj
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/teacher/quizzes/${quiz.id}`}
                        data-nav-link="true"
                        className="btn btn-secondary !py-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {quiz.classId ? "Uredi" : "Dodijeli razred"}
                      </Link>
                    )}

                    <ConfirmSubmit
                      action={archiveQuizAction.bind(null, quiz.id)}
                      message={`Arhivirati kviz „${quiz.title}"? Neće se više prikazivati pri otvaranju testa.`}
                      className="btn btn-ghost !min-h-8 !p-1.5 text-muted hover:text-pencil"
                      title="Arhiviraj kviz"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ConfirmSubmit>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {archivedQuizzes.length > 0 ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-xs font-semibold text-muted">
            Arhivirani kvizovi ({archivedQuizzes.length})
          </summary>
          <div className="sheet mt-2 overflow-hidden">
            <ul className="divide-y divide-rule-soft">
              {archivedQuizzes.map((quiz) => (
                <li
                  key={quiz.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-muted">{quiz.title}</span>
                  </span>
                  <form action={restoreQuizAction.bind(null, quiz.id)}>
                    <button
                      type="submit"
                      className="btn btn-ghost !py-1 text-xs text-forest"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Vrati
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </>
  );
}

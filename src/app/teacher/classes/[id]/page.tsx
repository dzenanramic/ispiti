import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Plus,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { attempts, classes, quizzes, sessions, students, teachers } from "@/db/schema";
import { addStudentsAction, deactivateStudentAction, activateStudentAction } from "@/app/actions/classes";
import { createSessionAction } from "@/app/actions/sessions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { SubmitButton } from "@/components/SubmitButton";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime, studentWord, testWord } from "@/lib/format";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "Odjeljenje" };

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? error : null;

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
    .select({ id: students.id, name: students.name, active: students.active })
    .from(students)
    .where(eq(students.classId, cls.id))
    .orderBy(students.name);

  const activeStudents = studentRows.filter((student) => student.active);
  const inactiveStudents = studentRows.filter((student) => !student.active);

  const quizRows = await db
    .select({ id: quizzes.id, title: quizzes.title, lesson: quizzes.lesson })
    .from(quizzes)
    .where(
      user.role === "admin"
        ? and(eq(quizzes.archived, false), eq(quizzes.classId, cls.id))
        : and(
            eq(quizzes.teacherId, user.id),
            eq(quizzes.archived, false),
            eq(quizzes.classId, cls.id),
          ),
    )
    .orderBy(desc(quizzes.updatedAt));

  const sessionRows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      code: sessions.code,
      createdAt: sessions.createdAt,
      startedAt: sessions.startedAt,
      quizTitle: quizzes.title,
      quizId: quizzes.id,
    })
    .from(sessions)
    .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .where(eq(sessions.classId, cls.id))
    .orderBy(desc(sessions.createdAt));

  const sessionIds = sessionRows.map((session) => session.id);
  const attemptRows =
    sessionIds.length > 0
      ? await db
          .select({
            sessionId: attempts.sessionId,
            status: attempts.status,
            score: attempts.score,
          })
          .from(attempts)
          .where(inArray(attempts.sessionId, sessionIds))
      : [];

  const openSession = sessionRows.find(
    (session) => session.status === "lobby" || session.status === "active",
  );

  return (
    <>
      <PageHeader
        meta={cls.schoolYear}
        title={cls.name}
        description={
          user.role === "admin"
            ? `Nastavnik: ${cls.teacherName}`
            : `${activeStudents.length} ${studentWord(activeStudents.length)} na spisku · ${sessionRows.length} ${testWord(sessionRows.length)}`
        }
        actions={
          <>
            <Link
              href={`/teacher/classes/${cls.id}/grades`}
              data-nav-link="true"
              className="btn btn-secondary"
            >
              <Trophy className="h-4 w-4" />
              Uspjeh
            </Link>
            <Link
              href={`/teacher/quizzes/new?classId=${cls.id}`}
              data-nav-link="true"
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              Novi kviz
            </Link>
          </>
        }
      />

      {errorMessage ? (
        <div className="mb-5 border-l-2 border-pencil bg-pencil-wash px-4 py-2 font-sans text-sm text-pencil">
          {errorMessage}
        </div>
      ) : null}

      <div className="mb-6 flex gap-1 border-b border-rule text-sm">
        <span className="border-b-2 border-forest px-3 py-2 font-semibold text-forest">
          Učenici i testovi
        </span>
        <Link
          href={`/teacher/classes/${cls.id}/grades`}
          data-nav-link="true"
          className="px-3 py-2 text-muted transition-colors hover:text-ink"
        >
          Uspjeh
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="sheet overflow-hidden">
          <div className="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <h2 className="section-title">Spisak učenika</h2>
              <p className="text-xs text-muted">
                {activeStudents.length} aktivnih
                {inactiveStudents.length > 0
                  ? ` · ${inactiveStudents.length} neaktivnih`
                  : ""}
              </p>
            </div>
            <Users className="h-4 w-4 text-muted" />
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {activeStudents.length === 0 ? (
              <div className="p-5 text-sm text-muted">
                Spisak je prazan. Zalijepi imena ispod.
              </div>
            ) : (
              <ul className="divide-y divide-rule-soft">
                {activeStudents.map((student, index) => (
                  <li
                    key={student.id}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="w-5 text-right text-xs tabular-nums text-muted">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate">{student.name}</span>
                    <ConfirmSubmit
                      action={deactivateStudentAction.bind(null, student.id)}
                      message={`Deaktivirati ${student.name}? Historija testova ostaje sačuvana.`}
                      className="btn btn-ghost !min-h-8 !p-1.5 text-muted hover:text-pencil"
                      title="Deaktiviraj učenika"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </ConfirmSubmit>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            action={addStudentsAction.bind(null, cls.id)}
            className="border-t border-rule bg-paper/50 p-4"
          >
            <label htmlFor="names" className="label">
              Dodaj učenike
            </label>
            <textarea
              id="names"
              name="names"
              rows={4}
              className="textarea text-sm"
              placeholder={"Amina Begić\nTarik Čengić\nLejla Dedić"}
            />
            <p className="mt-1.5 text-[0.72rem] text-muted">
              Jedno ime po liniji. Duplikati se preskaču.
            </p>
            <div className="mt-3 flex justify-end">
              <SubmitButton pendingLabel="Dodajem…">
                <UserPlus className="h-4 w-4" />
                Dodaj na spisak
              </SubmitButton>
            </div>
          </form>

          {inactiveStudents.length > 0 ? (
            <details className="border-t border-rule px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted">
                Neaktivni učenici ({inactiveStudents.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {inactiveStudents.map((student) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between gap-2 text-xs text-muted"
                  >
                    <span className="truncate">{student.name}</span>
                    <form action={activateStudentAction.bind(null, student.id)}>
                      <button type="submit" className="font-semibold text-forest hover:underline">
                        Vrati
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="sheet overflow-hidden">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="section-title">Testovi ovog odjeljenja</h2>
            <p className="text-xs text-muted">
              Pet minuta po testu · bodovi se sabiraju u pregledu uspjeha.
            </p>
          </div>

          {openSession ? (
            <div className="border-b border-rule bg-forest-wash/60 p-4">
              <p className="text-[0.95rem] leading-snug">
                Test je već otvoren: {openSession.quizTitle}
              </p>
              <p className="mt-0.5 font-sans text-xs text-ink-soft">
                {openSession.status === "active"
                  ? "Tajmer je u toku."
                  : "Učenici mogu ulaziti sa kodom."}{" "}
                Kod{" "}
                <span className="font-data font-semibold text-ink">
                  {openSession.code}
                </span>
              </p>
              <Link
                href={`/teacher/sessions/${openSession.id}`}
                data-nav-link="true"
                className="btn btn-primary mt-3"
              >
                <ArrowRight className="h-4 w-4" />
                Nastavi test
              </Link>
            </div>
          ) : quizRows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nema spremnih kvizova"
                description="Napravi kviz za ovaj razred, pa se vrati ovdje da pokreneš test."
              >
                <Link
                  href={`/teacher/quizzes/new?classId=${cls.id}`}
                  data-nav-link="true"
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4" />
                  Napravi kviz
                </Link>
              </EmptyState>
            </div>
          ) : (
            <form
              action={createSessionAction}
              className="border-b border-rule bg-paper/50 p-4"
            >
              <input type="hidden" name="classId" value={cls.id} />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
                <div>
                  <label htmlFor="quizId" className="label">
                    Kviz
                  </label>
                  <select id="quizId" name="quizId" required className="select">
                    {quizRows.map((quiz) => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="duration" className="label">
                    Trajanje
                  </label>
                  <select
                    id="duration"
                    name="duration"
                    className="select"
                    defaultValue="300"
                  >
                    <option value="180">3 min</option>
                    <option value="300">5 min</option>
                    <option value="360">6 min</option>
                    <option value="600">10 min</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[0.72rem] text-muted">
                  Sesija se otvara odmah, a tajmer kreće kad pritisneš „Počni“.
                </p>
                <SubmitButton pendingLabel="Otvaram…">
                  <CalendarClock className="h-4 w-4" />
                  Otvori sesiju
                </SubmitButton>
              </div>
            </form>
          )}

          {sessionRows.length === 0 ? (
            <div className="p-5 text-sm text-muted">Još nema održanih testova.</div>
          ) : (
            <ul className="divide-y divide-rule-soft">
              {sessionRows.map((session) => {
                const sessionAttempts = attemptRows.filter(
                  (attempt) => attempt.sessionId === session.id,
                );
                const submitted = sessionAttempts.filter(
                  (attempt) => attempt.status === "submitted",
                );
                const average =
                  submitted.length > 0
                    ? submitted.reduce((total, attempt) => total + attempt.score, 0) /
                      submitted.length
                    : null;

                return (
                  <li key={session.id}>
                    <Link
                      href={`/teacher/sessions/${session.id}`}
                      data-nav-link="true"
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {session.quizTitle}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {formatDateTime(session.startedAt ?? session.createdAt)} ·{" "}
                          {sessionAttempts.length}/{activeStudents.length} pristupilo ·{" "}
                          {submitted.length} predalo
                        </span>
                      </span>
                      <span className="hidden text-right sm:block">
                        <span className="block text-sm font-semibold tabular-nums">
                          {average === null ? "—" : average.toFixed(1)}
                        </span>
                        <span className="block font-sans text-[0.7rem] text-muted">
                          prosjek
                        </span>
                      </span>
                      <StatusBadge status={session.status} />
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

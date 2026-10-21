import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { classes, quizzes, sessions, students, teachers } from "@/db/schema";
import { PageHeader, StatRow, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { formatDateTime, currentSchoolYear } from "@/lib/format";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Sarajevo",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 10) return "Dobro jutro";
  if (hour < 17) return "Dobar dan";
  return "Dobro veče";
}

export const metadata = { title: "Početna" };

export default async function TeacherHomePage() {
  const user = await requireUser();

  const classRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      schoolYear: classes.schoolYear,
      teacherName: teachers.name,
    })
    .from(classes)
    .innerJoin(teachers, eq(classes.teacherId, teachers.id))
    .where(user.role === "admin" ? undefined : eq(classes.teacherId, user.id))
    .orderBy(classes.name);

  const classIds = classRows.map((cls) => cls.id);

  const studentRows =
    classIds.length > 0
      ? await db
          .select({ classId: students.classId })
          .from(students)
          .where(and(inArray(students.classId, classIds), eq(students.active, true)))
      : [];

  const quizRows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(
      user.role === "admin"
        ? eq(quizzes.archived, false)
        : and(eq(quizzes.teacherId, user.id), eq(quizzes.archived, false)),
    );

  const recentSessions =
    classIds.length > 0
      ? await db
          .select({
            id: sessions.id,
            code: sessions.code,
            status: sessions.status,
            createdAt: sessions.createdAt,
            quizTitle: quizzes.title,
            className: classes.name,
          })
          .from(sessions)
          .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
          .innerJoin(classes, eq(sessions.classId, classes.id))
          .where(inArray(sessions.classId, classIds))
          .orderBy(desc(sessions.createdAt))
          .limit(6)
      : [];

  const [openSession] =
    classIds.length > 0
      ? await db
          .select({
            id: sessions.id,
            code: sessions.code,
            status: sessions.status,
            quizTitle: quizzes.title,
            className: classes.name,
          })
          .from(sessions)
          .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
          .innerJoin(classes, eq(sessions.classId, classes.id))
          .where(
            and(
              inArray(sessions.classId, classIds),
              or(eq(sessions.status, "lobby"), eq(sessions.status, "active")),
            ),
          )
          .orderBy(desc(sessions.createdAt))
          .limit(1)
      : [];

  const sessionCount =
    classIds.length > 0
      ? (
          await db
            .select({ id: sessions.id })
            .from(sessions)
            .where(inArray(sessions.classId, classIds))
        ).length
      : 0;

  const firstName =
    user.name.replace(/^(prof\.?|dr\.?|mr\.?|ms\.?)\s+/i, "").split(" ")[0] ?? user.name;

  return (
    <>
      <PageHeader
        meta={`Školska godina ${currentSchoolYear()}`}
        title={`${greeting()}, ${firstName}.`}
        actions={
          <>
            <Link href="/teacher/quizzes/new" className="btn btn-primary">
              Novi kviz
            </Link>
            <Link href="/teacher/classes" className="btn btn-secondary">
              Odjeljenja
            </Link>
          </>
        }
      />

      <StatRow
        items={[
          {
            label: "Odjeljenja",
            value: classRows.length,
            hint: user.role === "admin" ? "u cijeloj školi" : "u tvojoj nastavi",
          },
          { label: "Učenici", value: studentRows.length, hint: "na aktivnim spiskovima" },
          { label: "Kvizovi", value: quizRows.length, hint: "spremni za čas" },
          { label: "Testovi", value: sessionCount, hint: "od početka godine" },
        ]}
      />

      {openSession ? (
        <Link
          href={`/teacher/sessions/${openSession.id}`}
          className="group mt-6 flex flex-col gap-1 border-l-2 border-forest py-2 pl-4 transition-colors hover:bg-forest-wash/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-lg leading-snug">
              {openSession.status === "active"
                ? "Test je u toku"
                : "Test otvoren, čeka početak"}
            </p>
            <p className="font-sans text-sm text-ink-soft">
              {openSession.quizTitle} · {openSession.className} · kod{" "}
              <span className="font-data font-semibold text-ink">
                {openSession.code}
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1 font-sans text-sm text-forest">
            Otvori test
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section>
          <h2 className="section-title border-b border-rule pb-2">Zadnji testovi</h2>

          {recentSessions.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Još nema testova"
                description="Napravi kviz sa pet pitanja, otvori test u odjeljenju i podijeli kod."
              >
                <Link href="/teacher/quizzes/new" className="btn btn-primary">
                  Napravi kviz
                </Link>
              </EmptyState>
            </div>
          ) : (
            <ul>
              {recentSessions.map((session) => (
                <li key={session.id} className="border-b border-rule-soft">
                  <Link
                    href={`/teacher/sessions/${session.id}`}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-2.5 transition-colors hover:text-forest-deep"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[1.0625rem]">
                        {session.quizTitle}
                      </span>
                      <span className="block truncate font-sans text-xs text-muted">
                        {session.className} · {formatDateTime(session.createdAt)}
                      </span>
                    </span>
                    <span
                      className={
                        session.status === "active"
                          ? "font-sans text-xs text-forest"
                          : "font-sans text-xs text-muted"
                      }
                    >
                      {session.status === "active"
                        ? "u toku"
                        : session.status === "lobby"
                          ? "čeka početak"
                          : "završen"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-10">
          <section>
            <h2 className="section-title border-b border-rule pb-2">Odjeljenja</h2>
            {classRows.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-muted">
                Dodaj prvo odjeljenje na stranici Odjeljenja.
              </p>
            ) : (
              <ul>
                {classRows.map((cls) => (
                  <li key={cls.id} className="border-b border-rule-soft">
                    <Link
                      href={`/teacher/classes/${cls.id}`}
                      className="flex items-baseline justify-between gap-3 py-2.5 transition-colors hover:text-forest-deep"
                    >
                      <span className="truncate">{cls.name}</span>
                      <span className="font-sans text-xs text-muted">
                        {
                          studentRows.filter((student) => student.classId === cls.id)
                            .length
                        }{" "}
                        učenika
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="section-title border-b border-rule pb-2">Kako ide test</h2>
            <ol className="mt-3 space-y-3 font-sans text-sm leading-relaxed text-ink-soft">
              {[
                "Pripremi kviz — formom ili lijepljenjem teksta.",
                "Otvori test u odjeljenju i pokaži kod na projektoru.",
                "Pritisni Počni kad su svi ušli; tajmer ide pet minuta.",
              ].map((step, index) => (
                <li key={step} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span className="font-data text-muted">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

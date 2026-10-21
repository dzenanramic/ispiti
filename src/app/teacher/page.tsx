import { and, desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  GraduationCap,
  Plus,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { classes, quizzes, sessions, students, teachers } from "@/db/schema";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { formatDateTime, currentSchoolYear, studentWord } from "@/lib/format";

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
        eyebrow={`Školska godina ${currentSchoolYear()}`}
        title={`${greeting()}, ${firstName}.`}
        description="Pregled odjeljenja, kvizova i zadnjih testova. Test za čas pripremaš za nekoliko minuta."
        actions={
          <>
            <Link href="/teacher/quizzes/new" data-nav-link="true" className="btn btn-primary">
              <Plus className="h-4 w-4" />
              Novi kviz
            </Link>
            <Link href="/teacher/classes" data-nav-link="true" className="btn btn-secondary">
              Odjeljenja
            </Link>
          </>
        }
      />

      {openSession ? (
        <Link
          href={`/teacher/sessions/${openSession.id}`}
          data-nav-link="true"
          className="mb-6 flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-brand-soft px-4 py-3.5 text-brand-dark transition-colors hover:bg-emerald-100/70 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/70">
              <QrCode className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {openSession.status === "active" ? "Test je u toku" : "Test čeka početak"}
                {" · "}
                {openSession.quizTitle}
              </p>
              <p className="text-xs text-brand-dark/70">
                {openSession.className} · kod <span className="font-mono font-bold">{openSession.code}</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            Otvori sesiju <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Odjeljenja"
          value={classRows.length}
          hint={user.role === "admin" ? "sva u školi" : "u tvojoj nastavi"}
          icon={Users}
        />
        <StatCard
          label="Učenici"
          value={studentRows.length}
          hint="aktivni na spisku"
          icon={GraduationCap}
        />
        <StatCard label="Kvizovi" value={quizRows.length} hint="spremni za čas" icon={BookOpen} />
        <StatCard
          label="Testovi"
          value={sessionCount}
          hint="od početka godine"
          icon={CalendarClock}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Zadnji testovi</h2>
              <p className="text-xs text-muted">Sesije koje su pokrenute iz tvog naloga.</p>
            </div>
            <Link
              href="/teacher/classes"
              className="text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Sva odjeljenja
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Sparkles}
                title="Još nema testova"
                description="Kreiraj kviz, izaberi odjeljenje i pokreni prvi petominutni test."
              >
                <Link href="/teacher/quizzes/new" data-nav-link="true" className="btn btn-primary">
                  <Plus className="h-4 w-4" />
                  Napravi kviz
                </Link>
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentSessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/teacher/sessions/${session.id}`}
                    data-nav-link="true"
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-muted">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {session.quizTitle}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {session.className} · {formatDateTime(session.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={session.status} />
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Brze akcije</h2>
            <div className="mt-3 grid gap-2">
              <Link
                href="/teacher/quizzes/new"
                data-nav-link="true"
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-sm font-medium transition-colors hover:border-brand/30 hover:bg-brand-soft/40"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Plus className="h-4 w-4" />
                </span>
                Napravi novi kviz
                <ArrowRight className="ml-auto h-4 w-4 text-muted" />
              </Link>
              <Link
                href="/teacher/classes"
                data-nav-link="true"
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-sm font-medium transition-colors hover:border-brand/30 hover:bg-brand-soft/40"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Users className="h-4 w-4" />
                </span>
                Otvori odjeljenje
                <ArrowRight className="ml-auto h-4 w-4 text-muted" />
              </Link>
            </div>
          </section>

          <section className="card bg-brand p-5 text-white">
            <h2 className="text-sm font-semibold">Kako ide jedan test</h2>
            <ol className="mt-3 space-y-3 text-sm text-white/80">
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/12 text-[11px] font-bold">
                  1
                </span>
                Pripremi kviz — forma ili uvoz iz teksta.
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/12 text-[11px] font-bold">
                  2
                </span>
                Pokreni sesiju i pokaži QR kod na projektoru.
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/12 text-[11px] font-bold">
                  3
                </span>
                Učenici rješavaju pet minuta, ti gledaš rezultate uživo.
              </li>
            </ol>
          </section>

          {classRows.length > 0 ? (
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Odjeljenja</h2>
                <Link
                  href="/teacher/classes"
                  data-nav-link="true"
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  Sve
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {classRows.slice(0, 4).map((cls) => (
                  <Link
                    key={cls.id}
                    href={`/teacher/classes/${cls.id}`}
                    data-nav-link="true"
                    className="flex items-center justify-between rounded-lg px-1 py-1.5 text-sm transition-colors hover:text-brand"
                  >
                    <span className="truncate">{cls.name}</span>
                    <span className="text-xs text-muted">
                      {studentRows.filter((student) => student.classId === cls.id).length}{" "}
                      {studentWord(studentRows.filter((student) => student.classId === cls.id).length)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight, BookOpen, Plus, Users } from "lucide-react";
import { db } from "@/db";
import { classes, sessions, students, teachers } from "@/db/schema";
import { createClassAction } from "@/app/actions/classes";
import { SubmitButton } from "@/components/SubmitButton";
import { Banner, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { currentSchoolYear, testWord } from "@/lib/format";

export const metadata = { title: "Odjeljenja" };

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

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

  const sessionRows =
    classIds.length > 0
      ? await db
          .select({ classId: sessions.classId, status: sessions.status })
          .from(sessions)
          .where(inArray(sessions.classId, classIds))
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Nastava"
        title="Odjeljenja"
        description="Svako odjeljenje ima spisak učenika, svoje testove i pregled uspjeha."
      />

      {error === "naziv" ? (
        <div className="mb-5">
          <Banner tone="danger">Naziv odjeljenja ne može biti prazan.</Banner>
        </div>
      ) : null}

      <form
        action={createClassAction}
        className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="name" className="label">
            Novo odjeljenje
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="npr. 3. razred"
            className="input"
            autoComplete="off"
          />
        </div>
        <SubmitButton pendingLabel="Dodajem…">
          <Plus className="h-4 w-4" />
          Dodaj odjeljenje
        </SubmitButton>
      </form>

      {classRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Još nema odjeljenja"
          description="Dodaj prvo odjeljenje iznad, pa zalijepi spisak učenika."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classRows.map((cls) => {
            const studentCount = studentRows.filter(
              (student) => student.classId === cls.id,
            ).length;
            const testCount = sessionRows.filter(
              (session) => session.classId === cls.id,
            ).length;
            const activeTest = sessionRows.some(
              (session) =>
                session.classId === cls.id &&
                (session.status === "lobby" || session.status === "active"),
            );

            return (
              <Link
                key={cls.id}
                href={`/teacher/classes/${cls.id}`}
                data-nav-link="true"
                className="card group flex flex-col p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                      {cls.schoolYear}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight">
                      {cls.name}
                    </h2>
                    {user.role === "admin" ? (
                      <p className="mt-0.5 text-xs text-muted">{cls.teacherName}</p>
                    ) : null}
                  </div>
                  {activeTest ? (
                    <span className="badge border-emerald-200 bg-brand-soft text-brand-dark">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      aktivan test
                    </span>
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>

                <div className="mt-5 flex items-center gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {studentCount} učenika
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    {testCount} {testWord(testCount)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Školska godina {currentSchoolYear()} · odjeljenja se ne brišu, učenici se
        deaktiviraju da bi ostala historija.
      </p>
    </>
  );
}

import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { classes, sessions, students, teachers } from "@/db/schema";
import { createClassAction } from "@/app/actions/classes";
import { SubmitButton } from "@/components/SubmitButton";
import { Banner, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { testWord } from "@/lib/format";

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
        meta="Nastava"
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
        className="sheet mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
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
          title="Još nema odjeljenja"
          description="Dodaj prvo odjeljenje iznad, pa zalijepi spisak učenika."
        />
      ) : (
        <ul className="border-t border-rule">
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
              <li key={cls.id} className="border-b border-rule-soft">
                <Link
                  href={`/teacher/classes/${cls.id}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-4 transition-colors hover:text-forest-deep"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[1.35rem] leading-tight">
                      {cls.name}
                    </span>
                    <span className="mt-0.5 block font-sans text-xs text-muted">
                      {cls.schoolYear}
                      {user.role === "admin" ? ` · ${cls.teacherName}` : ""} ·{" "}
                      {studentCount} učenika · {testCount} {testWord(testCount)}
                    </span>
                  </span>
                  <span className="font-sans text-xs text-ink-soft">
                    {activeTest ? "test je otvoren" : "bez otvorenog testa"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 font-sans text-xs text-muted">
        Odjeljenja se ne brišu. Učenika koji napusti razred deaktiviraj — historija
        testova ostaje sačuvana.
      </p>
    </>
  );
}

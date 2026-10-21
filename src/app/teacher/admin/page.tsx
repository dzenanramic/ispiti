import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { classes, sessions, students, teachers } from "@/db/schema";
import { PageHeader, StatRow } from "@/components/ui";
import { classWord, formatDate, initials, testWord } from "@/lib/format";
import { requireAdmin } from "@/lib/guard";
import { CreateTeacherForm } from "./CreateTeacherForm";

export const metadata = { title: "Administracija" };

export default async function AdminPage() {
  await requireAdmin();

  const teacherRows = await db
    .select({
      id: teachers.id,
      name: teachers.name,
      email: teachers.email,
      role: teachers.role,
      createdAt: teachers.createdAt,
    })
    .from(teachers)
    .orderBy(teachers.name);

  const classRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      schoolYear: classes.schoolYear,
      teacherId: classes.teacherId,
      teacherName: teachers.name,
    })
    .from(classes)
    .innerJoin(teachers, eq(classes.teacherId, teachers.id))
    .orderBy(classes.name);

  const classIds = classRows.map((cls) => cls.id);

  const studentRows =
    classIds.length > 0
      ? await db
          .select({ classId: students.classId })
          .from(students)
          .where(inArray(students.classId, classIds))
      : [];

  const sessionRows =
    classIds.length > 0
      ? await db
          .select({ classId: sessions.classId })
          .from(sessions)
          .where(inArray(sessions.classId, classIds))
      : [];

  return (
    <>
      <PageHeader
        meta="Samo za administratora"
        title="Administracija"
        description="Nalozi nastavnika i pregled svih odjeljenja u školi. Rezultate odjeljenja vidi nastavnik i administrator."
      />

      <div>
        <StatRow
          items={[
            { label: "Nastavnici", value: teacherRows.length },
            { label: "Odjeljenja", value: classRows.length },
            { label: "Učenici", value: studentRows.length },
            { label: "Testovi", value: sessionRows.length },
          ]}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="sheet overflow-hidden">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="section-title">Nalozi</h2>
            <p className="text-xs text-muted">
              Nastavnici se ne registruju sami — dodaje ih administrator.
            </p>
          </div>
          <ul className="divide-y divide-rule-soft">
            {teacherRows.map((teacher) => {
              const classCount = classRows.filter(
                (cls) => cls.teacherId === teacher.id,
              ).length;
              return (
                <li
                  key={teacher.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-wash text-xs font-bold text-forest-deep">
                    {initials(teacher.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{teacher.name}</p>
                    <p className="truncate text-xs text-muted">{teacher.email}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        teacher.role === "admin"
                          ? "badge border-rule bg-ink-wash text-ink-soft"
                          : "badge border-rule bg-paper text-muted"
                      }
                    >
                      {teacher.role === "admin" ? "admin" : "nastavnik"}
                    </span>
                    {teacher.role !== "admin" ? (
                      <p className="mt-1 text-[10px] text-muted">
                        {classCount} {classWord(classCount)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="sheet p-5">
          <h2 className="section-title">Novi nastavnik</h2>
          <p className="mb-4 mt-0.5 text-xs text-muted">
            Dobija pristup odmah, sa navedenom lozinkom.
          </p>
          <CreateTeacherForm />
        </section>
      </div>

      <section className="sheet mt-5 overflow-hidden">
        <div className="border-b border-rule px-5 py-4">
          <h2 className="section-title">Sva odjeljenja</h2>
          <p className="text-xs text-muted">
            Kao administrator vidiš i otvaraš svako odjeljenje.
          </p>
        </div>
        {classRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Još nema odjeljenja.</p>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {classRows.map((cls) => (
              <li key={cls.id}>
                <Link
                  href={`/teacher/classes/${cls.id}`}
                  data-nav-link="true"
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {cls.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {cls.teacherName} · {cls.schoolYear}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {studentRows.filter((student) => student.classId === cls.id).length}{" "}
                    učenika ·{" "}
                    {sessionRows.filter((session) => session.classId === cls.id).length}{" "}
                    {testWord(sessionRows.filter((session) => session.classId === cls.id).length)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-muted">
        Nalozi kreirani {formatDate(new Date())} · podaci se čuvaju do kraja školske
        godine.
      </p>
    </>
  );
}

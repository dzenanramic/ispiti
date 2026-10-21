"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classes, grades, students } from "@/db/schema";
import { TERMS, currentSchoolYear } from "@/lib/format";
import { requireUser } from "@/lib/guard";

async function loadOwnedClass(classId: string) {
  const user = await requireUser();
  const [row] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!row) redirect("/teacher/classes");
  if (user.role !== "admin" && row.teacherId !== user.id) redirect("/teacher/classes");
  return { user, row };
}

export async function createClassAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();

  if (!name) {
    redirect("/teacher/classes?error=naziv");
  }

  const [created] = await db
    .insert(classes)
    .values({
      teacherId: user.id,
      name,
      schoolYear: currentSchoolYear(),
    })
    .returning();

  revalidatePath("/teacher/classes");
  redirect(`/teacher/classes/${created.id}`);
}

export async function addStudentsAction(
  classId: string,
  formData: FormData,
): Promise<void> {
  const { row: cls } = await loadOwnedClass(classId);
  const raw = String(formData.get("names") ?? "");

  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of raw.split("\n")) {
    const name = line.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase("bs");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  if (names.length === 0) {
    revalidatePath(`/teacher/classes/${classId}`);
    return;
  }

  const existing = await db
    .select({ name: students.name })
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.active, true)));
  const existingKeys = new Set(
    existing.map((student) => student.name.toLocaleLowerCase("bs")),
  );

  const toInsert = names
    .filter((name) => !existingKeys.has(name.toLocaleLowerCase("bs")))
    .slice(0, 100)
    .map((name) => ({ classId: cls.id, name }));

  if (toInsert.length > 0) {
    await db.insert(students).values(toInsert);
  }

  revalidatePath(`/teacher/classes/${classId}`);
}

export async function deactivateStudentAction(studentId: string): Promise<void> {
  const user = await requireUser();
  const [student] = await db
    .select({
      id: students.id,
      classId: students.classId,
      teacherId: classes.teacherId,
    })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student) return;
  if (user.role !== "admin" && student.teacherId !== user.id) return;

  await db.update(students).set({ active: false }).where(eq(students.id, studentId));
  revalidatePath(`/teacher/classes/${student.classId}`);
}

export async function activateStudentAction(studentId: string): Promise<void> {
  const user = await requireUser();
  const [student] = await db
    .select({
      id: students.id,
      classId: students.classId,
      teacherId: classes.teacherId,
    })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student) return;
  if (user.role !== "admin" && student.teacherId !== user.id) return;

  await db.update(students).set({ active: true }).where(eq(students.id, studentId));
  revalidatePath(`/teacher/classes/${student.classId}`);
}

export async function addGradeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const classId = String(formData.get("classId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const term = String(formData.get("term") ?? "");
  const value = Number(formData.get("value"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  const { row: cls } = await loadOwnedClass(classId);

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    redirect(`/teacher/classes/${classId}/grades?error=ocjena`);
  }
  if (!TERMS.includes(term as (typeof TERMS)[number])) {
    redirect(`/teacher/classes/${classId}/grades?error=polugodiste`);
  }

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.classId, cls.id)))
    .limit(1);

  if (!student) {
    redirect(`/teacher/classes/${classId}/grades?error=ucenik`);
  }

  await db.insert(grades).values({
    studentId: student.id,
    classId: cls.id,
    term,
    value,
    note,
    createdBy: user.id,
  });

  revalidatePath(`/teacher/classes/${classId}/grades`);
}

export async function deleteGradeAction(gradeId: string): Promise<void> {
  const user = await requireUser();
  const [grade] = await db
    .select({
      id: grades.id,
      classId: grades.classId,
      teacherId: classes.teacherId,
    })
    .from(grades)
    .innerJoin(classes, eq(grades.classId, classes.id))
    .where(eq(grades.id, gradeId))
    .limit(1);

  if (!grade) return;
  if (user.role !== "admin" && grade.teacherId !== user.id) return;

  await db.delete(grades).where(eq(grades.id, gradeId));
  revalidatePath(`/teacher/classes/${grade.classId}/grades`);
}

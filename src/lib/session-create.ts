import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, quizzes, sessions } from "@/db/schema";
import { generateCode } from "@/lib/codes";
import type { SessionUser } from "@/lib/auth";

export type CreateLobbySessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

function clampDuration(value: number): number {
  if (!Number.isInteger(value)) return 300;
  return Math.min(900, Math.max(120, value));
}

/**
 * Otvara lobby sesiju za kviz u njegovom razredu.
 *
 * Pravila:
 * - kviz i razred moraju pripadati nastavniku (admin smije sve),
 * - kviz pripremljen za jedan razred ne može se otvoriti u drugom,
 * - stariji kviz bez razreda se dodjeljuje razredu pri prvom pokretanju,
 * - ako razred već ima otvoren test, ne pravi se drugi kod.
 */
export async function createLobbySession({
  user,
  classId,
  quizId,
  durationSeconds = 300,
}: {
  user: SessionUser;
  classId: string;
  quizId: string;
  durationSeconds?: number;
}): Promise<CreateLobbySessionResult> {
  if (!classId || !quizId) {
    return { ok: false, error: "Izaberi razred i kviz." };
  }

  const [cls] = await db
    .select({ id: classes.id, teacherId: classes.teacherId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!cls) return { ok: false, error: "Odjeljenje ne postoji." };
  if (user.role !== "admin" && cls.teacherId !== user.id) {
    return { ok: false, error: "Nemaš pristup ovom odjeljenju." };
  }

  const [quiz] = await db
    .select({
      id: quizzes.id,
      teacherId: quizzes.teacherId,
      classId: quizzes.classId,
      archived: quizzes.archived,
    })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) return { ok: false, error: "Kviz ne postoji." };
  if (user.role !== "admin" && quiz.teacherId !== user.id) {
    return { ok: false, error: "Nemaš pristup ovom kvizu." };
  }
  if (quiz.archived) {
    return { ok: false, error: "Kviz je arhiviran. Vrati ga prije pokretanja." };
  }
  if (quiz.classId && quiz.classId !== cls.id) {
    return {
      ok: false,
      error:
        "Ovaj kviz je pripremljen za drugo odjeljenje. Duplikuj ga i dodijeli ovom razredu.",
    };
  }

  const [open] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.classId, cls.id),
        inArray(sessions.status, ["lobby", "active"]),
      ),
    )
    .limit(1);

  if (open) {
    return {
      ok: false,
      error:
        "U ovom odjeljenju je već otvoren test. Zatvori ga prije nego što otvoriš novi.",
    };
  }

  // Kvizovi nastali prije uvođenja razreda dobijaju razred pri prvom startu.
  if (!quiz.classId) {
    await db
      .update(quizzes)
      .set({ classId: cls.id, updatedAt: new Date() })
      .where(eq(quizzes.id, quiz.id));
  }

  let code = generateCode();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [existing] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);
    if (!existing) break;
    code = generateCode();
  }

  const [created] = await db
    .insert(sessions)
    .values({
      quizId: quiz.id,
      classId: cls.id,
      teacherId: cls.teacherId,
      code,
      durationSeconds: clampDuration(durationSeconds),
      status: "lobby",
    })
    .returning();

  revalidatePath(`/teacher/classes/${cls.id}`);
  revalidatePath("/teacher/quizzes");

  return { ok: true, sessionId: created.id };
}

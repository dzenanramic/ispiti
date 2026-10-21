"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { classes, questions, quizzes, sessions } from "@/db/schema";
import { requireUser } from "@/lib/guard";
import { createLobbySession } from "@/lib/session-create";
import type { QuizSaveInput } from "@/lib/types";

const questionSchema = z.object({
  type: z.enum(["tf", "single", "cloze"]),
  prompt: z.string().trim().min(3, "Tekst pitanja je prekratak.").max(2000),
  options: z.array(z.string().trim().min(1).max(200)).max(8),
  correct: z.union([z.boolean(), z.number().int().min(0)]),
});

const quizSchema = z.object({
  id: z.string().uuid().optional(),
  classId: z.string().uuid("Izaberi razred kojem pripada kviz."),
  title: z.string().trim().min(3, "Naziv kviza je prekratak.").max(160),
  lesson: z.string().trim().max(200),
  questions: z.array(questionSchema).min(1, "Dodaj najmanje jedno pitanje.").max(20),
  start: z.boolean().optional(),
  durationSeconds: z.number().int().min(120).max(900).optional(),
});

export type SaveQuizResult =
  | { ok: true; id: string; sessionId?: string; sessionError?: string }
  | { ok: false; error: string };

type CleanQuestion = {
  type: "tf" | "single" | "cloze";
  prompt: string;
  options: string[];
  correct: boolean | number;
};

function cleanQuestions(input: QuizSaveInput["questions"]): {
  questions: CleanQuestion[];
  error?: string;
} {
  const cleaned: CleanQuestion[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    const label = `Pitanje ${index + 1}`;
    const prompt = raw.prompt.trim();

    if (!prompt) return { questions: [], error: `${label}: tekst je obavezan.` };

    if (raw.type === "tf") {
      if (typeof raw.correct !== "boolean") {
        return { questions: [], error: `${label}: izaberi Tačno ili Netačno.` };
      }
      cleaned.push({ type: "tf", prompt, options: [], correct: raw.correct });
      continue;
    }

    const options = raw.options.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      return { questions: [], error: `${label}: potrebne su najmanje dvije opcije.` };
    }
    if (options.length > 8) {
      return { questions: [], error: `${label}: najviše osam opcija.` };
    }
    const unique = new Set(options.map((option) => option.toLocaleLowerCase("bs")));
    if (unique.size !== options.length) {
      return { questions: [], error: `${label}: opcije se ponavljaju.` };
    }
    if (typeof raw.correct !== "number" || !Number.isInteger(raw.correct)) {
      return { questions: [], error: `${label}: označi tačan odgovor.` };
    }
    if (raw.correct < 0 || raw.correct >= options.length) {
      return { questions: [], error: `${label}: tačan odgovor nije među opcijama.` };
    }

    cleaned.push({ type: raw.type, prompt, options, correct: raw.correct });
  }

  return { questions: cleaned };
}

export async function saveQuizAction(input: QuizSaveInput): Promise<SaveQuizResult> {
  const user = await requireUser();
  const parsed = quizSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravan unos." };
  }

  const data = parsed.data;
  const { questions: cleaned, error } = cleanQuestions(data.questions);
  if (error) return { ok: false, error };

  const [cls] = await db
    .select({ id: classes.id, teacherId: classes.teacherId })
    .from(classes)
    .where(eq(classes.id, data.classId))
    .limit(1);

  if (!cls) return { ok: false, error: "Izabrano odjeljenje ne postoji." };
  if (user.role !== "admin" && cls.teacherId !== user.id) {
    return { ok: false, error: "Nemaš pristup izabranom odjeljenju." };
  }

  // Ako se test odmah otvara, provjeri zauzetost razreda prije nego što
  // sačuvamo kviz — da ne ostane sačuvan kviz bez otvorenog testa.
  if (data.start) {
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
  }

  if (data.id) {
    const [existing] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, data.id))
      .limit(1);

    if (!existing) return { ok: false, error: "Kviz ne postoji." };
    if (user.role !== "admin" && existing.teacherId !== user.id) {
      return { ok: false, error: "Nemaš pristup ovom kvizu." };
    }

    const [used] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.quizId, data.id))
      .limit(1);

    if (used) {
      return {
        ok: false,
        error:
          "Kviz je već korišten u testu i ne može se mijenjati. Duplikuj ga i izmijeni kopiju.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(quizzes)
        .set({
          title: data.title,
          lesson: data.lesson,
          classId: cls.id,
          updatedAt: new Date(),
        })
        .where(eq(quizzes.id, data.id!));
      await tx.delete(questions).where(eq(questions.quizId, data.id!));
      await tx.insert(questions).values(
        cleaned.map((question, index) => ({
          quizId: data.id!,
          position: index,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          correct: question.correct,
        })),
      );
    });

    revalidatePath("/teacher/quizzes");
    revalidatePath(`/teacher/quizzes/${data.id}`);
    revalidatePath(`/teacher/classes/${cls.id}`);

    if (data.start) {
      const session = await createLobbySession({
        user,
        classId: cls.id,
        quizId: data.id,
        durationSeconds: data.durationSeconds,
      });
      if (!session.ok) {
        return { ok: true, id: data.id, sessionError: session.error };
      }
      return { ok: true, id: data.id, sessionId: session.sessionId };
    }

    return { ok: true, id: data.id };
  }

  const quizId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(quizzes)
      .values({
        teacherId: user.id,
        classId: cls.id,
        title: data.title,
        lesson: data.lesson,
      })
      .returning();

    await tx.insert(questions).values(
      cleaned.map((question, index) => ({
        quizId: created.id,
        position: index,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        correct: question.correct,
      })),
    );

    return created.id;
  });

  revalidatePath("/teacher/quizzes");
  revalidatePath(`/teacher/classes/${cls.id}`);

  if (data.start) {
    const session = await createLobbySession({
      user,
      classId: cls.id,
      quizId,
      durationSeconds: data.durationSeconds,
    });
    if (!session.ok) {
      return { ok: true, id: quizId, sessionError: session.error };
    }
    return { ok: true, id: quizId, sessionId: session.sessionId };
  }

  return { ok: true, id: quizId };
}

export async function duplicateQuizAction(quizId: string): Promise<void> {
  const user = await requireUser();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) redirect("/teacher/quizzes");
  if (user.role !== "admin" && quiz.teacherId !== user.id) redirect("/teacher/quizzes");

  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(questions.position);

  const newId = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(quizzes)
      .values({
        teacherId: user.id,
        classId: quiz.classId,
        title: `${quiz.title} (kopija)`.slice(0, 160),
        lesson: quiz.lesson,
      })
      .returning();

    if (quizQuestions.length > 0) {
      await tx.insert(questions).values(
        quizQuestions.map((question, index) => ({
          quizId: copy.id,
          position: index,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          correct: question.correct,
          points: question.points,
        })),
      );
    }

    return copy.id;
  });

  revalidatePath("/teacher/quizzes");
  redirect(`/teacher/quizzes/${newId}`);
}

export async function archiveQuizAction(quizId: string): Promise<void> {
  const user = await requireUser();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) return;
  if (user.role !== "admin" && quiz.teacherId !== user.id) return;

  await db.update(quizzes).set({ archived: true }).where(eq(quizzes.id, quizId));
  revalidatePath("/teacher/quizzes");
}

export async function restoreQuizAction(quizId: string): Promise<void> {
  const user = await requireUser();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) return;
  if (user.role !== "admin" && quiz.teacherId !== user.id) return;

  await db.update(quizzes).set({ archived: false }).where(eq(quizzes.id, quizId));
  revalidatePath("/teacher/quizzes");
}

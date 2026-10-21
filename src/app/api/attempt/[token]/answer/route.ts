import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { answers, attempts, questions, sessions } from "@/db/schema";
import { jsonError } from "@/lib/attempts";
import { isAnswerCorrect } from "@/lib/grading";

const bodySchema = z.object({
  questionId: z.string().uuid(),
  value: z.union([z.boolean(), z.number().int()]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Neispravan odgovor.");

  const [row] = await db
    .select({
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      sessionStatus: sessions.status,
      endsAt: sessions.endsAt,
      quizId: sessions.quizId,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(eq(attempts.token, token))
    .limit(1);

  if (!row) return jsonError("Test nije pronađen.", 404);
  if (row.attemptStatus === "submitted") return jsonError("Test je već predan.", 409);
  if (row.sessionStatus !== "active") return jsonError("Test nije u toku.", 409);
  if (row.endsAt && row.endsAt.getTime() + 10000 < Date.now()) {
    return jsonError("Vrijeme je isteklo.", 409);
  }

  const [question] = await db
    .select({
      id: questions.id,
      type: questions.type,
      options: questions.options,
      correct: questions.correct,
    })
    .from(questions)
    .where(and(eq(questions.id, parsed.data.questionId), eq(questions.quizId, row.quizId)))
    .limit(1);

  if (!question) return jsonError("Pitanje nije pronađeno.", 404);

  if (question.type === "tf") {
    if (typeof parsed.data.value !== "boolean") {
      return jsonError("Neispravan odgovor.", 400);
    }
  } else {
    const count = (question.options ?? []).length;
    if (
      typeof parsed.data.value !== "number" ||
      parsed.data.value < 0 ||
      parsed.data.value >= count
    ) {
      return jsonError("Neispravan odgovor.", 400);
    }
  }

  const isCorrect = isAnswerCorrect(question.correct, parsed.data.value);

  await db
    .insert(answers)
    .values({
      attemptId: row.attemptId,
      questionId: question.id,
      value: parsed.data.value,
      isCorrect,
    })
    .onConflictDoUpdate({
      target: [answers.attemptId, answers.questionId],
      set: {
        value: parsed.data.value,
        isCorrect,
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}

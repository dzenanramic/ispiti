import { eq } from "drizzle-orm";
import { db } from "@/db";
import { answers, attempts, questions } from "@/db/schema";
import { earnedPoints, scoreAnswers } from "./grading";

export type SubmitReason = "student" | "time" | "left" | "closed" | "manual";

export async function finalizeAttempt(
  attemptId: string,
  quizId: string,
  submitReason: SubmitReason = "student",
): Promise<number> {
  const quizQuestions = await db
    .select({
      id: questions.id,
      type: questions.type,
      correct: questions.correct,
      points: questions.points,
      pairs: questions.pairs,
    })
    .from(questions)
    .where(eq(questions.quizId, quizId));

  const answerRows = await db
    .select({ id: answers.id, questionId: answers.questionId, value: answers.value })
    .from(answers)
    .where(eq(answers.attemptId, attemptId));

  const score = scoreAnswers(quizQuestions, answerRows);

  // Upiši i bodove po odgovoru — matrica ih koristi za djelimično bodovanje.
  await db.transaction(async (tx) => {
    for (const answer of answerRows) {
      const question = quizQuestions.find((row) => row.id === answer.questionId);
      if (!question) continue;
      await tx
        .update(answers)
        .set({ earnedPoints: earnedPoints(question, answer.value) })
        .where(eq(answers.id, answer.id));
    }

    await tx
      .update(attempts)
      .set({
        status: "submitted",
        score,
        submittedAt: new Date(),
        submitReason,
      })
      .where(eq(attempts.id, attemptId));
  });

  return score;
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

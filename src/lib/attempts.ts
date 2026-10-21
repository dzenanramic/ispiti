import { eq } from "drizzle-orm";
import { db } from "@/db";
import { answers, attempts, questions } from "@/db/schema";
import { scoreAnswers } from "./grading";

export async function finalizeAttempt(
  attemptId: string,
  quizId: string,
): Promise<number> {
  const quizQuestions = await db
    .select({
      id: questions.id,
      type: questions.type,
      correct: questions.correct,
      points: questions.points,
    })
    .from(questions)
    .where(eq(questions.quizId, quizId));

  const answerRows = await db
    .select({ questionId: answers.questionId, value: answers.value })
    .from(answers)
    .where(eq(answers.attemptId, attemptId));

  const score = scoreAnswers(quizQuestions, answerRows);

  await db
    .update(attempts)
    .set({ status: "submitted", score, submittedAt: new Date() })
    .where(eq(attempts.id, attemptId));

  return score;
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

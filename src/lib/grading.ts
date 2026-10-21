import type { CorrectValue, QuestionType } from "@/db/schema";

export type QuestionForScore = {
  id: string;
  type: QuestionType;
  correct: CorrectValue;
  points: number;
};

export function isAnswerCorrect(correct: CorrectValue, value: unknown): boolean {
  if (typeof correct === "boolean") return value === correct;
  return typeof value === "number" && Number.isInteger(value) && value === correct;
}

export function scoreAnswers(
  questions: QuestionForScore[],
  answers: { questionId: string; value: unknown }[],
): number {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  return questions.reduce((total, question) => {
    const value = byQuestion.get(question.id);
    return isAnswerCorrect(question.correct, value) ? total + question.points : total;
  }, 0);
}

export function maxScore(questions: { points: number }[]): number {
  return questions.reduce((total, question) => total + question.points, 0);
}

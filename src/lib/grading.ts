import type { CorrectValue, QuestionType } from "@/db/schema";
import type { QuestionPair } from "@/lib/types";

export type QuestionForScore = {
  id: string;
  type: QuestionType;
  correct: CorrectValue;
  points: number;
  pairs?: QuestionPair[];
};

/**
 * Bodovi za jedno pitanje, i to po dijelovima:
 * - `matching`: 1 bod za svaki tačno spojen par,
 * - `cloze_multi`: tačno samo ako su sve praznine tačne (1 bod),
 * - ostalo: 0 ili 1 bod.
 */
export function earnedPoints(
  question: QuestionForScore,
  value: unknown,
): number {
  if (question.type === "matching") {
    return countCorrectPairs(question.pairs ?? [], value);
  }
  return isAnswerCorrect(question.correct, value) ? 1 : 0;
}

/** Broj tačno spojenih parova. Odgovor je niz `desniIndex` po lijevom paru. */
export function countCorrectPairs(pairs: QuestionPair[], value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return pairs.reduce(
    (total, _pair, index) => (value[index] === index ? total + 1 : total),
    0,
  );
}

/** Pitanje je „tačno" za matricu ako je zaradilo sve predviđene bodove. */
export function isFullyCorrect(question: QuestionForScore, value: unknown): boolean {
  const total = question.type === "matching" ? question.pairs?.length ?? 1 : 1;
  return earnedPoints(question, value) >= total;
}

export function isAnswerCorrect(correct: CorrectValue, value: unknown): boolean {
  if (typeof correct === "boolean") return value === correct;

  if (Array.isArray(correct)) {
    if (!Array.isArray(value)) return false;
    if (value.length !== correct.length) return false;
    // Svaka praznina se boduje posebno: pitanje je tačno samo ako su sve
    // praznine tačne, kao i ranije kod ostalih tipova.
    return correct.every(
      (expected, index) =>
        Number.isInteger(expected) && value[index] === expected,
    );
  }

  return typeof value === "number" && Number.isInteger(value) && value === correct;
}

/** Broj tačnih praznina za više-prazninsko pitanje (za prikaz u rezultatima). */
export function correctBlankCount(correct: CorrectValue, value: unknown): number {
  if (!Array.isArray(correct)) return isAnswerCorrect(correct, value) ? 1 : 0;
  if (!Array.isArray(value)) return 0;
  return correct.reduce(
    (total, expected, index) => (value[index] === expected ? total + 1 : total),
    0,
  );
}

export function scoreAnswers(
  questions: QuestionForScore[],
  answers: { questionId: string; value: unknown }[],
): number {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  return questions.reduce((total, question) => {
    const value = byQuestion.get(question.id);
    return total + earnedPoints(question, value);
  }, 0);
}

export function maxScore(questions: { points: number }[]): number {
  return questions.reduce((total, question) => total + question.points, 0);
}

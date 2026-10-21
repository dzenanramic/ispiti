export type QuestionType = "tf" | "single" | "cloze";

export type QuestionInput = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correct: boolean | number;
};

export type SessionStatus = "lobby" | "active" | "closed";

export type QuizSaveInput = {
  id?: string;
  title: string;
  lesson: string;
  questions: QuestionInput[];
};

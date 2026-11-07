export type QuestionType = "tf" | "single" | "cloze" | "cloze_multi" | "matching";

/**
 * `tf` → boolean; `single`/`cloze` → indeks opcije; `cloze_multi` → po jedan
 * indeks iz zajedničke banke za svaku prazninu, redom kojim se praznine
 * pojavljuju u tekstu (`_____`); `matching` → ništa (`correct` se izvodi iz
 * `pairs`, gdje je par i-ta stavka sa i-tom).
 */
export type CorrectValue = boolean | number | number[];

/** Odgovor učenika — isti oblik kao `CorrectValue`. */
export type AnswerValue = boolean | number | number[];

/** Par za povezivanje: lijevi (npr. arapski izraz) i desni (npr. prijevod). */
export type QuestionPair = { left: string; right: string };

export type QuestionInput = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correct: CorrectValue;
  /** Samo za `matching`; kod ostalih tipova prazan niz. */
  pairs?: QuestionPair[];
};

export type SessionStatus = "lobby" | "active" | "closed";

export type QuizSaveInput = {
  id?: string;
  classId: string;
  title: string;
  lesson: string;
  questions: QuestionInput[];
  /** Ako je true, odmah se otvara lobby sesija u izabranom razredu. */
  start?: boolean;
  durationSeconds?: number;
};

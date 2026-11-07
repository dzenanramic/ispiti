"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { saveQuizAction } from "@/app/actions/quizzes";
import { startQuizSessionAction } from "@/app/actions/sessions";
import { generateQuizFromFileAction } from "@/app/actions/ai-import";
import { parseQuestions, countBlanks, renumberBlankLabels } from "@/lib/parse-questions";
import type { QuestionInput, QuestionType } from "@/lib/types";

type EditorQuestion = QuestionInput & { key: string };

type ClassOption = { id: string; name: string };

type InitialQuiz = {
  id: string;
  classId: string | null;
  title: string;
  lesson: string;
  questions: QuestionInput[];
  locked?: boolean;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single: "Jedan tačan odgovor",
  tf: "Tačno / Netačno",
  cloze: "Dopuna (ponuđene riječi)",
  cloze_multi: "Hadis / tekst — više praznina",
  matching: "Povezivanje parova",
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Primjer koji stoji u samom polju: pokazuje sva tri tipa pitanja.
export const IMPORT_EXAMPLE = `1. Koji su osnovni dijelovi hadisa?
A) Isnad i matn
B) Sened i šerh
C) Matn i tefsir
Tačno: A

2. Hadis je riječ, djelo ili odobrenje Poslanika.
Tačno: T

3. Lanac prenosilaca naziva se _____.
Riječi: isnad, matn, šerh, tefsir
Tačno: isnad

4. Dopuni hadis o nijjetu.
„Zaista se djela vrednuju prema _____ (1), i zaista svakom čovjeku pripada ono
što je _____ (2), a čija hidžra bude radi materijalne dobiti koju želi
_____ (3).“
Riječi: zanijetio, namjerama, iselio, ostvariti, dobiti
Praznine: namjerama; zanijetio; ostvariti

5. Poveži arapski izraz s prijevodom.
1) إِذَا لَقِيتَهُ فَسَلِّمْ عَلَيْهِ = Kada ga sretneš, nazovi mu selam.
2) وَإِذَا دَعَاكَ فَأَجِبْهُ = Kada te pozove, odazovi mu se.
3) وَإِذَا مَاتَ فَاتَّبِعْهُ = Kada umre, isprati mu dženazu.`;

function makeKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function pluralBs(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function blankQuestion(type: QuestionType = "single"): EditorQuestion {
  if (type === "tf") {
    return { key: makeKey(), type, prompt: "", options: [], correct: true };
  }
  if (type === "cloze_multi") {
    return {
      key: makeKey(),
      type,
      prompt: "",
      options: ["", "", "", ""],
      correct: [],
    };
  }
  if (type === "matching") {
    return {
      key: makeKey(),
      type,
      prompt: "",
      options: [],
      correct: true,
      pairs: [
        { left: "", right: "" },
        { left: "", right: "" },
        { left: "", right: "" },
      ],
    };
  }
  return {
    key: makeKey(),
    type,
    prompt: "",
    options: ["", "", "", ""],
    correct: 0,
  };
}

function withCorrect(q: EditorQuestion, correct: number): EditorQuestion {
  return { ...q, correct };
}

export function QuizEditor({
  initial,
  classes,
  initialClassId,
  initialError,
  aiEnabled = true,
}: {
  initial: InitialQuiz | null;
  classes: ClassOption[];
  initialClassId: string | null;
  initialError?: string | null;
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lesson, setLesson] = useState(initial?.lesson ?? "");
  const [classId, setClassId] = useState(
    initial?.classId ?? initialClassId ?? "",
  );
  const [duration, setDuration] = useState(300);
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);
  const [pendingIntent, setPendingIntent] = useState<"save" | "start" | null>(
    null,
  );
  const [questions, setQuestions] = useState<EditorQuestion[]>(
    initial
      ? initial.questions.map((question, index) => ({
          ...question,
          key: `initial-${index}`,
        }))
      : [blankQuestion("single")],
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();
  const aiFileRef = useRef<HTMLInputElement>(null);

  function updateQuestion(index: number, next: EditorQuestion) {
    setQuestions((current) =>
      current.map((question, i) => (i === index ? next : question)),
    );
  }

  function changeType(index: number, type: QuestionType) {
    const question = questions[index];
    if (type === "tf") {
      updateQuestion(index, {
        ...question,
        type,
        options: [],
        correct: true,
        pairs: [],
      });
      return;
    }
    if (type === "matching") {
      updateQuestion(index, {
        ...question,
        type,
        options: [],
        correct: true,
        pairs:
          question.pairs && question.pairs.length >= 2
            ? question.pairs
            : [
                { left: "", right: "" },
                { left: "", right: "" },
                { left: "", right: "" },
              ],
      });
      return;
    }
    const options =
      type === "cloze_multi"
        ? [...question.options, "", "", "", ""].slice(0, Math.max(4, question.options.length))
        : question.options.length >= 2
          ? question.options
          : ["", "", "", ""];
    const correct =
      type === "cloze_multi"
        ? Array.from({ length: countBlanks(question.prompt) }, () => -1)
        : typeof question.correct === "number"
          ? question.correct
          : 0;
    updateQuestion(index, {
      ...question,
      type,
      options,
      correct,
      pairs: [],
    });
  }

  function move(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((_, i) => i !== index));
  }

  function setOption(qIndex: number, oIndex: number, value: string) {
    const question = questions[qIndex];
    const options = question.options.map((option, i) => (i === oIndex ? value : option));
    updateQuestion(qIndex, { ...question, options });
  }

  function addOption(qIndex: number) {
    const question = questions[qIndex];
    if (question.options.length >= 12) return;
    updateQuestion(qIndex, {
      ...question,
      options: [...question.options, ""],
    });
  }

  function removeOption(qIndex: number, oIndex: number) {
    const question = questions[qIndex];
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, i) => i !== oIndex);

    if (Array.isArray(question.correct)) {
      // Više praznina: shift indekse; praznina koja je pokazivala na obrisanu
      // opciju ostaje prazna (-1) da nastavnik ponovo izabere.
      const correct = question.correct.map((value) => {
        if (value === oIndex) return -1;
        return value > oIndex ? value - 1 : value;
      });
      updateQuestion(qIndex, { ...question, options, correct });
      return;
    }

    const current = typeof question.correct === "number" ? question.correct : 0;
    let correct = current;
    if (oIndex === current) correct = 0;
    else if (oIndex < current) correct = current - 1;
    updateQuestion(qIndex, { ...question, options, correct });
  }

  /** Uskladi broj odgovora sa brojem praznina u tekstu, bez gubljenja unosa. */
  function syncBlankAnswers(qIndex: number, prompt: string): void {    const question = questions[qIndex];
    const length = countBlanks(prompt);
    const current = Array.isArray(question.correct) ? question.correct : [];
    const correct = Array.from(
      { length },
      (_, index) => current[index] ?? -1,
    );
    updateQuestion(qIndex, { ...question, prompt, correct });
  }

  function setBlankAnswer(qIndex: number, blankIndex: number, optionIndex: number) {
    const question = questions[qIndex];
    const current = Array.isArray(question.correct) ? [...question.correct] : [];
    while (current.length <= blankIndex) current.push(-1);
    // Ista riječ ne može stati u dvije praznine.
    const duplicate = current.indexOf(optionIndex);
    if (duplicate !== -1 && duplicate !== blankIndex) current[duplicate] = -1;
    current[blankIndex] = optionIndex;
    updateQuestion(qIndex, { ...question, correct: current });
  }

  function setPair(qIndex: number, pairIndex: number, side: "left" | "right", value: string) {
    const question = questions[qIndex];
    const pairs = (question.pairs ?? []).map((pair, i) =>
      i === pairIndex ? { ...pair, [side]: value } : pair,
    );
    updateQuestion(qIndex, { ...question, pairs });
  }

  function addPair(qIndex: number) {
    const question = questions[qIndex];
    const pairs = question.pairs ?? [];
    if (pairs.length >= 8) return;
    updateQuestion(qIndex, {
      ...question,
      pairs: [...pairs, { left: "", right: "" }],
    });
  }

  function removePair(qIndex: number, pairIndex: number) {
    const question = questions[qIndex];
    const pairs = (question.pairs ?? []).filter((_, i) => i !== pairIndex);
    if (pairs.length < 2) return;
    updateQuestion(qIndex, { ...question, pairs });
  }

  function movePair(qIndex: number, pairIndex: number, direction: -1 | 1) {
    const question = questions[qIndex];
    const pairs = [...(question.pairs ?? [])];
    const target = pairIndex + direction;
    if (target < 0 || target >= pairs.length) return;
    [pairs[pairIndex], pairs[target]] = [pairs[target], pairs[pairIndex]];
    updateQuestion(qIndex, { ...question, pairs });
  }

  function applyImport(mode: "append" | "replace") {
    const result = parseQuestions(importText);
    setImportErrors(result.errors);
    setImportedCount(result.questions.length);

    if (result.questions.length === 0) return;

    const imported: EditorQuestion[] = result.questions.map((question) => ({
      ...question,
      key: makeKey(),
    }));

    setQuestions((current) => {
      if (mode === "replace") return imported;
      // Početno prazno pitanje ne treba ostati uz uvezena.
      const meaningful = current.filter(
        (question) =>
          question.prompt.trim() ||
          (question.type !== "tf" && question.options.some((option) => option.trim())),
      );
      return [...meaningful, ...imported];
    });
    setImportText("");
    if (result.errors.length === 0) setImportOpen(false);
  }

  function validate(): string | null {
    if (!classId) return "Izaberi razred kojem pripada kviz.";
    if (title.trim().length < 3) return "Naziv kviza mora imati najmanje 3 znaka.";
    if (questions.length === 0) return "Dodaj najmanje jedno pitanje.";

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      if (!question.prompt.trim()) return `Pitanje ${index + 1}: tekst je obavezan.`;

      if (question.type === "tf") {
        if (typeof question.correct !== "boolean") {
          return `Pitanje ${index + 1}: izaberi Tačno ili Netačno.`;
        }
        continue;
      }

      if (question.type === "matching") {
        const pairs = (question.pairs ?? []).map((pair) => ({
          left: pair.left.trim(),
          right: pair.right.trim(),
        }));
        if (pairs.length < 2) {
          return `Pitanje ${index + 1}: povezivanje traži najmanje dva para.`;
        }
        if (pairs.some((pair) => !pair.left || !pair.right)) {
          return `Pitanje ${index + 1}: popuni obje strane svakog para.`;
        }
        const lefts = new Set(pairs.map((pair) => pair.left.toLocaleLowerCase("bs")));
        if (lefts.size !== pairs.length) {
          return `Pitanje ${index + 1}: dvije stavke s lijeve strane su iste.`;
        }
        const rights = new Set(pairs.map((pair) => pair.right.toLocaleLowerCase("bs")));
        if (rights.size !== pairs.length) {
          return `Pitanje ${index + 1}: dvije stavke s desne strane su iste.`;
        }
        continue;
      }

      const options = question.options.map((option) => option.trim());
      if (options.length < 2) {
        return `Pitanje ${index + 1}: potrebne su najmanje dvije opcije.`;
      }
      if (options.some((option) => !option)) {
        return `Pitanje ${index + 1}: popuni sve opcije ili obriši praznu.`;
      }

      if (question.type === "cloze_multi") {
        const blanks = countBlanks(question.prompt);
        if (blanks < 2) {
          return `Pitanje ${index + 1}: tekst treba najmanje dvije praznine (_____).`;
        }
        const answers = Array.isArray(question.correct) ? question.correct : [];
        if (answers.length !== blanks) {
          return `Pitanje ${index + 1}: ima ${blanks} praznina, a ${answers.length} odgovora.`;
        }
        for (let blankIndex = 0; blankIndex < blanks; blankIndex += 1) {
          const answer = answers[blankIndex];
          if (
            typeof answer !== "number" ||
            answer < 0 ||
            answer >= options.length
          ) {
            return `Pitanje ${index + 1}: za prazninu ${blankIndex + 1} izaberi riječ.`;
          }
        }
        const duplicate = answers.length !== new Set(answers).size;
        if (duplicate) {
          return `Pitanje ${index + 1}: ista riječ je tačna za dvije praznine.`;
        }
        continue;
      }

      if (
        typeof question.correct !== "number" ||
        question.correct < 0 ||
        question.correct >= options.length
      ) {
        return `Pitanje ${index + 1}: označi tačan odgovor.`;
      }
    }

    return null;
  }

  function save(intent: "save" | "start") {
    setError(null);
    setPendingIntent(intent);
    const validation = validate();
    if (validation) {
      setError(validation);
      setPendingIntent(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload = {
      id: savedId ?? undefined,
      classId,
      title: title.trim(),
      lesson: lesson.trim(),
      start: intent === "start",
      durationSeconds: duration,
      questions: questions.map((question) => {
        const prompt =
          question.type === "cloze" && !/_{2,}/.test(question.prompt)
            ? `${question.prompt.trim()} _____`
            : question.prompt.trim();

        if (question.type === "tf") {
          return {
            type: question.type,
            prompt,
            options: [] as string[],
            correct: Boolean(question.correct),
            pairs: [],
          };
        }

        if (question.type === "matching") {
          return {
            type: question.type,
            prompt,
            options: [] as string[],
            correct: true,
            pairs: (question.pairs ?? []).map((pair) => ({
              left: pair.left.trim(),
              right: pair.right.trim(),
            })),
          };
        }

        return {
          type: question.type,
          prompt,
          options: question.options.map((option) => option.trim()),
          correct: Array.isArray(question.correct)
            ? question.correct
            : Number(question.correct),
          pairs: [],
        };
      }),
    };

    startSaving(async () => {
      const result = await saveQuizAction(payload);
      if (!result.ok) {
        setError(result.error);
        setPendingIntent(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setSavedId(result.id);

      if (result.sessionId) {
        router.push(`/teacher/sessions/${result.sessionId}`);
        router.refresh();
        return;
      }

      if (result.sessionError) {
        router.replace(
          `/teacher/quizzes/${result.id}?error=${encodeURIComponent(
            `Kviz je sačuvan, ali test nije otvoren: ${result.sessionError}`,
          )}`,
        );
        return;
      }

      router.push("/teacher/quizzes");
      router.refresh();
    });
  }

  function runAiImport() {
    setAiError(null);
    setAiNotice(null);

    const formData = new FormData();
    if (aiFile) formData.set("file", aiFile);
    if (aiText.trim()) formData.set("text", aiText.trim());

    if (!aiFile && !aiText.trim()) {
      setAiError("Ubaci Word dokument ili zalijepi tekst pitanja.");
      return;
    }

    const hasContent =
      title.trim().length > 0 || questions.some((question) => question.prompt.trim());
    if (
      hasContent &&
      !window.confirm(
        "AI predlog će zamijeniti trenutni unos u editoru. Nastaviti?",
      )
    ) {
      return;
    }

    startAi(async () => {
      const result = await generateQuizFromFileAction(formData);
      if (!result.ok) {
        setAiError(result.error);
        return;
      }

      setTitle(result.draft.title);
      setLesson(result.draft.lesson);
      setQuestions(
        result.draft.questions.map((question, index) => ({
          ...question,
          key: `ai-${index}-${makeKey()}`,
        })),
      );
      setError(null);
      setImportOpen(false);

      const parts = [
        `AI je pripremio ${result.draft.questions.length} ${pluralBs(
          result.draft.questions.length,
          "pitanje",
          "pitanja",
          "pitanja",
        )} iz „${result.meta.sourceName}“.`,
      ];
      if (result.meta.inferredAnswers > 0) {
        parts.push(
          `${result.meta.inferredAnswers} ${pluralBs(
            result.meta.inferredAnswers,
            "odgovor",
            "odgovora",
            "odgovora",
          )} je AI predložio — provjeri ${result.meta.inferredAnswers === 1 ? "ga" : "ih"} prije čuvanja.`,
        );
      }
      if (result.meta.truncated) {
        parts.push("Dokument je skraćen na prvih 30.000 znakova.");
      }
      setAiNotice(parts.join(" "));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const totalPoints = questions.length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/teacher/quizzes"
            className="text-xs font-semibold text-muted hover:text-ink"
          >
            ← Kvizovi
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {initial ? "Uredi kviz" : "Novi kviz"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {questions.length} {pluralBs(questions.length, "pitanje", "pitanja", "pitanja")} ·{" "}
            {totalPoints} {pluralBs(totalPoints, "bod", "boda", "bodova")} · oko{" "}
            {Math.max(1, Math.ceil(questions.length * 0.8))} min
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/teacher/quizzes" className="btn btn-secondary">
            Odustani
          </Link>
          {initial?.locked ? (
            <form action={startQuizSessionAction}>
              <input type="hidden" name="quizId" value={initial.id} />
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="duration" value={duration} />
              <input
                type="hidden"
                name="fallback"
                value={`/teacher/quizzes/${initial.id}`}
              />
              <button
                type="submit"
                disabled={!classId}
                className="btn btn-primary"
              >
                <Play className="h-4 w-4" />
                Otvori test
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => save("save")}
                disabled={saving || aiPending}
                className="btn btn-secondary"
              >
                {saving && pendingIntent === "save" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving && pendingIntent === "save" ? "Čuvam…" : "Sačuvaj"}
              </button>
              <button
                type="button"
                onClick={() => save("start")}
                disabled={saving || aiPending}
                className="btn btn-primary"
              >
                {saving && pendingIntent === "start" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {saving && pendingIntent === "start"
                  ? "Otvaram…"
                  : "Sačuvaj i otvori test"}
              </button>
            </>
          )}
        </div>
      </div>

      {!initial ? (
        aiEnabled ? (
        <div className="mb-5 border border-rule bg-lift p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Ubaci test — AI pripremi pitanja</h2>
              <p className="mt-0.5 max-w-[62ch] font-sans text-xs leading-relaxed text-muted">
                Ubaci Word dokument, .txt ili zalijepi tekst. AI predlaže 5
                pitanja (do 10 ako ih dokument ima više) i tačne odgovore.
                Ti ih pregledaš prije čuvanja.
              </p>
            </div>
            <span className="badge border-forest/30 bg-forest-wash text-forest-deep">
              <Sparkles className="h-3 w-3" />
              AI predlog
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <span className="label">Word dokument</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => aiFileRef.current?.click()}
                  className="btn btn-secondary"
                >
                  <Upload className="h-4 w-4" />
                  {aiFile ? "Drugi fajl" : "Izaberi fajl"}
                </button>
                <input
                  ref={aiFileRef}
                  type="file"
                  accept=".docx,.txt,.md"
                  className="sr-only"
                  onChange={(event) =>
                    setAiFile(event.target.files?.[0] ?? null)
                  }
                />
                <span className="min-w-0 max-w-[16rem] truncate font-sans text-xs text-muted">
                  {aiFile ? aiFile.name : ".docx, .txt ili .md"}
                </span>
                {aiFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAiFile(null);
                      if (aiFileRef.current) aiFileRef.current.value = "";
                    }}
                    className="link"
                  >
                    Ukloni
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="ai-text" className="label">
                Ili zalijepi tekst
              </label>
              <textarea
                id="ai-text"
                value={aiText}
                onChange={(event) => setAiText(event.target.value)}
                rows={3}
                className="textarea min-h-[4.5rem] text-xs"
                placeholder="Zalijepi pitanja ili tekst lekcije…"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[52ch] text-[0.72rem] leading-relaxed text-muted">
              Ako dokument nema odgovore, AI ih predlaže i označava za
              provjeru. Ništa se ne čuva dok ne pritisneš „Sačuvaj“. Dokument
              se šalje AI servisu samo radi izrade predloga.
            </p>
            <button
              type="button"
              onClick={runAiImport}
              disabled={aiPending}
              className="btn btn-primary"
            >
              {aiPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {aiPending ? "AI čita…" : "AI pripremi test"}
            </button>
          </div>

          {aiError ? (
            <p
              role="alert"
              className="mt-3 border-l-2 border-pencil bg-pencil-wash px-3 py-2 font-sans text-xs text-pencil"
            >
              {aiError}
            </p>
          ) : null}
        </div>
        ) : (
          <div className="mb-5 border-l-2 border-rule bg-ink-wash px-4 py-3 font-sans text-sm leading-relaxed text-ink-soft">
            AI uvoz nije podešen na serveru. Ručni unos i šablonski uvoz rade
            normalno. Administrator može dodati <code>DEEPSEEK_API_KEY</code> u
            Vercel.
          </div>
        )
      ) : null}

      {aiNotice ? (
        <div className="mb-4 border-l-2 border-forest bg-forest-wash px-4 py-2.5 font-sans text-sm leading-relaxed text-forest-deep">
          {aiNotice}
        </div>
      ) : null}

      {initial?.locked ? (
        <div className="mb-4 flex items-start gap-2 rounded-sm border border-rule bg-ink-wash px-3.5 py-2.5 text-sm text-ink-soft">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ovaj kviz je već korišten u testu. Izmjene nisu dozvoljene da bi
            historija rezultata ostala tačna — duplikuj kviz i mijenjaj kopiju.
          </span>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-sm border border-pencil/40 bg-pencil-wash px-3.5 py-2.5 text-sm text-pencil"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="card mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <label htmlFor="title" className="label">
              Naziv kviza
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input"
              placeholder="npr. Uvod u hadiske znanosti"
              dir="auto"
            />
          </div>
          <div>
            <label htmlFor="lesson" className="label">
              Lekcija (opciono)
            </label>
            <input
              id="lesson"
              value={lesson}
              onChange={(event) => setLesson(event.target.value)}
              className="input"
              placeholder="npr. Lekcija 1 — definicija"
              dir="auto"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <label htmlFor="classId" className="label">
              Razred
            </label>
            <select
              id="classId"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="select"
              disabled={Boolean(initial?.locked) || classes.length === 0}
            >
              <option value="">Izaberi razred</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            {classes.length === 0 ? (
              <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">
                Prvo dodaj odjeljenje, pa se vrati na kviz.{" "}
                <Link href="/teacher/classes" className="link">
                  Otvori odjeljenja
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">
                Kviz se pokreće samo u ovom razredu. Za drugi razred napravi
                kopiju.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="duration" className="label">
              Trajanje testa
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="select"
            >
              <option value="180">3 min</option>
              <option value="300">5 min</option>
              <option value="360">6 min</option>
              <option value="600">10 min</option>
            </select>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">
              Tajmer kreće tek kad pritisneš „Počni“ u testu.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans text-xs text-muted">
          Bodovi se sabiraju: 1 pitanje = 1 bod
        </p>
        <button
          type="button"
          onClick={() => setImportOpen((open) => !open)}
          className="link"
        >
          {importOpen ? "Zatvori uvoz iz teksta" : "Uvezi pitanja iz teksta"}
        </button>
      </div>

      {importOpen ? (
        <div className="mb-5 border border-rule bg-lift p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Uvoz pitanja iz teksta</h2>
              <p className="mt-0.5 font-sans text-xs text-muted">
                Prazan red razdvaja pitanja. Primjer šablona je ispod.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="btn btn-ghost !p-1"
              aria-label="Zatvori uvoz"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="quiz-import" className="label !mb-0">
              Pitanja
            </label>
            <button
              type="button"
              onClick={() => setImportText(IMPORT_EXAMPLE)}
              className="link self-start sm:self-auto"
            >
              Upiši primjer u polje
            </button>
          </div>

          <textarea
            id="quiz-import"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={8}
            className="textarea mt-1.5 font-mono text-xs"
            placeholder={IMPORT_EXAMPLE}
            dir="auto"
            aria-describedby="quiz-import-help"
          />
          <p
            id="quiz-import-help"
            className="mt-1.5 text-[0.72rem] leading-relaxed text-muted"
          >
            Svako pitanje počinje brojem. Opcije napiši kao A), B), C) i dodaj
            red Tačno: A. Za tačno/netačno napiši Tačno: T ili Tačno: N. Za
            dopunu stavi _____ u pitanje, navedi Riječi: a, b, c i napiši red
            Tačno: a. Za tekst sa više praznina stavi _____ (1), _____ (2)…
            i napiši red Praznine: riječ1; riječ2; … — redom po prazninama.
            Za povezivanje napiši parove kao 1) arap. izraz = prijevod, svaki
            u svom redu (najviše osam parova).
          </p>

          {importErrors.length > 0 ? (
            <ul className="mt-2 space-y-1 font-sans text-xs text-pencil">
              {importErrors.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : null}
          {importedCount !== null && importErrors.length === 0 ? (
            <p className="mt-2 font-sans text-xs text-forest">
              Uvezeno pitanja: {importedCount}.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyImport("append")}
              className="btn btn-primary"
              disabled={!importText.trim()}
            >
              Dodaj pitanja
            </button>
            <button
              type="button"
              onClick={() => applyImport("replace")}
              className="btn btn-secondary"
              disabled={!importText.trim()}
            >
              Zamijeni sva pitanja
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.key} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xs bg-forest-wash text-xs font-bold text-forest-deep">
                {index + 1}
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={question.type}
                  onChange={(event) =>
                    changeType(index, event.target.value as QuestionType)
                  }
                  className="select !w-auto !py-1.5 text-xs !pr-7"
                  aria-label={`Tip pitanja ${index + 1}`}
                >
                  {(Object.keys(TYPE_LABELS) as QuestionType[]).map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="btn btn-ghost !min-h-8 !p-1.5"
                  aria-label="Pomjeri gore"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === questions.length - 1}
                  className="btn btn-ghost !min-h-8 !p-1.5"
                  aria-label="Pomjeri dolje"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  disabled={questions.length === 1}
                  className="btn btn-ghost !min-h-8 !p-1.5 hover:text-pencil"
                  aria-label="Obriši pitanje"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <textarea
              value={question.prompt}
              onChange={(event) => {
                if (question.type === "cloze_multi") {
                  syncBlankAnswers(index, event.target.value);
                } else {
                  updateQuestion(index, { ...question, prompt: event.target.value });
                }
              }}
              rows={question.type === "cloze_multi" ? 5 : question.type === "cloze" ? 3 : 2}
              className="textarea mt-3"
              dir="auto"
              placeholder={
                question.type === "cloze_multi"
                  ? "Tekst hadisa sa prazninama: _____ (1) … _____ (2) …"
                  : question.type === "matching"
                    ? "Uputa, npr. Poveži arapski izraz s prijevodom."
                    : question.type === "cloze"
                      ? "Tekst sa _____ na mjestu praznine…"
                      : "Tekst pitanja…"
              }
            />

            {question.type === "cloze_multi" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.72rem] text-muted">
                <span>
                  Praznine:{" "}
                  <strong className="text-ink">{countBlanks(question.prompt)}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Odgovoreno:{" "}
                  <strong className="text-ink">
                    {(Array.isArray(question.correct) ? question.correct : []).filter(
                      (value) => value >= 0,
                    ).length}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateQuestion(index, {
                      ...question,
                      prompt: renumberBlankLabels(question.prompt),
                    })
                  }
                  className="ml-auto font-semibold text-forest hover:text-forest-deep"
                >
                  Pobroji praznine (1), (2)…
                </button>
              </div>
            ) : null}

            {question.type === "tf" ? (
              <div className="mt-3 flex gap-2">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() =>
                      updateQuestion(index, { ...question, correct: value })
                    }
                    className={clsx(
                      "flex-1 rounded-sm border px-4 py-2.5 text-sm font-semibold transition-colors",
                      question.correct === value
                        ? "border-forest bg-forest-wash text-forest-deep"
                        : "border-rule bg-lift text-muted hover:border-forest/30",
                    )}
                  >
                    {value ? "Tačno" : "Netačno"}
                  </button>
                ))}
              </div>
            ) : question.type === "matching" ? (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[0.72rem] font-semibold text-muted">
                    Parovi — učenik na testu ne vidi ovaj redoslijed desno
                  </p>
                  <span className="font-data text-[0.7rem] text-muted">
                    {(question.pairs ?? []).length}{" "}
                    {(question.pairs ?? []).length === 1 ? "bod" : "boda"}
                  </span>
                </div>
                <div className="space-y-2">
                  {(question.pairs ?? []).map((pair, pairIndex) => (
                    <div key={pairIndex} className="flex items-start gap-2">
                      <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center border border-rule bg-paper font-data text-[0.7rem] text-muted">
                        {pairIndex + 1}
                      </span>
                      <input
                        value={pair.left}
                        onChange={(event) =>
                          setPair(index, pairIndex, "left", event.target.value)
                        }
                        className="input"
                        dir="auto"
                        placeholder="Lijevo — npr. arapski izraz"
                        aria-label={`Par ${pairIndex + 1}, lijevo`}
                      />
                      <span className="mt-2.5 text-muted" aria-hidden="true">
                        =
                      </span>
                      <input
                        value={pair.right}
                        onChange={(event) =>
                          setPair(index, pairIndex, "right", event.target.value)
                        }
                        className="input"
                        dir="auto"
                        placeholder="Desno — npr. prijevod"
                        aria-label={`Par ${pairIndex + 1}, desno`}
                      />
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => movePair(index, pairIndex, -1)}
                          disabled={pairIndex === 0}
                          className="btn btn-ghost !min-h-7 !p-1"
                          aria-label="Pomjeri par gore"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePair(index, pairIndex, 1)}
                          disabled={pairIndex === (question.pairs ?? []).length - 1}
                          className="btn btn-ghost !min-h-7 !p-1"
                          aria-label="Pomjeri par dolje"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePair(index, pairIndex)}
                        disabled={(question.pairs ?? []).length <= 2}
                        className="btn btn-ghost !min-h-7 !p-1 hover:text-pencil"
                        aria-label="Obriši par"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {(question.pairs ?? []).length < 8 ? (
                  <button
                    type="button"
                    onClick={() => addPair(index)}
                    className="mt-2 text-xs font-semibold text-forest hover:text-forest-deep"
                  >
                    + Dodaj par
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-[0.72rem] font-semibold text-muted">
                  {question.type === "cloze_multi"
                    ? "Banka riječi — tačne i netačne, izmiješane"
                    : question.type === "cloze"
                      ? "Ponuđene riječi — označi tačnu"
                      : "Opcije — označi tačnu"}
                </p>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const selected =
                      question.type === "cloze_multi"
                        ? (Array.isArray(question.correct)
                            ? question.correct
                            : []
                          ).includes(optionIndex)
                        : question.correct === optionIndex;
                    return (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuestion(index, withCorrect(question, optionIndex))}
                          disabled={question.type === "cloze_multi"}
                          className={clsx(
                            "grid h-8 w-8 shrink-0 place-items-center border font-data text-xs transition-colors",
                            selected
                              ? "border-forest bg-forest text-paper"
                              : "border-rule bg-lift text-muted hover:border-forest/50",
                            question.type === "cloze_multi" &&
                              "cursor-default hover:border-rule",
                          )}
                          aria-label={
                            question.type === "cloze_multi"
                              ? "Tačne riječi se biraju dolje, po prazninama"
                              : `Označi ${LETTERS[optionIndex]} kao tačan odgovor`
                          }
                          aria-pressed={selected}
                          tabIndex={question.type === "cloze_multi" ? -1 : 0}
                        >
                          {selected ? "•" : LETTERS[optionIndex]}
                        </button>
                        <input
                          value={option}
                          onChange={(event) =>
                            setOption(index, optionIndex, event.target.value)
                          }
                          className="input"
                          dir="auto"
                          placeholder={
                            question.type === "cloze"
                              ? `Riječ ${optionIndex + 1}`
                              : `Opcija ${LETTERS[optionIndex]}`
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(index, optionIndex)}
                          disabled={question.options.length <= 2}
                          className="btn btn-ghost !min-h-8 !p-1.5 hover:text-pencil"
                          aria-label="Obriši opciju"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {question.options.length < 12 ? (
                  <button
                    type="button"
                    onClick={() => addOption(index)}
                    className="mt-2 text-xs font-semibold text-forest hover:text-forest-deep"
                  >
                    + Dodaj opciju
                  </button>
                ) : null}

                {question.type === "cloze_multi" ? (
                  <div className="mt-4 border-t border-rule-soft pt-3">
                    <p className="mb-2 text-[0.72rem] font-semibold text-muted">
                      Tačna riječ za svaku prazninu — redom kako se pojavljuju u
                      tekstu
                    </p>
                    {countBlanks(question.prompt) === 0 ? (
                      <p className="text-xs text-pencil">
                        U tekstu još nema praznina. Napiši _____ na mjesta gdje
                        nedostaje riječ.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Array.from({ length: countBlanks(question.prompt) }).map(
                          (_, blankIndex) => {
                            const answers = Array.isArray(question.correct)
                              ? question.correct
                              : [];
                            const selected = answers[blankIndex] ?? -1;
                            const usedElsewhere = answers.filter(
                              (value, i) => value >= 0 && i !== blankIndex,
                            );
                            return (
                              <div
                                key={blankIndex}
                                className="flex items-center gap-2"
                              >
                                <span className="grid h-8 w-8 shrink-0 place-items-center border border-rule bg-paper font-data text-xs text-muted">
                                  {blankIndex + 1}
                                </span>
                                <select
                                  value={selected}
                                  onChange={(event) =>
                                    setBlankAnswer(
                                      index,
                                      blankIndex,
                                      Number(event.target.value),
                                    )
                                  }
                                  dir="auto"
                                  className="input"
                                >
                                  <option value={-1}>— izaberi riječ —</option>
                                  {question.options.map((option, optionIndex) => (
                                    <option
                                      key={optionIndex}
                                      value={optionIndex}
                                      disabled={
                                        !option.trim() ||
                                        usedElsewhere.includes(optionIndex)
                                      }
                                    >
                                      {option.trim() || `Opcija ${LETTERS[optionIndex]}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setQuestions((current) => [...current, blankQuestion("single")])}
          className="btn btn-secondary"
        >
          <Plus className="h-4 w-4" />
          Dodaj pitanje
        </button>
        {initial?.locked ? (
          <form action={startQuizSessionAction}>
            <input type="hidden" name="quizId" value={initial.id} />
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="duration" value={duration} />
            <input
              type="hidden"
              name="fallback"
              value={`/teacher/quizzes/${initial.id}`}
            />
            <button type="submit" disabled={!classId} className="btn btn-primary">
              <Play className="h-4 w-4" />
              Otvori test
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => save("save")}
              disabled={saving || aiPending}
              className="btn btn-secondary"
            >
              {saving && pendingIntent === "save" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving && pendingIntent === "save" ? "Čuvam…" : "Sačuvaj"}
            </button>
            <button
              type="button"
              onClick={() => save("start")}
              disabled={saving || aiPending}
              className="btn btn-primary"
            >
              {saving && pendingIntent === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {saving && pendingIntent === "start"
                ? "Otvaram…"
                : "Sačuvaj i otvori test"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

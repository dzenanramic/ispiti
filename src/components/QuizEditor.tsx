"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { saveQuizAction } from "@/app/actions/quizzes";
import { parseQuestions } from "@/lib/parse-questions";
import type { QuestionInput, QuestionType } from "@/lib/types";

type EditorQuestion = QuestionInput & { key: string };

type InitialQuiz = {
  id: string;
  title: string;
  lesson: string;
  questions: QuestionInput[];
  locked?: boolean;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single: "Jedan tačan odgovor",
  tf: "Tačno / Netačno",
  cloze: "Dopuna (ponuđene riječi)",
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

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

export function QuizEditor({ initial }: { initial: InitialQuiz | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lesson, setLesson] = useState(initial?.lesson ?? "");
  const [questions, setQuestions] = useState<EditorQuestion[]>(
    initial
      ? initial.questions.map((question, index) => ({
          ...question,
          key: `initial-${index}`,
        }))
      : [blankQuestion("single")],
  );
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();

  function updateQuestion(index: number, next: EditorQuestion) {
    setQuestions((current) =>
      current.map((question, i) => (i === index ? next : question)),
    );
  }

  function changeType(index: number, type: QuestionType) {
    const question = questions[index];
    if (type === "tf") {
      updateQuestion(index, { ...question, type, options: [], correct: true });
      return;
    }
    const options =
      question.options.length >= 2 ? question.options : ["", "", "", ""];
    updateQuestion(index, {
      ...question,
      type,
      options,
      correct: typeof question.correct === "number" ? question.correct : 0,
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
    if (question.options.length >= 8) return;
    updateQuestion(qIndex, {
      ...question,
      options: [...question.options, ""],
    });
  }

  function removeOption(qIndex: number, oIndex: number) {
    const question = questions[qIndex];
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, i) => i !== oIndex);
    const current = typeof question.correct === "number" ? question.correct : 0;
    let correct = current;
    if (oIndex === current) correct = 0;
    else if (oIndex < current) correct = current - 1;
    updateQuestion(qIndex, { ...question, options, correct });
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

      const options = question.options.map((option) => option.trim());
      if (options.length < 2) {
        return `Pitanje ${index + 1}: potrebne su najmanje dvije opcije.`;
      }
      if (options.some((option) => !option)) {
        return `Pitanje ${index + 1}: popuni sve opcije ili obriši praznu.`;
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

  function save() {
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload = {
      id: initial?.id,
      title: title.trim(),
      lesson: lesson.trim(),
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
          };
        }

        return {
          type: question.type,
          prompt,
          options: question.options.map((option) => option.trim()),
          correct: Number(question.correct),
        };
      }),
    };

    startSaving(async () => {
      const result = await saveQuizAction(payload);
      if (!result.ok) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push("/teacher/quizzes");
      router.refresh();
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
        <div className="flex gap-2">
          <Link href="/teacher/quizzes" className="btn btn-secondary">
            Odustani
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Čuvam…" : "Sačuvaj kviz"}
          </button>
        </div>
      </div>

      {initial?.locked ? (
        <div className="mb-4 flex items-start gap-2 rounded-sm border border-rule bg-amber-soft px-3.5 py-2.5 text-sm text-ink-soft">
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
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setQuestions((current) => [...current, blankQuestion("single")])}
          className="btn btn-secondary"
        >
          <Plus className="h-4 w-4" />
          Dodaj pitanje
        </button>
        <button
          type="button"
          onClick={() => setImportOpen((open) => !open)}
          className="btn btn-ghost"
        >
          <FileText className="h-4 w-4" />
          Uvezi iz teksta
        </button>
        <span className="ml-auto hidden text-xs text-muted sm:block">
          Bodovi se sabiraju: 1 pitanje = 1 bod
        </span>
      </div>

      {importOpen ? (
        <div className="card mb-5 border-forest/20 bg-forest-wash/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Uvoz pitanja iz teksta</h2>
              <p className="mt-0.5 text-xs text-muted">
                Zalijepi pitanja u šablonu ispod. Prazan red razdvaja pitanja.
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

          <pre className="mt-3 overflow-x-auto rounded-sm border border-rule bg-lift p-3 text-[0.72rem] leading-relaxed text-muted">
{`1. Koji su osnovni dijelovi hadisa?
A) Isnad i matn
B) Sened i šerh
C) Matn i tefsir
Tačno: A

2. Hadis je riječ, djelo ili odobrenje Poslanika.
Tačno: T

3. Lanac prenosilaca naziva se _____.
Riječi: isnad, matn, šerh, tefsir
Tačno: isnad`}
          </pre>

          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={9}
            className="textarea mt-3 font-mono text-xs"
            placeholder="Zalijepi tekst ovdje…"
            dir="auto"
          />

          {importErrors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-pencil">
              {importErrors.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : null}
          {importedCount !== null && importErrors.length === 0 ? (
            <p className="mt-2 text-xs font-medium text-forest">
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
              onChange={(event) =>
                updateQuestion(index, { ...question, prompt: event.target.value })
              }
              rows={question.type === "cloze" ? 3 : 2}
              className="textarea mt-3"
              dir="auto"
              placeholder={
                question.type === "cloze"
                  ? "Tekst sa _____ na mjestu praznine…"
                  : "Tekst pitanja…"
              }
            />

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
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-[0.72rem] font-semibold text-muted">
                  {question.type === "cloze"
                    ? "Ponuđene riječi — označi tačnu"
                    : "Opcije — označi tačnu"}
                </p>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = question.correct === optionIndex;
                    return (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuestion(index, withCorrect(question, optionIndex))}
                          className={clsx(
                            "grid h-8 w-8 shrink-0 place-items-center border font-data text-xs transition-colors",
                            selected
                              ? "border-forest bg-forest text-paper"
                              : "border-rule bg-lift text-muted hover:border-forest/50",
                          )}
                          aria-label={`Označi ${LETTERS[optionIndex]} kao tačan odgovor`}
                          aria-pressed={selected}
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
                {question.options.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => addOption(index)}
                    className="mt-2 text-xs font-semibold text-forest hover:text-forest-deep"
                  >
                    + Dodaj opciju
                  </button>
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
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Čuvam…" : "Sačuvaj kviz"}
        </button>
      </div>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  RotateCw,
  Search,
  Send,
  Timer,
  UserRound,
  WifiOff,
} from "lucide-react";
import { clsx } from "clsx";
import { formatDuration } from "@/lib/format";
import { splitClozePrompt } from "@/lib/parse-questions";

type Phase =
  | "loading"
  | "error"
  | "pick"
  | "lobby"
  | "active"
  | "submitted"
  | "closed";

type Student = { id: string; name: string; taken: boolean };

type JoinResponse = {
  session: {
    code: string;
    status: string;
    joinLocked: boolean;
    quizTitle: string;
    className: string;
    durationSeconds: number;
    endsAt: string | null;
    serverNow: number;
  };
  students: Student[];
  me: { token: string; studentId: string; status: string } | null;
};

type AttemptQuestion = {
  id: string;
  type: "tf" | "single" | "cloze";
  prompt: string;
  options: string[];
  position: number;
};

type AttemptResponse = {
  status: "active" | "lobby" | "submitted" | "closed";
  quizTitle: string;
  studentName: string;
  className: string;
  code: string;
  endsAt?: string | null;
  serverNow?: number;
  durationSeconds?: number;
  questions?: AttemptQuestion[];
  saved?: { questionId: string; value: boolean | number }[];
};

type AnswerValue = boolean | number;

const ARABIC_RE = /[\u0600-\u06FF]/;

function isArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

function deviceStorageKey(): string {
  return "ispiti_device";
}

function attemptStorageKey(code: string): string {
  return `ispiti_attempt_${code}`;
}

function readDeviceToken(): string | null {
  const existing = window.localStorage.getItem(deviceStorageKey());
  if (existing) return existing;
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  window.localStorage.setItem(deviceStorageKey(), token);
  return token;
}

function typeLabel(type: AttemptQuestion["type"]): string {
  if (type === "tf") return "Tačno / netačno";
  if (type === "cloze") return "Dopuni";
  return "Jedan odgovor";
}

export function StudentApp({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [join, setJoin] = useState<JoinResponse | null>(null);
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [deviceToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readDeviceToken(),
  );
  const [attemptToken, setAttemptToken] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(attemptStorageKey(code)),
  );
  const [selected, setSelected] = useState<Student | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [now, setNow] = useState(() => Date.now());

  const [clockOffset, setClockOffset] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const submittedRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSaves = useRef(0);
  const failedAnswers = useRef<Map<string, AnswerValue>>(new Map());

  const questions = attempt?.questions ?? [];
  const answeredCount = questions.filter((question) =>
    Object.prototype.hasOwnProperty.call(answers, question.id),
  ).length;

  const remainingMs = deadline
    ? Math.max(0, deadline - (now + clockOffset))
    : null;
  const remainingSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  const loadAttempt = useCallback(
    async (token: string) => {
      try {
        const response = await fetch(`/api/attempt/${token}`, { cache: "no-store" });
        if (response.status === 404) {
          window.localStorage.removeItem(attemptStorageKey(code));
          setAttemptToken(null);
          setPhase("pick");
          return;
        }
        const data = (await response.json()) as AttemptResponse;

        if (data.status === "submitted") {
          submittedRef.current = true;
          setAttempt(data);
          setPhase("submitted");
          return;
        }
        if (data.status === "closed") {
          setPhase("closed");
          return;
        }
        if (data.status === "lobby") {
          setAttempt(data);
          setPhase("lobby");
          return;
        }

        setClockOffset((data.serverNow ?? Date.now()) - Date.now());
        setDeadline(data.endsAt ? new Date(data.endsAt).getTime() : null);
        setAttempt(data);
        setAnswers((previous) => {
          const next = { ...previous };
          for (const saved of data.saved ?? []) {
            if (!Object.prototype.hasOwnProperty.call(next, saved.questionId)) {
              next[saved.questionId] = saved.value;
            }
          }
          return next;
        });
        setPhase("active");
      } catch {
        setError("Veza je prekinuta. Osvježi stranicu.");
      }
    },
    [code],
  );

  const refreshJoin = useCallback(async () => {
    if (!deviceToken) return;
    try {
      const response = await fetch(
        `/api/join/${code}?device=${encodeURIComponent(deviceToken)}`,
        { cache: "no-store" },
      );
      if (response.status === 404) {
        setError("Test sa tim kodom ne postoji. Provjeri kod kod nastavnika.");
        setPhase("error");
        return;
      }
      const data = (await response.json()) as JoinResponse;
      setJoin(data);

      if (data.me) {
        window.localStorage.setItem(attemptStorageKey(code), data.me.token);
        setAttemptToken(data.me.token);
        await loadAttempt(data.me.token);
        return;
      }

      if (data.session.status === "closed") {
        setPhase("closed");
        return;
      }

      if (data.session.joinLocked) {
        setError("Nastavnik je zaključao ulaz u ovaj test.");
        setPhase("error");
        return;
      }

      setPhase("pick");
    } catch {
      setError("Ne mogu se povezati. Provjeri internet.");
    }
  }, [code, deviceToken, loadAttempt]);

  // Prvo učitavanje i ulazak u sesiju.
  useEffect(() => {
    if (!deviceToken) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- učitavanje sa servera
    void refreshJoin();
  }, [deviceToken, refreshJoin]);

  // Periodično osvježavanje: spisak u lobby fazi, stanje testa u toku.
  useEffect(() => {
    if (!deviceToken) return;

    if (phase === "pick") {
      const timer = window.setInterval(() => void refreshJoin(), 3000);
      return () => window.clearInterval(timer);
    }

    if ((phase === "lobby" || phase === "active") && attemptToken) {
      const timer = window.setInterval(() => void loadAttempt(attemptToken), 3000);
      return () => window.clearInterval(timer);
    }
  }, [phase, deviceToken, attemptToken, refreshJoin, loadAttempt]);

  // Sat za tajmer.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  async function claim(student: Student) {
    if (!deviceToken) return;
    setClaiming(true);
    setError(null);

    try {
      const response = await fetch(`/api/join/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, deviceToken }),
      });
      const data = (await response.json()) as { token?: string; error?: string };

      if (!response.ok || !data.token) {
        setError(data.error ?? "Nije moguće ući u test.");
        setSelected(null);
        await refreshJoin();
        return;
      }

      window.localStorage.setItem(attemptStorageKey(code), data.token);
      setAttemptToken(data.token);
      setSelected(null);
      await loadAttempt(data.token);
    } catch {
      setError("Veza je prekinuta. Pokušaj ponovo.");
    } finally {
      setClaiming(false);
    }
  }

  function saveAnswer(question: AttemptQuestion, value: AnswerValue) {
    if (!attemptToken) return;
    setAnswers((previous) => ({ ...previous, [question.id]: value }));
    setSaveState("saving");
    pendingSaves.current += 1;

    queueRef.current = queueRef.current.then(async () => {
      try {
        const response = await fetch(`/api/attempt/${attemptToken}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: question.id, value }),
        });
        if (!response.ok) throw new Error("save");
        failedAnswers.current.delete(question.id);
      } catch {
        failedAnswers.current.set(question.id, value);
      } finally {
        pendingSaves.current -= 1;
        if (pendingSaves.current === 0) {
          setSaveState(failedAnswers.current.size > 0 ? "error" : "saved");
        }
      }
    });
  }

  async function retrySaves() {
    if (!attemptToken) return;
    setSaveState("saving");
    for (const [questionId, value] of [...failedAnswers.current.entries()]) {
      try {
        const response = await fetch(`/api/attempt/${attemptToken}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, value }),
        });
        if (!response.ok) throw new Error("save");
        failedAnswers.current.delete(questionId);
      } catch {
        // Ostaje u mapi za sljedeći pokušaj.
      }
    }
    setSaveState(failedAnswers.current.size > 0 ? "error" : "saved");
  }

  const submit = useCallback(
    async (auto: boolean) => {
      if (!attemptToken || submitting || submittedRef.current) return;

      if (!auto) {
        const unanswered = questions.length - answeredCount;
        if (
          unanswered > 0 &&
          !window.confirm(
            `Imaš ${unanswered} neodgovorenih pitanja. Predati test ipak?`,
          )
        ) {
          return;
        }
      }

      submittedRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        const response = await fetch(`/api/attempt/${attemptToken}/submit`, {
          method: "POST",
        });
        if (!response.ok) throw new Error("submit");
        setPhase("submitted");
      } catch {
        submittedRef.current = false;
        setError("Predaja nije uspjela. Provjeri internet i pokušaj ponovo.");
        setSubmitting(false);
      }
    },
    [attemptToken, submitting, questions.length, answeredCount],
  );

  // Automatska predaja kad istekne vrijeme.
  useEffect(() => {
    if (phase !== "active" || remainingMs === null) return;
    if (remainingMs <= 0 && !submittedRef.current) {
      void submit(true);
    }
  }, [phase, remainingMs, submit]);

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("bs");
    if (!needle) return join?.students ?? [];
    return (join?.students ?? []).filter((student) =>
      student.name.toLocaleLowerCase("bs").includes(needle),
    );
  }, [join?.students, query]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-white/70">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white">
              <UserRound className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Ispiti</span>
          </div>
          <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-muted">
            {code}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-5">
        {phase === "loading" ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="mt-3 text-sm">Učitavam test…</p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="card p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-danger" />
            <h1 className="mt-3 text-lg font-semibold">Test nije dostupan</h1>
            <p className="mt-1.5 text-sm text-muted">
              {error ?? "Provjeri kod kod nastavnika."}
            </p>
          </div>
        ) : null}

        {phase === "closed" ? (
          <div className="card p-6 text-center">
            <Clock className="mx-auto h-9 w-9 text-muted" />
            <h1 className="mt-3 text-lg font-semibold">Test je završen</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Vrijeme za ovaj test je prošlo. Ako si predao odgovore, oni su
              sačuvani.
            </p>
          </div>
        ) : null}

        {phase === "submitted" ? (
          <div className="card p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Test je predan</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Odgovori su sačuvani. Ne možeš ih više mijenjati.
              <br />
              Možeš zatvoriti stranicu.
            </p>
            {attempt?.studentName ? (
              <p className="mt-4 text-xs text-muted">{attempt.studentName}</p>
            ) : null}
          </div>
        ) : null}

        {phase === "pick" && join ? (
          <div>
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
                {join.session.className}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                {join.session.quizTitle}
              </h1>
              <p className="mt-1 text-sm text-muted">Izaberi svoje ime sa spiska.</p>
            </div>

            {join.session.status === "active" ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-soft px-3 py-2 text-xs text-amber-900">
                <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Test je već počeo — pridruži se odmah, vrijeme ide.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-danger-soft px-3 py-2 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            ) : null}

            {(join.students?.length ?? 0) > 10 ? (
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input pl-9"
                  placeholder="Traži ime…"
                  autoComplete="off"
                />
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  disabled={student.taken || claiming}
                  onClick={() => setSelected(student)}
                  className={clsx(
                    "flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    student.taken
                      ? "cursor-not-allowed border-line bg-paper text-muted opacity-70"
                      : "border-line bg-white font-medium hover:border-brand/40 hover:bg-brand-soft/30",
                  )}
                >
                  <span className="min-w-0 truncate">{student.name}</span>
                  {student.taken ? (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-muted">
                      zauzeto
                    </span>
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                  )}
                </button>
              ))}
            </div>

            {filteredStudents.length === 0 ? (
              <p className="mt-4 text-center text-sm text-muted">
                Nema imena koja odgovaraju pretrazi.
              </p>
            ) : null}

            <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
              Ime se veže za ovaj telefon za vrijeme testa i ne može se mijenjati.
              Ako pogriješiš, javi nastavniku.
            </p>
          </div>
        ) : null}

        {phase === "lobby" ? (
          <div className="card p-8 text-center">
            <span className="relative mx-auto flex h-14 w-14 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-soft" />
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
                <Timer className="h-6 w-6" />
              </span>
            </span>
            <h1 className="mt-5 text-xl font-semibold">Sačekaj početak</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Nastavnik će pokrenuti test. Tajmer kreće za sve u isto vrijeme.
            </p>
            <div className="mt-5 rounded-xl border border-line bg-paper/60 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Prijavljen kao
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {attempt?.studentName ?? "—"}
              </p>
            </div>
            <p className="mt-4 text-[11px] text-muted">
              Ne zatvaraj stranicu. Kada test počne, pitanja se pojavljuju sama.
            </p>
          </div>
        ) : null}

        {phase === "active" ? (
          <div className="-mx-4 -my-5 flex flex-1 flex-col">
            <div className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 pb-2 pt-3 backdrop-blur">
              <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-muted">
                    {attempt?.studentName}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {attempt?.quizTitle}
                  </p>
                </div>
                <div
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-bold tabular-nums",
                    remainingSeconds !== null && remainingSeconds <= 15
                      ? "border-red-200 bg-danger-soft text-danger"
                      : remainingSeconds !== null && remainingSeconds <= 60
                        ? "border-amber-200 bg-amber-soft text-amber-900"
                        : "border-line bg-white text-ink",
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {remainingSeconds !== null
                    ? formatDuration(remainingSeconds)
                    : "—"}
                </div>
              </div>
              <div className="mx-auto mt-2 h-1 w-full max-w-lg overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{
                    width: `${questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
              {error ? (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-danger-soft px-3 py-2 text-xs text-danger">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              ) : null}

              <div className="space-y-3">
                {questions.map((question, index) => {
                  const value = answers[question.id];
                  const arabic = isArabic(question.prompt);
                  const [before, after] = splitClozePrompt(question.prompt);

                  return (
                    <section key={question.id} className="card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                          Pitanje {index + 1} od {questions.length}
                        </span>
                        <span className="badge border-line bg-paper text-muted">
                          {typeLabel(question.type)}
                        </span>
                      </div>

                      {question.type === "cloze" ? (
                        <p
                          className={clsx(
                            "mt-2 text-[15px] leading-relaxed",
                            arabic && "font-arabic text-[17px]",
                          )}
                          dir="auto"
                        >
                          {before}
                          <span
                            className={clsx(
                              "mx-1 inline-flex min-w-20 items-center justify-center rounded-md border-b-2 px-2 py-0.5 align-baseline text-sm font-semibold",
                              value !== undefined
                                ? "border-brand bg-brand-soft text-brand-dark"
                                : "border-line bg-paper text-muted",
                            )}
                          >
                            {value !== undefined
                              ? question.options[Number(value)]
                              : "_____"}
                          </span>
                          {after}
                        </p>
                      ) : (
                        <p
                          className={clsx(
                            "mt-2 text-[15px] leading-relaxed",
                            arabic && "font-arabic text-[17px]",
                          )}
                          dir="auto"
                        >
                          {question.prompt}
                        </p>
                      )}

                      <div className="mt-3">
                        {question.type === "tf" ? (
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "Tačno", value: true },
                              { label: "Netačno", value: false },
                            ].map((option) => {
                              const active = value === option.value;
                              return (
                                <button
                                  key={option.label}
                                  type="button"
                                  onClick={() => saveAnswer(question, option.value)}
                                  className={clsx(
                                    "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                                    active
                                      ? "border-brand bg-brand text-white"
                                      : "border-line bg-white text-ink hover:border-brand/40",
                                  )}
                                >
                                  {active ? <Check className="h-4 w-4" /> : null}
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div
                            className={clsx(
                              "grid gap-2",
                              question.type === "cloze"
                                ? "grid-cols-2 sm:grid-cols-3"
                                : "grid-cols-1",
                            )}
                          >
                            {question.options.map((option, optionIndex) => {
                              const active = value === optionIndex;
                              return (
                                <button
                                  key={optionIndex}
                                  type="button"
                                  dir="auto"
                                  onClick={() => saveAnswer(question, optionIndex)}
                                  className={clsx(
                                    "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                                    active
                                      ? "border-brand bg-brand-soft font-semibold text-brand-dark"
                                      : "border-line bg-white hover:border-brand/40",
                                    isArabic(option) && "font-arabic text-[16px]",
                                  )}
                                >
                                  {question.type === "single" ? (
                                    <span
                                      className={clsx(
                                        "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold",
                                        active
                                          ? "bg-brand text-white"
                                          : "bg-paper text-muted",
                                      )}
                                    >
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                  ) : (
                                    <span
                                      className={clsx(
                                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                                        active
                                          ? "border-brand bg-brand text-white"
                                          : "border-line",
                                      )}
                                    >
                                      {active ? <Check className="h-3 w-3" /> : null}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">{option}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Čuva se…
                    </>
                  ) : saveState === "saved" ? (
                    <>
                      <Check className="h-3 w-3 text-brand" /> Sačuvano
                    </>
                  ) : saveState === "error" ? (
                    <>
                      <WifiOff className="h-3 w-3 text-danger" /> Nije sačuvano
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" /> Odgovori se čuvaju automatski
                    </>
                  )}
                </span>
                {saveState === "error" ? (
                  <button
                    type="button"
                    onClick={() => void retrySaves()}
                    className="inline-flex items-center gap-1 font-semibold text-brand"
                  >
                    <RotateCw className="h-3 w-3" /> Pokušaj ponovo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur safe-bottom">
              <div className="mx-auto flex w-full max-w-lg items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {answeredCount}/{questions.length} odgovoreno
                  </p>
                  <p className="text-[10px] text-muted">
                    {remainingSeconds !== null && remainingSeconds <= 60
                      ? "Požuri — ostalo je manje od minute."
                      : "Predaj kada završiš."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void submit(false)}
                  disabled={submitting}
                  className="btn btn-primary !px-5 !py-3"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Predaj test
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="px-4 py-4 text-center text-[10px] text-muted">
        Test uživo · odgovori se čuvaju odmah · kod {code}
      </footer>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-name"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <p id="confirm-name" className="text-sm text-muted">
              Prijavljuješ se kao
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {selected.name}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Ime se veže za ovaj telefon za vrijeme testa i ne može se mijenjati.
              Provjeri da si izabrao svoje ime.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn btn-secondary"
                disabled={claiming}
              >
                Nije
              </button>
              <button
                type="button"
                onClick={() => void claim(selected)}
                className="btn btn-primary"
                disabled={claiming}
              >
                {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                To sam ja
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

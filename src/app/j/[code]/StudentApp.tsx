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
import { MatchingPairs } from "@/components/MatchingPairs";
import { MultiBlankHadith } from "@/components/MultiBlankHadith";
import { formatDuration } from "@/lib/format";
import { countBlanks, splitClozePrompt } from "@/lib/parse-questions";

type Phase =
  | "loading"
  | "error"
  | "pick"
  | "lobby"
  | "active"
  | "submitted"
  | "closed";

type Student = {
  id: string;
  name: string;
  taken: boolean;
  /** Ime je već vezano za drugi uređaj u ovom odjeljenju. */
  boundElsewhere: boolean;
};

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
  deviceToken: string;
  /** Učenik vezan za ovaj uređaj u odjeljenju, ako postoji. */
  boundStudentId: string | null;
  students: Student[];
  me: { token: string; studentId: string; status: string } | null;
};

type AttemptQuestion = {
  id: string;
  type: "tf" | "single" | "cloze" | "cloze_multi" | "matching";
  prompt: string;
  options: string[];
  pairs?: { left: string; right: string }[];
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
  saved?: { questionId: string; value: AnswerValue }[];
  submitReason?: string | null;
  leaveCount?: number;
  leftAt?: string | null;
};

type AnswerValue = boolean | number | number[];
type SubmitReason = "student" | "time" | "left";

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

/**
 * Lokalna oznaka da je učenik napustio aktivan test. Preživi reload i
 * zatvaranje taba, pa se test predaje kad se stranica ponovo otvori.
 * Server ima i `leave_count` kao rezervu.
 */
function leftStorageKey(token: string): string {
  return `ispiti_left_${token}`;
}

function markLeft(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(leftStorageKey(token), String(Date.now()));
  } catch {
    // Privatni režim — server i dalje beleži napuštanje.
  }
}

function hasLeft(token: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(leftStorageKey(token)) !== null;
  } catch {
    return false;
  }
}

function clearLeft(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(leftStorageKey(token));
  } catch {
    // ignore
  }
}

type LocalAnswerStore = {
  token: string;
  answers: Record<string, AnswerValue>;
  pending: string[];
  updatedAt: number;
};

function answersStorageKey(token: string): string {
  return `ispiti_answers_${token}`;
}

function readLocalAnswers(token: string): LocalAnswerStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(answersStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAnswerStore;
    if (!parsed || parsed.token !== token || typeof parsed.answers !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalAnswers(
  token: string,
  answers: Record<string, AnswerValue>,
  pending: Set<string>,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: LocalAnswerStore = {
      token,
      answers,
      pending: [...pending],
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(answersStorageKey(token), JSON.stringify(payload));
  } catch {
    // Privatni režim ili pun storage — server autosave i dalje radi.
  }
}

function clearLocalAnswers(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(answersStorageKey(token));
  } catch {
    // ignore
  }
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
  if (type === "cloze_multi") return "Popuni hadiš";
  if (type === "matching") return "Poveži parove";
  if (type === "cloze") return "Dopuni";
  return "Jedan odgovor";
}

export function StudentApp({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [join, setJoin] = useState<JoinResponse | null>(null);
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [deviceToken, setDeviceToken] = useState<string | null>(() =>
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
  const [submittedReason, setSubmittedReason] = useState<string | null>(null);
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
  const pendingLocal = useRef<Set<string>>(new Set());
  const answersRef = useRef<Record<string, AnswerValue>>({});
  const hydratedTokenRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const phaseRef = useRef<Phase>("loading");
  const leftRef = useRef(false);
  const autoSubmitTriedRef = useRef<string | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const questions = attempt?.questions ?? [];
  const serverLeaveCount = attempt?.leaveCount ?? 0;
  const isAnswered = (question: AttemptQuestion): boolean => {
    if (!Object.prototype.hasOwnProperty.call(answers, question.id)) return false;
    const value = answers[question.id];
    if (question.type === "matching") {
      const count = (question.pairs ?? []).length;
      if (!Array.isArray(value) || count === 0) return false;
      return value.length >= count && value.slice(0, count).every((i) => i >= 0);
    }
    if (question.type !== "cloze_multi") return true;
    const blanks = countBlanks(question.prompt);
    if (!Array.isArray(value) || blanks === 0) return Array.isArray(value);
    return value.length >= blanks && value.slice(0, blanks).every((i) => i >= 0);
  };
  const answeredCount = questions.filter(isAnswered).length;

  const remainingMs = deadline
    ? Math.max(0, deadline - (now + clockOffset))
    : null;
  const remainingSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  const retrySaves = useCallback(
    async (tokenOverride?: string | null) => {
      const token = tokenOverride ?? attemptToken;
      if (!token) return;

      setSaveState("saving");
      for (const [questionId, value] of [...failedAnswers.current.entries()]) {
        // Ako je učenik u međuvremenu promijenio odgovor, ne šalji stari.
        if (answersRef.current[questionId] !== value) {
          failedAnswers.current.delete(questionId);
          continue;
        }
        try {
          const response = await fetch(`/api/attempt/${token}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, value }),
          });
          if (!response.ok) throw new Error("save");
          if (answersRef.current[questionId] === value) {
            failedAnswers.current.delete(questionId);
            pendingLocal.current.delete(questionId);
          }
        } catch {
          // Ostaje u mapi za sljedeći pokušaj.
        }
      }
      writeLocalAnswers(token, answersRef.current, pendingLocal.current);
      setSaveState(failedAnswers.current.size > 0 ? "error" : "saved");
    },
    [attemptToken],
  );

  const loadAttempt = useCallback(
    async (token: string) => {
      try {
        const response = await fetch(`/api/attempt/${token}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          window.localStorage.removeItem(attemptStorageKey(code));
          clearLocalAnswers(token);
          clearLeft(token);
          hydratedTokenRef.current = null;
          failedAnswers.current.clear();
          pendingLocal.current.clear();
          answersRef.current = {};
          setAnswers({});
          setAttemptToken(null);
          setPhase("pick");
          return;
        }
        const data = (await response.json()) as AttemptResponse;
        setError(null);

        if (data.status === "submitted") {
          submittedRef.current = true;
          hydratedTokenRef.current = token;
          clearLocalAnswers(token);
          clearLeft(token);
          setSubmittedReason(data.submitReason ?? null);
          setAttempt(data);
          setPhase("submitted");
          return;
        }
        if (data.status === "closed") {
          hydratedTokenRef.current = token;
          clearLocalAnswers(token);
          clearLeft(token);
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
        setSubmittedReason(null);
        setAttempt(data);

        if (hydratedTokenRef.current !== token) {
          const validIds = new Set((data.questions ?? []).map((question) => question.id));
          const serverAnswers: Record<string, AnswerValue> = {};
          for (const saved of data.saved ?? []) {
            if (validIds.has(saved.questionId)) {
              serverAnswers[saved.questionId] = saved.value;
            }
          }

          const local = readLocalAnswers(token);
          const merged: Record<string, AnswerValue> = { ...serverAnswers };
          const pending = new Set<string>();
          failedAnswers.current.clear();

          if (local) {
            for (const [questionId, value] of Object.entries(local.answers)) {
              if (!validIds.has(questionId)) continue;
              const wasPending = local.pending.includes(questionId);
              const hasServer = Object.prototype.hasOwnProperty.call(
                serverAnswers,
                questionId,
              );
              if (wasPending || !hasServer) {
                merged[questionId] = value;
                pending.add(questionId);
                failedAnswers.current.set(questionId, value);
              }
            }
          }

          answersRef.current = merged;
          setAnswers(merged);
          pendingLocal.current = pending;
          hydratedTokenRef.current = token;
          writeLocalAnswers(token, merged, pending);

          if (pending.size > 0) {
            setSaveState("error");
            void retrySaves(token);
          } else {
            setSaveState(Object.keys(merged).length > 0 ? "saved" : "idle");
          }
        }

        // Server je zabeležio napuštanje (npr. beacon je stigao, a lokalna
        // oznaka je obrisana) — povratak mora predati test.
        if ((data.leaveCount ?? 0) > 0 && !submittedRef.current) {
          leftRef.current = true;
        }

        setPhase("active");
      } catch {
        setError("Veza je prekinuta. Provjeri internet i pokušaj ponovo.");
        if (phaseRef.current === "loading") setPhase("error");
      }
    },
    [code, retrySaves],
  );

  const refreshJoin = useCallback(async () => {
    try {
      const query = deviceToken
        ? `?device=${encodeURIComponent(deviceToken)}`
        : "";
      const response = await fetch(`/api/join/${code}${query}`, {
        cache: "no-store",
      });
      if (response.status === 404) {
        setError("Test sa tim kodom ne postoji. Provjeri kod kod nastavnika.");
        setPhase("error");
        return;
      }
      const data = (await response.json()) as JoinResponse;

      // Server može vratiti token iz HttpOnly kolačića (npr. kad je
      // localStorage obrisan) — tada i localStorage držimo u istom stanju.
      if (data.deviceToken && data.deviceToken !== deviceToken) {
        window.localStorage.setItem(deviceStorageKey(), data.deviceToken);
        setDeviceToken(data.deviceToken);
      }

      setJoin(data);
      setError(null);

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
      if (phaseRef.current === "loading") setPhase("error");
    }
  }, [code, deviceToken, loadAttempt]);

  // Prvo učitavanje i ulazak u sesiju.
  useEffect(() => {
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

  // Počisti lokalne odgovore starijih pokušaja (max 24h).
  useEffect(() => {
    try {
      const now = Date.now();
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith("ispiti_left_")) {
          const timestamp = Number(window.localStorage.getItem(key));
          if (!timestamp || now - timestamp > 24 * 60 * 60 * 1000) {
            window.localStorage.removeItem(key);
          }
          continue;
        }
        if (!key?.startsWith("ispiti_answers_")) continue;
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { updatedAt?: number };
          if (!parsed.updatedAt || now - parsed.updatedAt > 24 * 60 * 60 * 1000) {
            window.localStorage.removeItem(key);
          }
        } catch {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Kad se veza vrati, pošalji odgovore koji su ostali nespremljeni.
  useEffect(() => {
    const retryOnOnline = () => {
      if (attemptToken && failedAnswers.current.size > 0) {
        void retrySaves(attemptToken);
      }
    };
    window.addEventListener("online", retryOnOnline);
    return () => window.removeEventListener("online", retryOnOnline);
  }, [attemptToken, retrySaves]);

  async function claim(student: Student) {
    setClaiming(true);
    setError(null);

    try {
      const response = await fetch(`/api/join/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          ...(deviceToken ? { deviceToken } : {}),
        }),
      });
      const data = (await response.json()) as {
        token?: string;
        deviceToken?: string;
        error?: string;
      };

      if (!response.ok || !data.token) {
        setError(data.error ?? "Nije moguće ući u test.");
        setSelected(null);
        await refreshJoin();
        return;
      }

      if (data.deviceToken && data.deviceToken !== deviceToken) {
        window.localStorage.setItem(deviceStorageKey(), data.deviceToken);
        setDeviceToken(data.deviceToken);
      }

      window.localStorage.setItem(attemptStorageKey(code), data.token);
      hydratedTokenRef.current = null;
      failedAnswers.current.clear();
      pendingLocal.current.clear();
      answersRef.current = {};
      submittedRef.current = false;
      submittingRef.current = false;
      leftRef.current = false;
      autoSubmitTriedRef.current = null;
      setSubmittedReason(null);
      setAnswers({});
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

    const next = { ...answersRef.current, [question.id]: value };
    answersRef.current = next;
    setAnswers(next);
    pendingLocal.current.add(question.id);
    writeLocalAnswers(attemptToken, next, pendingLocal.current);

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
        if (answersRef.current[question.id] === value) {
          failedAnswers.current.delete(question.id);
          pendingLocal.current.delete(question.id);
        }
      } catch {
        if (answersRef.current[question.id] === value) {
          failedAnswers.current.set(question.id, value);
          pendingLocal.current.add(question.id);
        }
      } finally {
        writeLocalAnswers(
          attemptToken,
          answersRef.current,
          pendingLocal.current,
        );
        pendingSaves.current -= 1;
        if (pendingSaves.current === 0) {
          setSaveState(failedAnswers.current.size > 0 ? "error" : "saved");
        }
      }
    });
  }

  const submit = useCallback(
    async (
      auto: boolean,
      reason: SubmitReason = "student",
    ): Promise<boolean> => {
      if (!attemptToken || submittingRef.current || submittedRef.current) {
        return submittedRef.current;
      }

      if (!auto) {
        const unanswered = questions.length - answeredCount;
        if (unanswered > 0) {
          // Native confirm ne smije biti protumačen kao napuštanje testa.
          submittingRef.current = true;
          const confirmed = window.confirm(
            `Imaš ${unanswered} neodgovorenih pitanja. Predati test ipak?`,
          );
          if (!confirmed) {
            submittingRef.current = false;
            return false;
          }
        }
      }

      submittingRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        // Sačekaj da svi odgovori iz reda stignu, pa još jednom pošalji
        // one koji su pali. Predaja ne smije zaključati test prije njih.
        await queueRef.current;
        if (failedAnswers.current.size > 0) {
          await retrySaves(attemptToken);
        }
        if (failedAnswers.current.size > 0) {
          setError(
            "Neki odgovori nisu sačuvani. Provjeri internet i pokušaj ponovo.",
          );
          submittingRef.current = false;
          setSubmitting(false);
          return false;
        }

        submittedRef.current = true;
        const response = await fetch(`/api/attempt/${attemptToken}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          reason?: string;
        } | null;
        if (!response.ok) throw new Error("submit");
        pendingLocal.current.clear();
        clearLocalAnswers(attemptToken);
        clearLeft(attemptToken);
        setSubmittedReason(data?.reason ?? reason);
        setPhase("submitted");
        return true;
      } catch {
        submittedRef.current = false;
        submittingRef.current = false;
        setError("Predaja nije uspjela. Provjeri internet i pokušaj ponovo.");
        setSubmitting(false);
        return false;
      }
    },
    [attemptToken, questions.length, answeredCount, retrySaves],
  );

  // Automatska predaja kad istekne vrijeme.
  useEffect(() => {
    if (phase !== "active" || remainingMs === null) return;
    if (remainingMs <= 0 && !submittedRef.current) {
      void submit(true, "time");
    }
  }, [phase, remainingMs, submit]);

  // Ako je prethodni posjet ostavio oznaku napuštanja (ili je server
  // zabeležio leave_count), predaj odmah po povratku — uključujući reload
  // ili ponovno otvaranje taba.
  useEffect(() => {
    if (phase !== "active" || !attemptToken || submittedRef.current) return;
    if (
      typeof document === "undefined" ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    if (!hasLeft(attemptToken) && serverLeaveCount === 0) return;
    if (autoSubmitTriedRef.current === attemptToken) return;

    autoSubmitTriedRef.current = attemptToken;
    leftRef.current = true;
    void submit(true, "left");
  }, [phase, attemptToken, serverLeaveCount, submit]);

  // Spreči slučajni pull-to-refresh tokom testa — reload bi se računao kao
  // vraćanje i predao test. Najbolje što preglednik dopušta; stariji iOS
  // može i dalje dozvoliti gest.
  useEffect(() => {
    if (phase !== "active") return;
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overscrollBehaviorY;
    const previousBody = body.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    body.style.overscrollBehaviorY = "contain";
    return () => {
      root.style.overscrollBehaviorY = previousRoot;
      body.style.overscrollBehaviorY = previousBody;
    };
  }, [phase]);

  // Napuštanje aktivnog testa: zapamti lokalno i pošalji beacon. Predaja
  // ide tek kad se stranica vrati, ne dok je sakrivena — tako kratak poziv
  // ili poruka ne unište test, ali učenik ne može odgovoriti poslije
  // vraćanja.
  useEffect(() => {
    if (phase !== "active" || !attemptToken) return;

    const noteLeave = () => {
      if (submittedRef.current || submittingRef.current || leftRef.current) {
        return;
      }
      leftRef.current = true;
      markLeft(attemptToken);

      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(`/api/attempt/${attemptToken}/leave`);
        } else {
          void fetch(`/api/attempt/${attemptToken}/leave`, {
            method: "POST",
            keepalive: true,
          });
        }
      } catch {
        // Server ima i leave_count; lokalna oznaka je dovoljna za predaju.
      }
    };

    const noteReturn = () => {
      if (!leftRef.current) return;
      leftRef.current = false;
      if (submittedRef.current) return;

      void submit(true, "left").then((ok) => {
        if (!ok && !submittedRef.current) leftRef.current = true;
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") noteLeave();
      else noteReturn();
    };
    const onPageHide = () => noteLeave();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) noteReturn();
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") noteReturn();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [phase, attemptToken, submit]);

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("bs");
    if (!needle) return join?.students ?? [];
    return (join?.students ?? []).filter((student) =>
      student.name.toLocaleLowerCase("bs").includes(needle),
    );
  }, [join?.students, query]);

  // Kad je telefon već vezan za učenika, ne nudi ostala imena — to je cijela
  // poenta trajne veze. Nastavnik može osloboditi uređaj ako je greška.
  const boundStudent = join?.boundStudentId
    ? (join.students.find((student) => student.id === join.boundStudentId) ??
      null)
    : null;

  const visibleStudents = boundStudent ? [boundStudent] : filteredStudents;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-rule bg-lift/70">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-xs bg-forest text-paper">
              <UserRound className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Ispiti</span>
          </div>
          <span className="font-data text-xs tracking-[0.16em] text-muted">
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
            <AlertCircle className="mx-auto h-8 w-8 text-pencil" />
            <h1 className="mt-3 text-lg font-semibold">Test nije dostupan</h1>
            <p className="mt-1.5 text-sm text-muted">
              {error ?? "Provjeri kod kod nastavnika."}
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase("loading");
                void refreshJoin();
              }}
              className="btn btn-secondary mt-4"
            >
              <RotateCw className="h-4 w-4" />
              Pokušaj ponovo
            </button>
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
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-none bg-forest-wash text-forest">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Test je predan</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Odgovori su sačuvani. Ne možeš ih više mijenjati.
              <br />
              Možeš zatvoriti stranicu.
            </p>
            {submittedReason === "left" ? (
              <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-pencil">
                Test je predan jer si napustio stranicu. Ako je to bila greška,
                javi se nastavniku.
              </p>
            ) : submittedReason === "time" ? (
              <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-muted">
                Vrijeme je isteklo, pa je test predan automatski.
              </p>
            ) : submittedReason === "closed" ? (
              <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-muted">
                Nastavnik je završio test.
              </p>
            ) : null}
            {attempt?.studentName ? (
              <p className="mt-4 text-xs text-muted">{attempt.studentName}</p>
            ) : null}
          </div>
        ) : null}

        {phase === "pick" && join ? (
          <div>
            <div className="text-center">
              <p className="font-sans text-xs text-forest">
                {join.session.className}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                {join.session.quizTitle}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {boundStudent
                  ? "Ovaj telefon je vezan za tvoje ime."
                  : "Izaberi svoje ime sa spiska."}
              </p>
            </div>

            {boundStudent ? (
              <div className="mt-4 rounded-sm border border-forest/30 bg-forest-wash px-3 py-2.5 text-forest-deep">
                <p className="font-sans text-[0.7rem] text-forest">
                  Ime na ovom telefonu
                </p>
                <p className="mt-0.5 text-base font-semibold">
                  {boundStudent.name}
                </p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-forest-deep/80">
                  Ime je trajno vezano za ovaj telefon u ovom odjeljenju. Ako
                  ovo nije tvoje ime, javi nastavniku — samo on može osloboditi
                  uređaj.
                </p>
              </div>
            ) : null}

            {join.session.status === "active" ? (
              <div className="mt-4 flex items-start gap-2 rounded-sm border border-rule bg-ink-wash px-3 py-2 text-xs text-ink-soft">
                <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Test je već počeo — pridruži se odmah, vrijeme ide.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-sm border border-pencil/40 bg-pencil-wash px-3 py-2 text-xs text-pencil">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            ) : null}

            {!boundStudent && (join.students?.length ?? 0) > 10 ? (
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
              {visibleStudents.map((student) => {
                const locked = student.taken || student.boundElsewhere;
                return (
                  <button
                    key={student.id}
                    type="button"
                    disabled={locked || claiming}
                    onClick={() => setSelected(student)}
                    className={clsx(
                      "flex min-h-11 items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-sm transition-colors",
                      locked
                        ? "cursor-not-allowed border-rule bg-paper text-muted opacity-70"
                        : "border-rule bg-lift font-medium hover:border-forest/40 hover:bg-forest-wash/30",
                    )}
                  >
                    <span className="min-w-0 truncate">{student.name}</span>
                    {student.taken ? (
                      <span className="shrink-0 font-sans text-[0.65rem] text-muted">
                        zauzeto
                      </span>
                    ) : student.boundElsewhere ? (
                      <span className="shrink-0 font-sans text-[0.65rem] text-muted">
                        vezano
                      </span>
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                    )}
                  </button>
                );
              })}
            </div>

            {visibleStudents.length === 0 ? (
              <p className="mt-4 text-center text-sm text-muted">
                {boundStudent
                  ? "Tvoje ime više nije na spisku. Javi se nastavniku."
                  : "Nema imena koja odgovaraju pretrazi."}
              </p>
            ) : null}

            {boundStudent?.taken ? (
              <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-pencil">
                Ovo ime je već prijavljeno u ovom testu sa drugog uređaja. Javi
                se nastavniku.
              </p>
            ) : null}

            <p className="mt-5 text-center text-[0.72rem] leading-relaxed text-muted">
              {boundStudent
                ? "Ako promijeniš telefon ili obrišeš podatke preglednika, javi se nastavniku da oslobodi uređaj."
                : "Prvi izbor imena veže ovaj telefon za to ime u cijelom odjeljenju. U sljedećem testu ne možeš izabrati drugo ime. Ako pogriješiš, javi nastavniku."}
            </p>
          </div>
        ) : null}

        {phase === "lobby" ? (
          <div className="card p-8 text-center">
            <span className="relative mx-auto flex h-14 w-14 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-none bg-forest-wash" />
              <span className="relative grid h-14 w-14 place-items-center rounded-none bg-forest-wash text-forest">
                <Timer className="h-6 w-6" />
              </span>
            </span>
            <h1 className="mt-5 text-xl font-semibold">Sačekaj početak</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Nastavnik će pokrenuti test. Tajmer kreće za sve u isto vrijeme.
            </p>
            <div className="mt-5 rounded-sm border border-rule bg-paper/60 px-3 py-2.5">
              <p className="font-sans text-[0.7rem] text-muted">
                Prijavljen kao
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {attempt?.studentName ?? "—"}
              </p>
            </div>
            <p className="mt-4 text-[0.72rem] text-muted">
              Ne zatvaraj stranicu. Kada test počne, pitanja se pojavljuju sama.
            </p>
            <p className="mt-2 text-[0.72rem] font-semibold leading-relaxed text-pencil">
              Kad test počne, ne napuštaj ovu stranicu. Ako se vratiš, test se
              automatski predaje.
            </p>
            {error ? (
              <p className="mt-3 text-[0.72rem] text-pencil">{error}</p>
            ) : null}
          </div>
        ) : null}

        {phase === "active" ? (
          <div className="-mx-4 -my-5 flex flex-1 flex-col">
            <div className="sticky top-0 z-20 border-b border-rule bg-paper/95 px-4 pb-2 pt-3 backdrop-blur">
              <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.72rem] font-medium text-muted">
                    {attempt?.studentName}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {attempt?.quizTitle}
                  </p>
                </div>
                <div
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-data text-sm font-semibold tabular-nums",
                    remainingSeconds !== null && remainingSeconds <= 15
                      ? "border-pencil/40 bg-pencil-wash text-pencil"
                      : remainingSeconds !== null && remainingSeconds <= 60
                        ? "border-rule bg-ink-wash text-ink-soft"
                        : "border-rule bg-lift text-ink",
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {remainingSeconds !== null
                    ? formatDuration(remainingSeconds)
                    : "—"}
                </div>
              </div>
              <div className="mx-auto mt-2 h-1 w-full max-w-lg overflow-hidden rounded-none bg-rule">
                <div
                  className="h-full rounded-none bg-forest transition-all duration-300"
                  style={{
                    width: `${questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
              {error ? (
                <div className="mb-3 flex items-start gap-2 rounded-sm border border-pencil/40 bg-pencil-wash px-3 py-2 text-xs text-pencil">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              ) : null}

              <div className="mb-3 rounded-sm border border-pencil/30 bg-pencil-wash px-3 py-2 text-[0.72rem] leading-relaxed text-pencil">
                Ne napuštaj ovu stranicu. Ako se vratiš na test, on se
                automatski predaje.
              </div>

              <div className="space-y-3">
                {questions.map((question, index) => {
                  const value = answers[question.id];
                  const arabic = isArabic(question.prompt);
                  const [before, after] = splitClozePrompt(question.prompt);

                  return (
                    <section key={question.id} className="card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-[0.7rem] text-muted">
                          Pitanje {index + 1} od {questions.length}
                        </span>
                        <span className="badge border-rule bg-paper text-muted">
                          {typeLabel(question.type)}
                        </span>
                      </div>

                      {question.type === "matching" ? (
                        <>
                          <p className="mt-2 text-[15px] leading-relaxed" dir="auto">
                            {question.prompt}
                          </p>
                          <MatchingPairs
                            prompt={question.prompt}
                            pairs={question.pairs ?? []}
                            value={
                              Array.isArray(value)
                                ? value
                                : Array.from(
                                    { length: (question.pairs ?? []).length },
                                    () => -1,
                                  )
                            }
                            onChange={(next) => saveAnswer(question, next)}
                          />
                        </>
                      ) : question.type === "cloze_multi" ? (
                        <MultiBlankHadith
                          prompt={question.prompt}
                          options={question.options}
                          value={
                            Array.isArray(value)
                              ? value
                              : Array.from(
                                  { length: countBlanks(question.prompt) },
                                  () => -1,
                                )
                          }
                          onChange={(next) => saveAnswer(question, next)}
                        />
                      ) : question.type === "cloze" ? (
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
                                ? "border-forest bg-forest-wash text-forest-deep"
                                : "border-rule bg-paper text-muted",
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

                      {question.type === "cloze_multi" ||
                      question.type === "matching" ? null : (
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
                                    "flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-sm font-semibold transition-colors",
                                    active
                                      ? "border-forest bg-forest-wash text-forest-deep"
                                      : "border-rule bg-lift text-ink hover:border-forest/60",
                                  )}
                                >
                                  {active ? "•" : null}
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
                                    "flex min-h-11 items-center gap-2.5 rounded-sm border px-3 py-2.5 text-left text-sm transition-colors",
                                    active
                                      ? "border-forest bg-forest-wash font-semibold text-forest-deep"
                                      : "border-rule bg-lift hover:border-forest/40",
                                    isArabic(option) && "font-arabic text-[16px]",
                                  )}
                                >
                                  {question.type === "single" ? (
                                    <span
                                      className={clsx(
                                        "grid h-6 w-6 shrink-0 place-items-center border font-data text-[0.72rem]",
                                        active
                                          ? "border-forest bg-forest text-paper"
                                          : "border-rule-soft bg-paper text-muted",
                                      )}
                                    >
                                      {String.fromCharCode(65 + optionIndex)}.
                                    </span>
                                  ) : (
                                    <span
                                      className={clsx(
                                        "grid h-5 w-5 shrink-0 place-items-center rounded-none border",
                                        active
                                          ? "border-forest bg-forest-wash text-forest-deep"
                                          : "border-rule",
                                      )}
                                    >
                                      {active ? "•" : null}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">{option}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      )}
                    </section>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-[0.72rem]">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Čuva se…
                    </>
                  ) : saveState === "saved" ? (
                    <>
                      <Check className="h-3 w-3 text-forest" /> Sačuvano
                    </>
                  ) : saveState === "error" ? (
                    <>
                      <WifiOff className="h-3 w-3 text-pencil" /> Nije sačuvano
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
                    className="inline-flex items-center gap-1 font-semibold text-forest"
                  >
                    <RotateCw className="h-3 w-3" /> Pokušaj ponovo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur safe-bottom">
              <div className="mx-auto flex w-full max-w-lg items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {answeredCount}/{questions.length} odgovoreno
                  </p>
                  <p className="text-[10px] text-muted">
                    {remainingSeconds !== null && remainingSeconds <= 60
                      ? "Požuri — ostalo je manje od minute."
                      : "Ne napuštaj stranicu — vraćanje predaje test."}
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
            className="w-full max-w-sm rounded-sm bg-lift p-5 shadow-xl"
          >
            <p id="confirm-name" className="text-sm text-muted">
              Prijavljuješ se kao
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {selected.name}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Ime se trajno veže za ovaj telefon u ovom odjeljenju. U sljedećem
              testu ne možeš izabrati drugo ime. Provjeri da si izabrao svoje
              ime.
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

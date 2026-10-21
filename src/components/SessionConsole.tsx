"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  Square,
  Unlock,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import {
  closeSessionAction,
  extendSessionAction,
  resetAttemptAction,
  setJoinLockAction,
  setManualScoreAction,
  startSessionAction,
} from "@/app/actions/sessions";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/ui";
import { formatDuration } from "@/lib/format";

type LiveAttempt = {
  id: string;
  status: string;
  score: number;
  answered: number;
  joinedAt: string;
  submittedAt: string | null;
};

type LiveStudent = {
  id: string;
  name: string;
  attempt: LiveAttempt | null;
};

type LiveSession = {
  id: string;
  status: string;
  endsAt: string | null;
  durationSeconds: number;
  code: string;
  joinLocked: boolean;
  quizTitle: string;
  className: string;
  serverNow: number;
  maxPoints: number;
  totalStudents: number;
};

type LiveData = {
  session: LiveSession;
  students: LiveStudent[];
};

export function SessionConsole({
  sessionId,
  joinUrl,
  qrDataUrl,
  initial,
}: {
  sessionId: string;
  joinUrl: string;
  qrDataUrl: string;
  initial: LiveData;
}) {
  const [data, setData] = useState<LiveData>(initial);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingReset, setPendingReset] = useState<string | null>(null);
  const [pendingManual, setPendingManual] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/live`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("live");
      const next = (await response.json()) as LiveData;
      setData(next);
      setOffset(next.session.serverNow - Date.now());
      setError(null);
    } catch {
      setError("Veza je prekinuta. Pokušavam ponovo…");
    }
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling spoljnog izvora
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const { session, students } = data;
  const joined = students.filter((student) => student.attempt);
  const submitted = students.filter(
    (student) => student.attempt?.status === "submitted",
  );

  const endsAtMs = session.endsAt ? new Date(session.endsAt).getTime() : null;
  const remainingMs = endsAtMs
    ? Math.max(0, endsAtMs - (now + offset))
    : null;
  const remainingSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  function run(action: () => Promise<void>) {
    if (pending) return;
    startTransition(async () => {
      try {
        await action();
        await load();
      } catch {
        setError("Akcija nije uspjela. Osvježi stranicu i pokušaj ponovo.");
      }
    });
  }

  function start() {
    run(() => startSessionAction(sessionId));
  }

  function close() {
    if (
      !window.confirm(
        "Završiti test? Učenici više ne mogu odgovarati, a svi pokušaji se zaključavaju.",
      )
    ) {
      return;
    }
    run(() => closeSessionAction(sessionId));
  }

  function extend() {
    run(() => extendSessionAction(sessionId, 60));
  }

  function toggleJoinLock() {
    run(() => setJoinLockAction(sessionId, !session.joinLocked));
  }

  function enterManualScore(student: LiveStudent) {
    const raw = window.prompt(
      `Bodovi za ${student.name} (0–${session.maxPoints}):`,
      "0",
    );
    if (raw === null) return;
    const score = Number(raw.replace(",", "."));
    if (!Number.isFinite(score)) return;

    setPendingManual(student.id);
    startTransition(async () => {
      try {
        await setManualScoreAction(sessionId, student.id, score);
        await load();
      } catch {
        setError("Nije moguće upisati rezultat.");
      } finally {
        setPendingManual(null);
      }
    });
  }

  function resetAttempt(attemptId: string, name: string) {
    if (!window.confirm(`Poništiti pokušaj za ${name}? Učenik može ponovo ući.`)) {
      return;
    }
    setPendingReset(attemptId);
    startTransition(async () => {
      try {
        await resetAttemptAction(attemptId);
        await load();
      } catch {
        setError("Nije moguće poništiti pokušaj.");
      } finally {
        setPendingReset(null);
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className="sheet p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Ulaz za učenike</h2>
            {session.joinLocked ? (
              <span className="font-sans text-xs text-pencil">ulaz zaključan</span>
            ) : null}
          </div>

          <div className="mt-4 flex justify-center rounded-sm border border-rule bg-lift p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR kod za test ${session.code}`}
              className="h-44 w-44"
              width={176}
              height={176}
            />
          </div>

          <p className="mt-4 text-center font-sans text-xs text-muted">Kod za ulaz</p>
          <p className="mt-1 text-center font-data text-[2rem] font-semibold tracking-[0.18em] text-forest-deep">
            {session.code}
          </p>

          <div className="mt-4 rounded-sm border border-rule bg-paper/60 px-3 py-2">
            <p className="truncate font-mono text-[11px] text-muted">{joinUrl}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <CopyButton
                value={joinUrl}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:text-forest-deep"
              />
              <Link
                href={joinUrl}
                target="_blank"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink"
              >
                Otvori <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
            Učenici skeniraju kod ili otvore link, izaberu svoje ime i čekaju
            početak.
          </p>
        </section>

        <section className="sheet p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Status</h2>
            <StatusBadge status={session.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-sm bg-paper/70 px-3 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Ušlo
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                {joined.length}
                <span className="text-xs font-normal text-muted">
                  /{session.totalStudents}
                </span>
              </dd>
            </div>
            <div className="rounded-sm bg-paper/70 px-3 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Predalo
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                {submitted.length}
                <span className="text-xs font-normal text-muted">
                  /{joined.length}
                </span>
              </dd>
            </div>
          </dl>

          {session.status !== "closed" ? (
            <button
              type="button"
              onClick={toggleJoinLock}
              disabled={pending}
              className="btn btn-secondary mt-3 w-full !py-2 text-xs"
            >
              {session.joinLocked ? (
                <Unlock className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {session.joinLocked ? "Otvori ulaz" : "Zaključaj ulaz"}
            </button>
          ) : null}

          {session.status === "lobby" ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={start}
                disabled={pending || joined.length === 0}
                className="btn btn-primary w-full !py-3"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Počni test
              </button>
              <p className="mt-2 text-center text-[11px] text-muted">
                {joined.length === 0
                  ? "Sačekaj da se prvi učenik prijavi."
                  : "Tajmer kreće za sve u istom trenutku."}
              </p>
            </div>
          ) : null}

          {session.status === "active" ? (
            <div className="mt-4">
              <div
                className={clsx(
                  "rounded-sm px-4 py-3 text-center",
                  remainingSeconds !== null && remainingSeconds <= 15
                    ? "bg-pencil-wash text-pencil"
                    : remainingSeconds !== null && remainingSeconds <= 60
                      ? "bg-ink-wash text-ink"
                      : "bg-forest-wash text-forest-deep",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">
                  Preostalo
                </p>
                <p className="font-mono text-3xl font-bold tabular-nums">
                  {remainingSeconds !== null
                    ? formatDuration(remainingSeconds)
                    : "—"}
                </p>
              </div>

              {remainingSeconds === 0 ? (
                <p className="mt-2 text-center text-[11px] font-semibold text-pencil">
                  Vrijeme je isteklo — učenici mogu samo predati.
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={extend}
                  disabled={pending}
                  className="btn btn-secondary !px-2 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  +1 min
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="btn btn-danger !px-2 text-xs"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                  Završi
                </button>
              </div>
            </div>
          ) : null}

          {session.status === "closed" ? (
            <div className="mt-4">
              <Link
                href={`/teacher/sessions/${session.id}/results`}
                className="btn btn-primary w-full"
              >
                <CheckCircle2 className="h-4 w-4" />
                Pogledaj rezultate
              </Link>
              <p className="mt-2 text-center text-[11px] text-muted">
                Test je zaključan. Odgovori se više ne primaju.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <div className="space-y-5">
        {error ? (
          <div className="flex items-center gap-2 rounded-sm border border-rule bg-ink-wash px-3.5 py-2.5 text-xs text-ink">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <section className="sheet overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4">
            <div>
              <h2 className="section-title">Učionica</h2>
              <p className="text-xs text-muted">
                {session.className} · {session.quizTitle}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {joined.length}/{session.totalStudents}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {session.durationSeconds / 60} min
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper/60 text-left text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-bold">Učenik</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 text-center font-bold">Odgovori</th>
                  <th className="px-3 py-2 text-center font-bold">Bodovi</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const attempt = student.attempt;
                  const isSubmitted = attempt?.status === "submitted";
                  const isManual =
                    Boolean(attempt) &&
                    isSubmitted &&
                    attempt!.answered === 0 &&
                    attempt!.score > 0;
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-rule last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        <span className="block max-w-[13rem] truncate">
                          {student.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {attempt ? (
                          <span
                            className={clsx(
                              "badge",
                              isManual
                                ? "border-rule bg-paper text-muted"
                                : isSubmitted
                                  ? "border-forest/30 bg-forest-wash text-forest-deep"
                                  : "border-rule bg-ink-wash text-ink-soft",
                            )}
                          >
                            {isManual ? "ručno" : isSubmitted ? "predao" : "u toku"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">nije ušao</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums text-muted">
                        {attempt
                          ? `${attempt.answered}/${session.maxPoints}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm font-semibold tabular-nums">
                        {attempt ? (
                          <>
                            {attempt.score}
                            <span className="text-xs font-normal text-muted">
                              /{session.maxPoints}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        {attempt ? (
                          <button
                            type="button"
                            onClick={() => resetAttempt(attempt.id, student.name)}
                            disabled={pending || pendingReset === attempt.id}
                            className="btn btn-ghost !min-h-7 !p-1 text-muted hover:text-pencil"
                            title="Poništi pokušaj"
                          >
                            {pendingReset === attempt.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => enterManualScore(student)}
                            disabled={pending || pendingManual === student.id}
                            className="btn btn-ghost !min-h-7 !p-1 text-muted hover:text-forest"
                            title="Ručno upiši rezultat"
                          >
                            {pendingManual === student.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PencilLine className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-rule bg-paper/50 px-5 py-3">
            <div className="h-px bg-rule">
              <div
                className="h-px bg-forest transition-all duration-500"
                style={{
                  width: `${
                    session.totalStudents > 0
                      ? Math.round((submitted.length / session.totalStudents) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Predalo {submitted.length} od {session.totalStudents} učenika.
              Rezultati se osvježavaju svake dvije sekunde.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

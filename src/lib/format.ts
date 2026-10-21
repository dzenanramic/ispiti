export const SCHOOL_TZ = "Europe/Sarajevo";

export const TERMS = ["1. polugodište", "2. polugodište"] as const;
export type Term = (typeof TERMS)[number];

export function currentSchoolYear(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TZ,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("bs-BA", {
    timeZone: SCHOOL_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("bs-BA", {
    timeZone: SCHOOL_TZ,
    dateStyle: "medium",
  }).format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("bs-BA", {
    timeZone: SCHOOL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function statusLabel(status: string): string {
  if (status === "lobby") return "Čeka početak";
  if (status === "active") return "U toku";
  return "Završen";
}

export function percent(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((score / max) * 100);
}

export function pluralBs(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export function testWord(count: number): string {
  return pluralBs(count, "test", "testa", "testova");
}

export function pointWord(count: number): string {
  return pluralBs(count, "bod", "boda", "bodova");
}

export function questionWord(count: number): string {
  return pluralBs(count, "pitanje", "pitanja", "pitanja");
}

export function studentWord(count: number): string {
  return pluralBs(count, "učenik", "učenika", "učenika");
}

export function classWord(count: number): string {
  return pluralBs(count, "odjeljenje", "odjeljenja", "odjeljenja");
}

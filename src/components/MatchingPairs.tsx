"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { QuestionPair } from "@/lib/types";

const RTL_CHARS = /[\u0591-\u07FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;

function isRtlText(text: string): boolean {
  const rtl = (text.match(RTL_CHARS) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return rtl > 0 && rtl >= latin;
}

/** Miješanje koje se ne mijenja između rendera za isti parova. */
function shuffled(length: number, seed: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  let state = seed || 1;
  for (let i = indices.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/** Stabilan broj iz teksta pitanja — raspored se ne mijenja pri ponovnom renderu. */
function seedFrom(text: string): number {
  let hash = 7;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483648;
  }
  return hash || 1;
}

type Props = {
  prompt: string;
  pairs: QuestionPair[];
  /** za svaki lijevi par: indeks desne stavke ili -1. */
  value: number[];
  disabled?: boolean;
  onChange: (next: number[]) => void;
};

/**
 * Povezivanje parova: učenik tapne stavku lijevo, pa njenu stavku desno.
 * Desna kolona je izmiješana, pa se odgovor ne može pogoditi po redu.
 */
export function MatchingPairs({
  prompt,
  pairs,
  value,
  disabled = false,
  onChange,
}: Props) {
  const [activeLeft, setActiveLeft] = useState<number | null>(0);
  const order = shuffled(pairs.length, seedFrom(prompt));
  const current = Array.from({ length: pairs.length }, (_, i) => value[i] ?? -1);
  const connected = current.filter((index) => index >= 0).length;

  /**
   * Koji lijevi par drži desnu stavku `rightIndex`? `-1` = nijedan.
   * (Desna stavka sa indeksom i pripada lijevom paru sa istim indeksom, ali
   * raspored na ekranu je izmiješan.)
   */
  function leftFor(rightIndex: number): number {
    return current.indexOf(rightIndex);
  }

  function tapLeft(pairIndex: number) {
    if (disabled) return;
    // Tap na već spojen par ga raskida i čini ga aktivnim.
    if (current[pairIndex] >= 0) {
      const next = [...current];
      next[pairIndex] = -1;
      onChange(next);
    }
    setActiveLeft(pairIndex);
  }

  function tapRight(rightIndex: number) {
    if (disabled || activeLeft === null) return;
    const next = [...current];
    // Ako je ovu desnu stavku imao drugi par, taj se par odvezuje.
    const heldBy = next.indexOf(rightIndex);
    if (heldBy !== -1) next[heldBy] = -1;
    next[activeLeft] = rightIndex;
    onChange(next);

    const upcoming = next.findIndex((index, i) => i > activeLeft && index < 0);
    setActiveLeft(upcoming !== -1 ? upcoming : null);
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
          Lijevo
        </p>
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
          Desno
        </p>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-2">
        {/* Lijeva kolona — uvijek u izvornom redu. */}
        <div className="space-y-2">
          {pairs.map((pair, index) => {
            const linked = current[index] >= 0;
            const active = activeLeft === index;
            const rtl = isRtlText(pair.left);
            return (
              <button
                key={index}
                type="button"
                disabled={disabled}
                onClick={() => tapLeft(index)}
                dir="auto"
                className={clsx(
                  "flex min-h-11 w-full items-center gap-1.5 rounded-sm border px-2 py-2 text-left text-sm transition-colors",
                  rtl && "font-arabic text-[15px]",
                  active
                    ? "border-forest bg-forest-wash ring-2 ring-forest/25"
                    : linked
                      ? "border-forest/50 bg-forest-wash/60 text-forest-deep"
                      : "border-rule bg-lift hover:border-forest/50",
                )}
                aria-pressed={active}
              >
                <span className="shrink-0 font-data text-[0.65rem] text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">{pair.left}</span>
              </button>
            );
          })}
        </div>

        {/* Desna kolona — izmiješana. */}
        <div className="space-y-2">
          {order.map((pairIndex) => {
            const pair = pairs[pairIndex];
            const heldBy = leftFor(pairIndex);
            const rtl = isRtlText(pair.right);
            return (
              <button
                key={pairIndex}
                type="button"
                disabled={disabled}
                onClick={() => tapRight(pairIndex)}
                dir="auto"
                className={clsx(
                  "flex min-h-11 w-full items-center gap-1.5 rounded-sm border px-2 py-2 text-left text-sm transition-colors",
                  rtl && "font-arabic text-[15px]",
                  heldBy >= 0
                    ? "border-forest/50 bg-forest-wash/60 text-forest-deep"
                    : "border-rule bg-lift hover:border-forest/50",
                )}
              >
                <span className="min-w-0 flex-1">{pair.right}</span>
                {heldBy >= 0 ? (
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-none border border-forest bg-forest text-[0.6rem] font-bold text-paper"
                    title={`Spojeno sa ${heldBy + 1}`}
                  >
                    {heldBy + 1}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-muted">
        {connected}/{pairs.length} povezano · tapni stavku lijevo, pa njenu
        stavku desno
      </p>
    </div>
  );
}

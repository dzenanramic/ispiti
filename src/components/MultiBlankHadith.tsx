"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { countBlanks, splitBlankSegments } from "@/lib/parse-questions";

const ARABIC_RE = /[\u0600-\u06FF]/;
const RTL_CHARS = /[\u0591-\u07FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
// Oznaka praznine „(1)" odmah uz prazninu. Držimo je uz dugme, a ne kao
// zaseban tekst — u RTL rečenici bi se inače odvojila od svoje praznine.
const LABEL_RE = /^(\s*)\((\d{1,2})\)\s*/;

export function isRtlText(text: string): boolean {
  const rtl = (text.match(RTL_CHARS) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return rtl > latin;
}

/** Smjer pasusa: prevagne li arapski tekst, rečenica ide zdesna nalijevo. */
function directionOf(firstSegment: string): "rtl" | "ltr" {
  const rtl = (firstSegment.match(RTL_CHARS) ?? []).length;
  const latin = (firstSegment.match(/[A-Za-z]/g) ?? []).length;
  return rtl > 0 && rtl >= latin ? "rtl" : "ltr";
}

type Props = {
  prompt: string;
  options: string[];
  /** za svaku prazninu indeks iz banke ili -1. */
  value: number[];
  disabled?: boolean;
  onChange: (next: number[]) => void;
};

/**
 * Hadis sa više praznina. Arapski tekst se čita zdesna nalijevo, a praznine
 * ostaju na svom mjestu u rečenici — učenik tapne prazninu, pa tapne riječ iz
 * banke ispod. Riječi se ne prevlače i ne mijenjaju redoslijed.
 */
export function MultiBlankHadith({
  prompt,
  options,
  value,
  disabled = false,
  onChange,
}: Props) {
  const [active, setActive] = useState(0);
  const blanks = countBlanks(prompt);
  const segments = splitBlankSegments(prompt);
  const direction = directionOf(segments[0] ?? "");
  const filled = value.slice(0, blanks).filter((i) => i >= 0).length;

  const current = Array.from({ length: blanks }, (_, i) => value[i] ?? -1);
  const used = new Set(current.filter((i) => i >= 0));

  function place(optionIndex: number) {
    if (disabled) return;
    const next = [...current];
    // Ista riječ ne može stati u dvije praznine.
    const previous = next.indexOf(optionIndex);
    if (previous !== -1) next[previous] = -1;
    next[active] = optionIndex;
    onChange(next);

    const upcoming = next.findIndex((blank, i) => i > active && blank === -1);
    if (upcoming !== -1) setActive(upcoming);
  }

  function tapBlank(blankIndex: number) {
    if (disabled) return;
    // Tap na popunjenu prazninu je briše, tap na praznu je aktivira.
    if (current[blankIndex] >= 0) {
      const next = [...current];
      next[blankIndex] = -1;
      onChange(next);
    }
    setActive(blankIndex);
  }

  return (
    <div className="mt-2">
      <p
        dir={direction}
        className={clsx(
          "text-[15px] leading-[2.2] break-words",
          direction === "rtl" && "font-arabic text-[18px]",
        )}
      >
        {segments.map((segment, segmentIndex) => {
          // Oznaku „(n)" izvuci iz teksta da ostane uz svoju prazninu.
          const isBlankSlot = segmentIndex < blanks;
          const source = segmentIndex > 0 ? segment : segment;
          const labelMatch = isBlankSlot ? LABEL_RE.exec(source) : null;
          const text = labelMatch ? source.slice(labelMatch[0].length) : source;

          return (
            <span key={segmentIndex} className="contents">
              {text ? <span>{text}</span> : null}
              {isBlankSlot ? (
                <BlankPicker
                  index={segmentIndex}
                  label={labelMatch?.[2]}
                  word={options[current[segmentIndex]] ?? ""}
                  active={active === segmentIndex}
                  disabled={disabled}
                  onTap={() => tapBlank(segmentIndex)}
                />
              ) : null}
            </span>
          );
        })}
      </p>

      <div className="mt-3 rounded-sm border border-rule bg-paper p-2">
        <p className="mb-1.5 px-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
          Banka riječi · {filled}/{blanks}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((option, optionIndex) => {
            const isUsed = used.has(optionIndex);
            return (
              <button
                key={optionIndex}
                type="button"
                dir="auto"
                disabled={disabled || !option.trim()}
                onClick={() => place(optionIndex)}
                className={clsx(
                  "min-h-9 rounded-sm border px-2.5 py-1 text-sm transition-colors",
                  ARABIC_RE.test(option) && "font-arabic text-[16px]",
                  isUsed
                    ? "border-forest/40 bg-forest-wash text-forest-deep"
                    : "border-rule bg-lift text-ink hover:border-forest/60 active:bg-forest-wash",
                  disabled && "opacity-60",
                )}
                aria-pressed={isUsed}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlankPicker({
  index,
  label,
  word,
  active,
  disabled,
  onTap,
}: {
  index: number;
  label?: string;
  word: string;
  active: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  const filled = Boolean(word);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onTap}
      aria-label={
        filled
          ? `Praznina ${index + 1}: ${word}. Tapni da obrišeš.`
          : `Praznina ${index + 1} — tapni pa izaberi riječ iz banke.`
      }
      className={clsx(
        // `relative` drži oznaku (n) kao apsolutno pozicioniranu, van toka
        // teksta — tako je bidi algoritam nikad ne odvoji od praznine.
        "relative mx-1 inline-flex min-h-9 min-w-14 items-center justify-center whitespace-nowrap rounded-sm border-b-2 px-2 pt-2 pb-0.5 align-middle leading-tight",
        active && !filled
          ? "border-forest bg-forest-wash text-forest-deep ring-2 ring-forest/25"
          : filled
            ? "border-forest/60 bg-forest-wash/60 text-forest-deep"
            : "border-rule bg-paper/70 text-muted hover:border-forest/50",
      )}
    >
      {label ? (
        <span
          aria-hidden="true"
          className="absolute left-1 top-0 font-data text-[0.6rem] leading-none text-muted/80"
        >
          ({label})
        </span>
      ) : null}
      {filled ? (
        <span dir="auto" className="font-arabic text-[0.95rem]">
          {word}
        </span>
      ) : (
        <span aria-hidden="true" className="text-[0.8rem] opacity-60">
          ···
        </span>
      )}
    </button>
  );
}

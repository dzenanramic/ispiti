import type { QuestionInput, QuestionPair } from "./types";

export type ParseResult = {
  questions: QuestionInput[];
  errors: string[];
};

const ANSWER_RE =
  /^(?:ta[cč]no|tacno|answer|rje[sš]enje|rjesenje|odgovor)\s*[:\-]\s*(.+)$/i;
const BANK_RE = /^(?:rije[cč]i|rijeci|ponuda|bank|opcije)\s*[:\-]\s*(.+)$/i;
const BLANKS_RE =
  /^(?:praznine|blankovi|popuni|redom)\s*[:\-]\s*(.+)$/i;
const OPTION_RE = /^([A-Za-z])[.)]\s+(.+)$/;
/** Par za povezivanje: „1) arapski = bosanski" (grupa 2 = lijevo, 3 = desno). */
const PAIR_RE = /^\d{1,2}[.)]\s*([^=–—]+?)\s*(?:=>|–|—|=)\s*(.+)$/;
const BLANK_RE = /_{2,}/;

/** Broj praznina (`_____`) u tekstu pitanja. */
export function countBlanks(prompt: string): number {
  return (prompt.match(/\_{2,}/g) ?? []).length;
}

/**
 * Ako tekst ima oznake `(1)`, `(2)` … ali i praznine, broj praznina mora da se
 * poklopi sa oznakama. Vraća broj praznina ili -1 ako se ne poklapaju.
 */
export function blankCountMatchesLabels(prompt: string): number {
  const blanks = countBlanks(prompt);
  if (blanks === 0) return 0;
  const labels = new Set((prompt.match(/\(\d{1,2}\)/g) ?? []).map((m) => m));
  if (labels.size === 0) return blanks;
  return labels.size === blanks ? blanks : -1;
}

/**
 * Neki generatori napišu `_____ (1)` a neki samo `(1)` bez praznine. Ovo
 * dodaje prazninu ispred svake oznake `(n)` ispred koje nema praznine, da
 * tekst uvijek ima onoliko praznina koliko ima oznaka.
 */
export function ensureBlanksForLabels(prompt: string): string {
  return prompt.replace(
    /(_{2,})?\s*\((\d{1,2})\)/g,
    (_match: string, blank: string | undefined, label: string) =>
      blank ? `${blank} (${label})` : ` _____ (${label})`,
  );
}

/**
 * Dijeli tekst na dijelove oko praznina. Broj elemenata je `praznine + 1`.
 * Prazna ili nedostajuća praznina ruši poklapanje sa tačnim odgovorima, zato
 * gradnja UI-a uvijek ide preko `splitBlankSegments`.
 */
export function splitBlankSegments(prompt: string): string[] {
  return prompt.split(BLANK_RE);
}

/** Ispravlja redne brojeve u oznakama `(n)` prema stvarnom redu praznina. */
export function renumberBlankLabels(prompt: string): string {
  let index = 0;
  return prompt.replace(/(_{2,})\s*\((\d{1,2})\)/g, (match, blank: string) => {
    index += 1;
    return `${blank} (${index})`;
  });
}


function parseTf(raw: string): boolean | null {
  const value = raw.trim().toLowerCase().replace(/[.!]+$/, "");
  if (["t", "tačno", "tacno", "true", "da", "1"].includes(value)) return true;
  if (["n", "netačno", "netacno", "false", "ne", "0"].includes(value)) return false;
  return null;
}

function optionIndex(raw: string, options: string[]): number | null {
  const value = raw.trim();

  const letter = /^([A-Za-z])[.)]?$/.exec(value)?.[1];
  if (letter) {
    const index = letter.toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < options.length ? index : null;
  }

  const numeric = Number(value.replace(/[.)]$/, ""));
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) {
    return numeric - 1;
  }

  const exact = options.findIndex(
    (option) => option.toLocaleLowerCase("bs") === value.toLocaleLowerCase("bs"),
  );
  return exact >= 0 ? exact : null;
}

function splitBlocks(input: string): string[] {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  let blocks = normalized.split(/\n\s*\n+/).map((block) => block.trim());
  if (blocks.length === 1 && /\n\s*\d+[.)]\s+/.test(normalized)) {
    blocks = [];
    for (const line of normalized.split("\n")) {
      // Red sa parom („1) a = b") pripada pitanju iznad, ne počinje novo.
      const startsQuestion =
        /^\s*\d+[.)]\s+/.test(line) && !PAIR_RE.test(line.trim());
      if (startsQuestion || blocks.length === 0) {
        blocks.push(line);
      } else {
        blocks[blocks.length - 1] = `${blocks[blocks.length - 1]}\n${line}`;
      }
    }
    blocks = blocks.map((block) => block.trim()).filter(Boolean);
  }
  return blocks.filter(Boolean);
}

export function parseQuestions(input: string): ParseResult {
  const questions: QuestionInput[] = [];
  const errors: string[] = [];
  const blocks = splitBlocks(input);

  if (blocks.length === 0) {
    return { questions, errors: ["Nema teksta za uvoz."] };
  }

  blocks.forEach((block, blockIndex) => {
    const label = `Pitanje ${blockIndex + 1}`;
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const firstLine = lines.shift();
    if (!firstLine) return;

    let prompt = firstLine.replace(/^\s*\d+[.)]\s*/, "").trim();
    let answerRaw: string | null = null;
    let blanksRaw: string | null = null;
    let bank: string[] | null = null;
    const options: string[] = [];
    const pairs: QuestionPair[] = [];

    for (const line of lines) {
      const answerMatch = ANSWER_RE.exec(line);
      const blanksMatch = BLANKS_RE.exec(line);
      const bankMatch = BANK_RE.exec(line);
      const pairMatch = PAIR_RE.exec(line);
      const optionMatch = OPTION_RE.exec(line);

      if (answerMatch) {
        answerRaw = answerMatch[1].trim();
      } else if (blanksMatch) {
        blanksRaw = blanksMatch[1].trim();
      } else if (bankMatch) {
        bank = bankMatch[1]
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean);
      } else if (pairMatch) {
        const left = (pairMatch[1] ?? "").trim();
        const right = (pairMatch[2] ?? "").trim();
        if (!left || !right) {
          errors.push(`${label}: par „${line}" nema obje strane.`);
          return;
        }
        pairs.push({ left, right });
      } else if (optionMatch) {
        options.push(optionMatch[2].trim());
      } else if (options.length === 0 && !answerRaw) {
        // Nastavak pitanja u više redova.
        prompt = `${prompt} ${line}`.trim();
      }
    }

    if (!prompt) {
      errors.push(`${label}: nedostaje tekst pitanja.`);
      return;
    }

    if (pairs.length > 0) {
      if (pairs.length < 2) {
        errors.push(`${label}: povezivanje traži najmanje dva para.`);
        return;
      }
      if (pairs.length > 8) {
        errors.push(`${label}: najviše osam parova za povezivanje.`);
        return;
      }
      const lefts = new Set(pairs.map((pair) => pair.left.toLocaleLowerCase("bs")));
      const rights = pairs.map((pair) => pair.right.toLocaleLowerCase("bs"));
      if (lefts.size !== pairs.length) {
        errors.push(`${label}: dvije stavke s lijeve strane su iste.`);
        return;
      }
      if (new Set(rights).size !== pairs.length) {
        errors.push(`${label}: dvije stavke s desne strane su iste.`);
        return;
      }
      questions.push({
        type: "matching",
        prompt,
        options: [],
        correct: true,
        pairs,
      });
      return;
    }

    const resolvedAnswer: string = blanksRaw ?? answerRaw ?? "";

    if (!resolvedAnswer) {
      errors.push(`${label}: nedostaje red „Tačno: …" ili „Praznine: …".`);
      return;
    }

    if (bank) {
      if (bank.length < 2) {
        errors.push(`${label}: potrebne su najmanje dvije ponuđene riječi.`);
        return;
      }
      if (bank.length > 12) {
        errors.push(`${label}: najviše dvanaest ponuđenih riječi.`);
        return;
      }

      // Praznine: jedan odgovor po praznini, odvojen tačkom-zarezom.
      const parts = resolvedAnswer
        .split(/[;|]/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (blanksRaw && parts.length > 1) {
        const matches = blankCountMatchesLabels(prompt);
        if (matches < 0) {
          errors.push(
            `${label}: broj praznina (_____) se ne poklapa sa brojem oznaka (1), (2)…`,
          );
          return;
        }
        if (matches !== parts.length) {
          errors.push(
            `${label}: ima ${matches} praznina, a ${parts.length} odgovora u redu „Praznine:".`,
          );
          return;
        }
        const answers: number[] = [];
        for (const [blankNumber, part] of parts.entries()) {
          let index = optionIndex(part, bank);
          if (index === null) {
            index = bank.findIndex(
              (word) => word.toLocaleLowerCase("bs") === part.toLocaleLowerCase("bs"),
            );
            if (index < 0) index = null;
          }
          if (index === null) {
            errors.push(
              `${label}: praznina ${blankNumber + 1} („${part}") nije među ponuđenim riječima.`,
            );
            return;
          }
          answers.push(index);
        }
        const text = BLANK_RE.test(prompt) ? prompt : `${prompt} _____`;
        questions.push({
          type: "cloze_multi",
          prompt: text,
          options: bank,
          correct: answers,
        });
        return;
      }

      // Jedna praznina, jedna riječ.
      const single = parts[0] ?? resolvedAnswer;
      let correct: number | null = optionIndex(single, bank);
      if (correct === null) {
        const found = bank.findIndex(
          (word) => word.toLocaleLowerCase("bs") === single.toLocaleLowerCase("bs"),
        );
        if (found >= 0) correct = found;
      }
      if (correct === null || correct < 0) {
        errors.push(`${label}: tačan odgovor nije među ponuđenim riječima.`);
        return;
      }
      const clozePrompt = BLANK_RE.test(prompt) ? prompt : `${prompt} _____`;
      questions.push({ type: "cloze", prompt: clozePrompt, options: bank, correct });
      return;
    }

    if (options.length >= 2) {
      if (options.length > 12) {
        errors.push(`${label}: najviše dvanaest opcija.`);
        return;
      }
      const correct = optionIndex(resolvedAnswer, options);
      if (correct === null) {
        errors.push(`${label}: tačan odgovor mora biti slovo (A, B, …) ili tekst opcije.`);
        return;
      }
      questions.push({ type: "single", prompt, options, correct });
      return;
    }

    const tf = parseTf(resolvedAnswer);
    if (tf === null) {
      errors.push(`${label}: nema opcija, a odgovor nije prepoznat kao Tačno/Netačno.`);
      return;
    }
    questions.push({ type: "tf", prompt, options: [], correct: tf });
  });

  return { questions, errors };
}

/** Zadržano za stare pozive; kod „Dopuni" vraća tekst prije i poslije praznine. */
export function splitClozePrompt(prompt: string): [string, string] {
  const match = BLANK_RE.exec(prompt);
  if (!match || match.index === undefined) {
    return [prompt, ""];
  }
  return [prompt.slice(0, match.index), prompt.slice(match.index + match[0].length)];
}

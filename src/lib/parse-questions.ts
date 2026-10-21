import type { QuestionInput } from "./types";

export type ParseResult = {
  questions: QuestionInput[];
  errors: string[];
};

const ANSWER_RE =
  /^(?:ta[cč]no|tacno|answer|rje[sš]enje|rjesenje|odgovor)\s*[:\-]\s*(.+)$/i;
const BANK_RE = /^(?:rije[cč]i|rijeci|ponuda|bank|opcije)\s*[:\-]\s*(.+)$/i;
const OPTION_RE = /^([A-Za-z])[.)]\s+(.+)$/;
const BLANK_RE = /_{2,}/;

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
    blocks = normalized
      .split(/\n(?=\s*\d+[.)]\s+)/)
      .map((block) => block.trim())
      .filter(Boolean);
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
    let bank: string[] | null = null;
    const options: string[] = [];

    for (const line of lines) {
      const answerMatch = ANSWER_RE.exec(line);
      const bankMatch = BANK_RE.exec(line);
      const optionMatch = OPTION_RE.exec(line);

      if (answerMatch) {
        answerRaw = answerMatch[1].trim();
      } else if (bankMatch) {
        bank = bankMatch[1]
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean);
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

    if (!answerRaw) {
      errors.push(`${label}: nedostaje red „Tačno: …".`);
      return;
    }

    if (bank) {
      if (bank.length < 2) {
        errors.push(`${label}: potrebne su najmanje dvije ponuđene riječi.`);
        return;
      }
      if (bank.length > 8) {
        errors.push(`${label}: najviše osam ponuđenih riječi.`);
        return;
      }
      let correct = optionIndex(answerRaw, bank);
      if (correct === null) {
        correct = bank.findIndex(
          (word) => word.toLocaleLowerCase("bs") === answerRaw!.toLocaleLowerCase("bs"),
        );
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
      if (options.length > 8) {
        errors.push(`${label}: najviše osam opcija.`);
        return;
      }
      const correct = optionIndex(answerRaw, options);
      if (correct === null) {
        errors.push(`${label}: tačan odgovor mora biti slovo (A, B, …) ili tekst opcije.`);
        return;
      }
      questions.push({ type: "single", prompt, options, correct });
      return;
    }

    const tf = parseTf(answerRaw);
    if (tf === null) {
      errors.push(`${label}: nema opcija, a odgovor nije prepoznat kao Tačno/Netačno.`);
      return;
    }
    questions.push({ type: "tf", prompt, options: [], correct: tf });
  });

  return { questions, errors };
}

export function splitClozePrompt(prompt: string): [string, string] {
  const match = BLANK_RE.exec(prompt);
  if (!match || match.index === undefined) {
    return [prompt, ""];
  }
  return [prompt.slice(0, match.index), prompt.slice(match.index + match[0].length)];
}

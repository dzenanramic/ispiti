import { parseQuestions, splitClozePrompt } from "../src/lib/parse-questions";

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log("PASS", name);
  } else {
    failures += 1;
    console.log("FAIL", name, detail ?? "");
  }
}

const mixed = `1. Hadis je riječ, djelo ili odobrenje.
Tačno: T

2. Koji su dijelovi hadisa?
A) Isnad i matn
B) Sened i šerh
C) Matn i tefsir
D) Isnad i fikh
Tačno: A

3. Lanac prenosilaca naziva se _____.
Riječi: isnad, matn, šerh, tefsir
Tačno: isnad

4. Šta znači arapska riječ إسناد?
A) Lanac prenosilaca
B) Tekst hadisa
C) Tumačenje hadisa
Tačno: A

5. Matn je tekst hadisa.
Tačno: N`;
const r1 = parseQuestions(mixed);
check("mixed count", r1.questions.length === 5, r1.errors);
check("mixed errors", r1.errors.length === 0, r1.errors);
check("tf true", r1.questions[0].type === "tf" && r1.questions[0].correct === true);
check("single index", r1.questions[1].type === "single" && r1.questions[1].correct === 0);
check("cloze type", r1.questions[2].type === "cloze" && r1.questions[2].correct === 0);
check("cloze bank", JSON.stringify(r1.questions[2].options) === JSON.stringify(["isnad", "matn", "šerh", "tefsir"]));
check("arabic preserved", r1.questions[3].prompt.includes("إسناد"));

const noAnswer = parseQuestions("1. Pitanje?\nA) a\nB) b");
check("missing answer rejected", noAnswer.errors.length === 1 && noAnswer.questions.length === 0, noAnswer);

const badLetter = parseQuestions("1. Pitanje?\nA) a\nB) b\nTačno: D");
check("bad letter rejected", badLetter.errors.length === 1, badLetter);

const clozeNoBank = parseQuestions("1. Dopuni _____ .\nTačno: nešto");
check("cloze without bank rejected", clozeNoBank.errors.length === 1, clozeNoBank);

const clozeInvalid = parseQuestions("1. Dopuni _____ .\nRiječi: a, b\nTačno: c");
check("cloze invalid word rejected", clozeInvalid.errors.length === 1, clozeInvalid);

const noBlank = parseQuestions("1. Dopuni.\nRiječi: a, b\nTačno: a");
check("cloze blank appended", noBlank.questions[0]?.prompt.includes("_____"), noBlank.questions[0]?.prompt);
check("cloze split", JSON.stringify(splitClozePrompt("Prije _____ poslije")) === JSON.stringify(["Prije ", " poslije"]));

const numberedNoBlank = parseQuestions("1. Prvo?\nTačno: T\n2. Drugo?\nTačno: N");
check("no blank line split", numberedNoBlank.questions.length === 2, numberedNoBlank);

const dotted = parseQuestions("1. Pitanje?\nA. prvi\nB. drugi\nTačno: B");
check("A. format", dotted.questions[0]?.correct === 1, dotted);

const lower = parseQuestions("1. Pitanje?\nTačno: tacno");
check("lowercase tacno", lower.questions[0]?.type === "tf" && lower.questions[0]?.correct === true, lower);

const empty = parseQuestions("   ");
check("empty rejected", empty.errors.length === 1, empty);

const arabicCloze = parseQuestions("1. Arapska riječ za tekst? _____\nRiječi: متن, إسناد, شرح\nTačno: متن");
check("arabic cloze", arabicCloze.questions[0]?.type === "cloze" && arabicCloze.questions[0]?.correct === 0, arabicCloze);

console.log(failures === 0 ? "ALL PARSER TESTS PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

import { csvCell } from "../src/lib/csv";
let failures = 0;
function eq(name: string, actual: string, expected: string) {
  if (actual === expected) console.log("PASS", name);
  else { failures++; console.log("FAIL", name, "expected", expected, "got", actual); }
}
eq("plain", csvCell("Amina"), '"Amina"');
eq("quote", csvCell('He said "hi"'), '"He said ""hi"""');
eq("semicolon", csvCell("a;b"), '"a;b"');
eq("formula equals", csvCell("=1+1"), `"'=1+1"`);
eq("formula plus", csvCell("+1"), `"'+1"`);
eq("formula minus", csvCell("-1"), `"'-1"`);
eq("formula at", csvCell("@cmd"), `"'@cmd"`);
eq("leading space formula", csvCell("  =1+1"), `"'  =1+1"`);
eq("number", csvCell(5), '"5"');
eq("null", csvCell(null), '""');
console.log(failures === 0 ? "ALL CSV TESTS PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

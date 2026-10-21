/**
 * CSV polje uvijek u navodnicima. Vrijednosti koje Excel može protumačiti kao
 * formulu (=, +, -, @, tab, CR) dobijaju vodeći apostrof — odbrana od CSV
 * formula injectiona kad nastavnik otvori izvoz.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(text) || /^[=+\-@\t\r]/.test(text.trimStart())) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

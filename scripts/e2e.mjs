import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('.screenshots', { recursive: true });

const BASE = 'http://localhost:3000';
const QUIZ_TITLE = `Test iz hadisa — e2e ${Date.now().toString().slice(-5)}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const teacher = await teacherContext.newPage();
teacher.on('pageerror', (err) => console.log('TEACHER PAGEERROR', err.message));
teacher.on('dialog', (dialog) => dialog.accept());

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `.screenshots/${name}.png`, fullPage });
  console.log('shot', name);
}

// Login
await teacher.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await teacher.fill('#email', 'profesor@ispiti.local');
await teacher.fill('#password', 'profesor123');
await Promise.all([
  teacher.waitForURL('**/teacher', { timeout: 20000 }),
  teacher.click('button[type=submit]'),
]);

// Quizzes list
await teacher.goto(`${BASE}/teacher/quizzes`, { waitUntil: 'networkidle' });
await shot(teacher, '03-quizzes');

// New quiz
await teacher.getByRole('link', { name: /Novi kviz/ }).click();
await teacher.waitForURL('**/teacher/quizzes/new');
await teacher.waitForLoadState('networkidle');
await teacher.waitForTimeout(800);
await teacher.fill('#title', QUIZ_TITLE);
await teacher.fill('#lesson', 'Lekcija 1 — provjera');
await teacher.getByRole('button', { name: /Uvezi iz teksta/ }).click();
const template = `1. Hadis je riječ, djelo ili odobrenje Poslanika.
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
D) Vrsta hadisa
Tačno: A

5. Matn je tekst hadisa.
Tačno: T`;
await teacher.locator('textarea[placeholder="Zalijepi tekst ovdje…"]').fill(template);
await teacher.getByRole('button', { name: 'Dodaj pitanja', exact: true }).click();
await teacher.waitForTimeout(500);
await shot(teacher, '04-quiz-editor');

await teacher.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await teacher.waitForURL('**/teacher/quizzes', { timeout: 20000 });
await teacher.waitForTimeout(800);
await shot(teacher, '05-quizzes-after-save');

// Open class 3
await teacher.goto(`${BASE}/teacher/classes`, { waitUntil: 'networkidle' });
await shot(teacher, '06-classes');
await teacher.getByRole('link', { name: /3\. razred/ }).first().click();
await teacher.waitForURL('**/teacher/classes/**');
await shot(teacher, '07-class');

// Create session
await teacher.selectOption('select[name="quizId"]', { label: QUIZ_TITLE });
await teacher.getByRole('button', { name: /Otvori sesiju/ }).click();
await teacher.waitForURL('**/teacher/sessions/**', { timeout: 20000 });
await teacher.waitForTimeout(1000);
await shot(teacher, '08-session-lobby');

const joinUrl = await teacher.getByRole('link', { name: /Otvori/ }).first().getAttribute('href');
console.log('JOIN URL', joinUrl);

// Student on phone
const studentContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const student = await studentContext.newPage();
student.on('pageerror', (err) => console.log('STUDENT PAGEERROR', err.message));
await student.goto(joinUrl, { waitUntil: 'networkidle' });
await shot(student, '09-student-pick', false);

await student.getByRole('button', { name: /Amina Begić/ }).click();
await shot(student, '10-student-confirm', false);
await student.getByRole('button', { name: /To sam ja/ }).click();
await student.getByText('Sačekaj početak').waitFor({ timeout: 15000 });
await shot(student, '11-student-lobby', false);

// Start
const startButton = teacher.getByRole('button', { name: /Počni test/ });
await startButton.waitFor();
await teacher.waitForFunction(() => {
  const button = [...document.querySelectorAll('button')].find((element) =>
    element.textContent?.includes('Počni test'),
  );
  return button && !button.disabled;
}, { timeout: 20000 });
await startButton.click();

// Student starts
await student.getByText('Pitanje 1 od 5').waitFor({ timeout: 15000 });
await shot(student, '12-student-quiz-start', false);

const sections = student.locator('main section.card');
await sections.nth(0).getByRole('button', { name: 'Tačno', exact: true }).click();
await sections.nth(1).getByRole('button', { name: /Isnad i matn/ }).click();
await sections.nth(2).getByRole('button', { name: 'isnad', exact: true }).click();
await sections.nth(3).getByRole('button', { name: /Lanac prenosilaca/ }).click();
await sections.nth(4).getByRole('button', { name: 'Tačno', exact: true }).click();
await student.waitForTimeout(1200);
await shot(student, '13-student-answered', false);

await student.getByRole('button', { name: /Predaj test/ }).click();
await student.getByText('Test je predan').waitFor({ timeout: 15000 });
await shot(student, '14-student-submitted', false);

// Teacher live
await teacher.waitForTimeout(3000);
await shot(teacher, '15-session-live');

// Close
await teacher.getByRole('button', { name: /Završi/ }).click();
await teacher.getByRole('link', { name: /Pogledaj rezultate/ }).waitFor({ timeout: 15000 });
await shot(teacher, '16-session-closed');

await teacher.getByRole('link', { name: /Pogledaj rezultate/ }).click();
await teacher.waitForURL('**/results');
await teacher.waitForTimeout(800);
await shot(teacher, '17-results');

await teacher.getByRole('link', { name: /^Ocjene$/ }).first().click();
await teacher.waitForURL('**/grades');
await teacher.waitForTimeout(800);
await shot(teacher, '18-grades');

// Admin
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await adminContext.newPage();
await admin.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await admin.fill('#email', 'admin@ispiti.local');
await admin.fill('#password', 'admin123');
await Promise.all([
  admin.waitForURL('**/teacher', { timeout: 20000 }),
  admin.click('button[type=submit]'),
]);
await admin.goto(`${BASE}/teacher/admin`, { waitUntil: 'networkidle' });
await shot(admin, '19-admin');

console.log('E2E DONE');
await browser.close();

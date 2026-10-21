import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const QA = { email: 'qa.teacher@ispiti.local', password: 'QaTest12345!' };
const classUrl = 'https://ispiti-eta.vercel.app/teacher/classes/ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => { console.log('DIALOG', d.type(), d.message()); d.accept(); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', QA.email);
await page.fill('#password', QA.password);
await Promise.all([page.waitForURL('**/teacher', { timeout: 25000 }), page.click('button[type=submit]')]);
console.log('LOGIN OK');

// Check existing quizzes
await page.goto(`${BASE}/teacher/quizzes`, { waitUntil: 'networkidle' });
const quizList = await page.locator('body').innerText();
console.log('QUIZZES BEFORE:', quizList.includes('QA — hadis provjera') ? 'exists' : 'missing');

if (!quizList.includes('QA — hadis provjera')) {
  await page.goto(`${BASE}/teacher/quizzes/new`, { waitUntil: 'networkidle' });
  await page.fill('#title', 'QA — hadis provjera');
  await page.fill('#lesson', 'QA lekcija 1');
  await page.getByRole('button', { name: /Uvezi iz teksta/ }).click();
  const quizText = `1. Hadis je riječ, djelo ili odobrenje Poslanika.
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

5. Matn je tekst hadisa. <script>alert('xss')</script>
Tačno: T`;
  await page.locator('textarea[placeholder="Zalijepi tekst ovdje…"]').fill(quizText);
  await page.getByRole('button', { name: 'Dodaj pitanja', exact: true }).click();
  await page.getByText(/5 pitanja · 5 bodova/).waitFor({ timeout: 15000 });
  console.log('IMPORT 5 OK');
  await page.screenshot({ path: '.qa/05-quiz-editor.png', fullPage: true });
  await page.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
  await page.waitForURL('**/teacher/quizzes', { timeout: 20000 });
  await page.waitForTimeout(800);
  console.log('QUIZ SAVED');
}

// Duplicate options server validation
await page.goto(`${BASE}/teacher/quizzes/new`, { waitUntil: 'networkidle' });
await page.fill('#title', 'QA duplikat opcija');
await page.getByPlaceholder('Tekst pitanja…').fill('Pitanje sa duplikatima?');
await page.getByPlaceholder('Opcija A').fill('x');
await page.getByPlaceholder('Opcija B').fill('x');
await page.getByPlaceholder('Opcija C').fill('y');
await page.getByPlaceholder('Opcija D').fill('z');
await page.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await page.getByText(/opcije se ponavljaju/).waitFor({ timeout: 15000 });
console.log('SERVER DUPLICATE OPTIONS VALIDATION OK');
await page.screenshot({ path: '.qa/07-validation-duplicate.png', fullPage: true });

// Create session
await page.goto(classUrl, { waitUntil: 'networkidle' });
await page.selectOption('select[name="quizId"]', { label: 'QA — hadis provjera' });
await page.selectOption('select[name="duration"]', '180');
await page.getByRole('button', { name: /Otvori sesiju/ }).click();
await page.waitForURL('**/teacher/sessions/**', { timeout: 20000 });
await page.waitForLoadState('networkidle');
const sessionUrl = page.url();
const joinUrl = await page.getByRole('link', { name: /Otvori/ }).first().getAttribute('href');
const code = await page.locator('p.font-mono.text-3xl').innerText();
console.log('SESSION', sessionUrl, 'CODE', code, 'JOIN', joinUrl);
if (!joinUrl.startsWith('https://ispiti-eta.vercel.app/j/')) throw new Error('Join URL domain wrong: ' + joinUrl);
await page.screenshot({ path: '.qa/06-session-lobby.png', fullPage: true });
console.log('PHASE B2 DONE');
console.log(JSON.stringify({ classUrl, sessionUrl, code, joinUrl }));
await browser.close();

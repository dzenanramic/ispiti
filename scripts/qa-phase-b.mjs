import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const QA = { email: 'qa.teacher@ispiti.local', password: 'QaTest12345!' };
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

// Class
await page.goto(`${BASE}/teacher/classes`, { waitUntil: 'networkidle' });
await page.fill('#name', 'QA 3.A');
await page.getByRole('button', { name: /Dodaj odjeljenje/ }).click();
await page.waitForURL('**/teacher/classes/**', { timeout: 20000 });
await page.waitForLoadState('networkidle');
const classUrl = page.url();
console.log('CLASS', classUrl);

// Students incl. duplicate and whitespace
const names = `QA Amina Begić
QA Tarik Čengić
QA Lejla Dedić
QA Hamza Fazlić
QA Sara Ibrahimović
QA Emir Nuhanović
QA Amina Begić
   QA Sara Ibrahimović   `;
await page.fill('#names', names);
await page.getByRole('button', { name: /Dodaj na spisak/ }).click();
await page.getByText('6 aktivnih').waitFor({ timeout: 15000 });
console.log('STUDENTS 6 UNIQUE OK');

// Deactivate / reactivate
const emirRow = page.locator('li').filter({ hasText: 'QA Emir Nuhanović' }).last();
await emirRow.getByTitle('Deaktiviraj učenika').click();
await page.getByText('5 aktivnih').waitFor({ timeout: 15000 });
await page.getByText(/Neaktivni učenici \(1\)/).click();
await page.getByRole('button', { name: 'Vrati' }).click();
await page.getByText('6 aktivnih').waitFor({ timeout: 15000 });
console.log('DEACTIVATE/REACTIVATE OK');

// Import error path
await page.goto(`${BASE}/teacher/quizzes/new`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Uvezi iz teksta/ }).click();
await page.locator('textarea[placeholder="Zalijepi tekst ovdje…"]').fill('1. Pitanje bez odgovora?\nA) a\nB) b');
await page.getByRole('button', { name: 'Dodaj pitanja', exact: true }).click();
await page.getByText(/nedostaje red/).waitFor({ timeout: 10000 });
console.log('IMPORT ERROR OK');

// Main quiz
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
await page.getByText('Pitanje 5 od 5').waitFor({ timeout: 10000 });
await page.screenshot({ path: '.qa/05-quiz-editor.png', fullPage: true });
await page.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await page.waitForURL('**/teacher/quizzes', { timeout: 20000 });
await page.waitForTimeout(800);
console.log('QUIZ SAVED');

// Duplicate options -> server validation
await page.getByRole('link', { name: /Novi kviz/ }).click();
await page.waitForLoadState('networkidle');
await page.fill('#title', 'QA duplikat opcija');
await page.getByPlaceholder('Tekst pitanja…').fill('Pitanje sa duplikatima?');
await page.getByPlaceholder('Opcija A').fill('x');
await page.getByPlaceholder('Opcija B').fill('x');
await page.getByPlaceholder('Opcija C').fill('y');
await page.getByPlaceholder('Opcija D').fill('z');
await page.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await page.getByText(/opcije se ponavljaju/).waitFor({ timeout: 15000 });
console.log('SERVER DUPLICATE OPTIONS VALIDATION OK');

// Create session with main quiz
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

console.log('PHASE B DONE');
console.log(JSON.stringify({ classUrl, sessionUrl, code, joinUrl }));
await browser.close();

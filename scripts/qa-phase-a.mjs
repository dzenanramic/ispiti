import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const ADMIN = { email: 'admin@ispiti.local', password: 'LX3aomU787JEgjXai3RV' };
const QA = { email: 'qa.teacher@ispiti.local', password: 'QaTest12345!' };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await adminCtx.newPage();

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([page.waitForURL('**/teacher', { timeout: 25000 }), page.click('button[type=submit]')]);
  await page.waitForLoadState('networkidle');
}

await login(admin, ADMIN);
console.log('ADMIN LOGIN OK');

// Capture admin-owned resources
await admin.goto(`${BASE}/teacher/classes`, { waitUntil: 'networkidle' });
const classHref = await admin.getByRole('link', { name: /Treci/ }).first().getAttribute('href');
const adminClassId = classHref.split('/').pop();
await admin.goto(`${BASE}${classHref}`, { waitUntil: 'networkidle' });
const sessionHref = await admin.locator('a[href*="/teacher/sessions/"]').first().getAttribute('href');
const adminSessionId = sessionHref.split('/').pop();
await admin.goto(`${BASE}/teacher/quizzes`, { waitUntil: 'networkidle' });
const quizHref = await admin.locator('a[href*="/teacher/quizzes/"]').first().getAttribute('href');
const adminQuizId = quizHref.split('/').pop();
console.log('ADMIN IDS', { adminClassId, adminSessionId, adminQuizId });

// Create QA teacher
await admin.goto(`${BASE}/teacher/admin`, { waitUntil: 'networkidle' });
await admin.fill('#teacher-name', 'QA Nastavnik');
await admin.fill('#teacher-email', QA.email);
await admin.fill('#teacher-password', QA.password);
await admin.getByRole('button', { name: /Dodaj nastavnika/ }).click();
await admin.getByText(/Nastavnik QA Nastavnik je dodan/).waitFor({ timeout: 20000 });
console.log('CREATE TEACHER OK');

// Duplicate email must fail
await admin.fill('#teacher-name', 'QA Duplikat');
await admin.fill('#teacher-email', QA.email);
await admin.fill('#teacher-password', 'QaTest12345!');
await admin.getByRole('button', { name: /Dodaj nastavnika/ }).click();
await admin.getByText(/već postoji/).waitFor({ timeout: 20000 });
console.log('DUPLICATE TEACHER REJECTED OK');
await admin.screenshot({ path: '.qa/03-admin-teacher-created.png', fullPage: true });

// Logout
await admin.getByRole('button', { name: /Odjava/ }).click();
await admin.waitForURL('**/login');
console.log('ADMIN LOGOUT OK');

// QA teacher login
const qaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const qa = await qaCtx.newPage();
qa.on('pageerror', (e) => console.log('QA PAGEERROR', e.message));
await login(qa, QA);
const body = await qa.locator('body').innerText();
if (!body.includes('QA Nastavnik')) throw new Error('QA teacher name missing');
console.log('QA LOGIN OK');

// Admin route denied
await qa.goto(`${BASE}/teacher/admin`, { waitUntil: 'networkidle' });
console.log('QA ADMIN URL', qa.url());
if (!qa.url().endsWith('/teacher')) throw new Error('QA teacher accessed admin');
console.log('QA ADMIN DENIED OK');

// Other teacher's class denied
await qa.goto(`${BASE}/teacher/classes/${adminClassId}`, { waitUntil: 'networkidle' });
console.log('QA CLASS URL', qa.url());
if (!qa.url().endsWith('/teacher/classes')) throw new Error('QA teacher accessed admin class');

// Other teacher's session denied
await qa.goto(`${BASE}/teacher/sessions/${adminSessionId}`, { waitUntil: 'networkidle' });
console.log('QA SESSION URL', qa.url());
if (!qa.url().endsWith('/teacher')) throw new Error('QA teacher accessed admin session');

// Other teacher's quiz denied
await qa.goto(`${BASE}/teacher/quizzes/${adminQuizId}`, { waitUntil: 'networkidle' });
console.log('QA QUIZ URL', qa.url());
if (!qa.url().endsWith('/teacher/quizzes')) throw new Error('QA teacher accessed admin quiz');

// Unauthenticated redirect
const anonCtx = await browser.newContext();
const anon = await anonCtx.newPage();
await anon.goto(`${BASE}/teacher`, { waitUntil: 'networkidle' });
if (!anon.url().includes('/login')) throw new Error('Anonymous /teacher not redirected');
console.log('ANON REDIRECT OK');

// Cookies
const cookies = await qaCtx.cookies();
const session = cookies.find((c) => c.name === 'ispiti_session');
console.log('COOKIE', session && { httpOnly: session.httpOnly, secure: session.secure, sameSite: session.sameSite });
if (!session?.httpOnly || !session?.secure) throw new Error('Session cookie flags wrong');

await qa.screenshot({ path: '.qa/04-qa-teacher-dashboard.png', fullPage: true });
console.log('PHASE A DONE');
await browser.close();

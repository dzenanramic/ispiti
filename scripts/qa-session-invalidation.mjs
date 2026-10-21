import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const EMAIL = 'qa.teacher@ispiti.local';
const OLD = 'QaTest54321!';
const NEW = 'QaTest99999!';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function login(page, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', password);
  await Promise.all([page.waitForURL('**/teacher', { timeout: 25000 }), page.click('button[type=submit]')]);
}
const aCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await aCtx.newPage();
const bCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const b = await bCtx.newPage();

await login(a, OLD);
await login(b, OLD);
console.log('TWO SESSIONS LOGGED IN');

await a.goto(`${BASE}/teacher/account`, { waitUntil: 'networkidle' });
await a.fill('#current', OLD);
await a.fill('#next', NEW);
await a.fill('#repeat', NEW);
await a.getByRole('button', { name: /Promijeni lozinku/ }).click();
await a.getByText(/Lozinka je promijenjena/).waitFor({ timeout: 15000 });
console.log('PASSWORD CHANGED');

await a.goto(`${BASE}/teacher/quizzes`, { waitUntil: 'networkidle' });
console.log('CURRENT SESSION URL', a.url());
if (!a.url().includes('/teacher/quizzes')) throw new Error('Current session lost');

await b.goto(`${BASE}/teacher/classes`, { waitUntil: 'networkidle' });
console.log('OTHER SESSION URL', b.url());
if (!b.url().includes('/login')) throw new Error('Other session not invalidated');
console.log('SESSION INVALIDATION OK');

// Login with new password
await login(b, NEW);
console.log('NEW PASSWORD LOGIN OK');

// Student reactivation test
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
await b.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: 'networkidle' });
const emirRow = b.locator('li').filter({ hasText: 'QA Emir Nuhanović' }).last();
await emirRow.getByTitle('Deaktiviraj učenika').click();
await b.getByText(/5 aktivnih|7 aktivnih|8 aktivnih/).waitFor({ timeout: 15000 });
console.log('DEACTIVATED EMIR');

await b.fill('#names', 'QA Emir Nuhanović');
await b.getByRole('button', { name: /Dodaj na spisak/ }).click();
await b.waitForTimeout(2500);
const body = await b.locator('body').innerText();
const activeMatch = body.match(/(\d+) aktivnih/);
console.log('ACTIVE COUNT AFTER RE-ADD', activeMatch?.[1]);
const emirCount = await b.locator('li').filter({ hasText: 'QA Emir Nuhanović' }).count();
console.log('EMIR ROW COUNT', emirCount);
if (emirCount !== 1) throw new Error('Duplicate student created instead of reactivation');
console.log('STUDENT REACTIVATION OK');

await browser.close();

import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const sessionId = 'a84b658e-1d71-4fc6-8ea3-07b6a097e8ed';
const quizId = 'f95e3f5b-76d4-44a8-8830-fdf7c00a66eb';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => { console.log('DIALOG', d.type(), d.message()); d.accept(); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest12345!');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);
console.log('LOGIN OK');

// Results
await page.goto(`${BASE}/teacher/sessions/${sessionId}/results`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
for (const name of ['QA Amina Begić', 'QA Tarik Čengić', 'QA Lejla Dedić', 'QA Hamza Fazlić']) {
  const row = page.locator('tbody tr').filter({ hasText: name });
  console.log('RESULT', name, '=>', (await row.innerText()).replace(/\n/g, ' | '));
}
const resultsBody = await page.locator('body').innerText();
if (!resultsBody.includes('ručno upisano')) throw new Error('Manual marker missing in results');
await page.screenshot({ path: '.qa/10-results.png', fullPage: true });

// Used quiz edit lock
await page.goto(`${BASE}/teacher/quizzes/${quizId}`, { waitUntil: 'networkidle' });
await page.getByText(/već korišten/).waitFor({ timeout: 15000 });
await page.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await page.getByText(/ne može se mijenjati/).waitFor({ timeout: 20000 });
console.log('USED QUIZ EDIT BLOCKED');
await page.screenshot({ path: '.qa/11-quiz-locked.png', fullPage: true });

// Duplicate and archive/restore
await page.goto(`${BASE}/teacher/quizzes`, { waitUntil: 'networkidle' });
const mainRow = page.locator('li').filter({ hasText: 'QA — hadis provjera' }).first();
await mainRow.getByRole('button', { name: /Duplikuj/ }).click();
await page.waitForURL(/\/teacher\/quizzes\/[0-9a-f-]{36}/, { timeout: 20000 });
await page.waitForLoadState('networkidle');
await page.fill('#title', 'QA — kopija');
await page.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await page.waitForURL('**/teacher/quizzes', { timeout: 20000 });
await page.waitForTimeout(800);
const copyRow = page.locator('li').filter({ hasText: 'QA — kopija' }).first();
await copyRow.getByRole('button', { name: /Arhiviraj kviz/ }).click();
await page.getByText(/Arhivirani kvizovi \(1\)/).waitFor({ timeout: 15000 });
await page.getByText(/Arhivirani kvizovi \(1\)/).click();
await page.getByRole('button', { name: /Vrati/ }).click();
await page.waitForTimeout(1000);
console.log('DUPLICATE + ARCHIVE/RESTORE OK');

// Grades
await page.goto(`${BASE}/teacher/classes/${classId}/grades`, { waitUntil: 'networkidle' });
async function addGrade(value, note) {
  await page.selectOption('#studentId', { label: 'QA Amina Begić' });
  await page.selectOption('#value', String(value));
  await page.fill('#note', note);
  await page.getByRole('button', { name: /Upiši ocjenu/ }).click();
  await page.waitForTimeout(1200);
}
await addGrade(5, 'QA usmeno');
await addGrade(4, 'QA test');
const aminaRow = page.locator('tbody tr').filter({ hasText: 'QA Amina Begić' });
const deleteButtons = aminaRow.locator('button[title="Obriši ocjenu"]');
console.log('GRADE X BUTTONS', await deleteButtons.count());
if ((await deleteButtons.count()) !== 2) throw new Error('Expected two grade chips');
await deleteButtons.first().click();
await page.waitForTimeout(1200);
const afterDelete = await aminaRow.innerText();
console.log('AMINA GRADES AFTER DELETE', afterDelete.replace(/\n/g, ' | '));
await page.screenshot({ path: '.qa/12-grades.png', fullPage: true });

// CSV
const csvResponse = await ctx.request.get(`${BASE}/api/classes/${classId}/export`);
const csv = await csvResponse.text();
console.log('CSV status', csvResponse.status());
console.log('CSV has Amina', csv.includes('QA Amina Begić'), '| has 5', csv.includes('"5"'));
if (csvResponse.status() !== 200 || !csv.includes('QA Amina Begić')) throw new Error('CSV export failed');
await page.screenshot({ path: '.qa/13-teacher-final.png', fullPage: true });

// Admin access
const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await admin.fill('#email', 'admin@ispiti.local');
await admin.fill('#password', 'LX3aomU787JEgjXai3RV');
await Promise.all([admin.waitForURL('**/teacher'), admin.click('button[type=submit]')]);
await admin.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: 'networkidle' });
const adminClassBody = await admin.locator('body').innerText();
if (!adminClassBody.includes('QA 3.A')) throw new Error('Admin cannot see QA class');
await admin.goto(`${BASE}/teacher/sessions/${sessionId}/results`, { waitUntil: 'networkidle' });
if (!(await admin.locator('body').innerText()).includes('QA Amina Begić')) throw new Error('Admin cannot see QA results');
console.log('ADMIN ACCESS OK');

console.log('PHASE C2 DONE');
await browser.close();

import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const TEACHER = { email: 'qa.teacher@ispiti.local', password: 'QaTest12345!' };
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const sessionId = 'a84b658e-1d71-4fc6-8ea3-07b6a097e8ed';
const quizId = 'f95e3f5b-76d4-44a8-8830-fdf7c00a66eb';
const joinUrl = 'https://ispiti-eta.vercel.app/j/WEZHDG';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const teacherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const teacher = await teacherCtx.newPage();
teacher.on('dialog', (d) => { console.log('TEACHER DIALOG', d.type(), d.message()); d.accept(d.type() === 'prompt' ? '4' : undefined); });
teacher.on('pageerror', (e) => console.log('TEACHER PAGEERROR', e.message));

async function login(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);
  await Promise.all([page.waitForURL('**/teacher', { timeout: 25000 }), page.click('button[type=submit]')]);
  await page.waitForLoadState('networkidle');
}
await login(teacher, TEACHER);
console.log('TEACHER LOGIN OK');
await teacher.goto(`${BASE}/teacher/sessions/${sessionId}`, { waitUntil: 'networkidle' });
await teacher.waitForTimeout(800);

// Student A
const aCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const a = await aCtx.newPage();
let xssDialogs = 0;
a.on('dialog', (d) => { xssDialogs++; console.log('STUDENT A DIALOG', d.type(), d.message()); d.dismiss(); });
await a.goto(joinUrl, { waitUntil: 'networkidle' });
await a.getByRole('button', { name: /QA Amina Begić/ }).click();
await a.getByRole('button', { name: /To sam ja/ }).click();
await a.getByText('Sačekaj početak').waitFor({ timeout: 15000 });
console.log('STUDENT A LOBBY OK');

// Student B and name lock
const bCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const b = await bCtx.newPage();
await b.goto(joinUrl, { waitUntil: 'networkidle' });
const aminaB = b.getByRole('button', { name: /QA Amina Begić/ });
console.log('AMINA TAKEN', await aminaB.isDisabled());
if (!(await aminaB.isDisabled())) throw new Error('Name lock failed');
await b.getByRole('button', { name: /QA Tarik Čengić/ }).click();
await b.getByRole('button', { name: /To sam ja/ }).click();
await b.getByText('Sačekaj početak').waitFor({ timeout: 15000 });
console.log('STUDENT B LOBBY OK');

// Start
const start = teacher.getByRole('button', { name: /Počni test/ });
await teacher.waitForFunction(() => {
  const btn = [...document.querySelectorAll('button')].find((e) => e.textContent?.includes('Počni test'));
  return btn && !btn.disabled;
}, { timeout: 20000 });
await start.click();
await a.getByText('Pitanje 1 od 5').waitFor({ timeout: 15000 });
await b.getByText('Pitanje 1 od 5').waitFor({ timeout: 15000 });
console.log('SESSION STARTED');

const bodyText = await a.locator('body').innerText();
console.log('XSS TEXT PRESENT', bodyText.includes("<script>alert('xss')</script>"));
if (!bodyText.includes("<script>alert('xss')</script>")) throw new Error('XSS payload not rendered as text');
if (xssDialogs > 0) throw new Error('XSS executed');
if ((await a.locator('main script').count()) > 0) throw new Error('Script tag injected into main');
console.log('XSS SAFE');

// Student C late join
const cCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const c = await cCtx.newPage();
await c.goto(joinUrl, { waitUntil: 'networkidle' });
await c.getByRole('button', { name: /QA Hamza Fazlić/ }).click();
await c.getByRole('button', { name: /To sam ja/ }).click();
await c.getByText('Pitanje 1 od 5').waitFor({ timeout: 15000 });
console.log('LATE JOIN OK');

// A answers
const sections = a.locator('main section.card');
await sections.nth(0).getByRole('button', { name: 'Tačno', exact: true }).click();
await sections.nth(1).getByRole('button', { name: /Isnad i matn/ }).click();
await sections.nth(2).getByRole('button', { name: 'isnad', exact: true }).click();
await sections.nth(3).getByRole('button', { name: /Lanac prenosilaca/ }).click();
await sections.nth(4).getByRole('button', { name: 'Tačno', exact: true }).click();
await a.getByText('5/5 odgovoreno').waitFor({ timeout: 15000 });
await a.getByText('Sačuvano', { exact: true }).waitFor({ timeout: 15000 });
await a.waitForTimeout(500);
await a.screenshot({ path: '.qa/08-student-answered.png', fullPage: false });
await a.getByRole('button', { name: /Predaj test/ }).click();
await a.getByText('Test je predan').waitFor({ timeout: 15000 });
console.log('STUDENT A SUBMITTED');
if ((await a.locator('body').innerText()).includes('5/5')) throw new Error('Student sees score after submit');

// Teacher live
await teacher.waitForTimeout(2500);
await teacher.screenshot({ path: '.qa/09-session-live.png', fullPage: true });

// Close
await teacher.getByRole('button', { name: /Završi/ }).click();
await teacher.getByRole('link', { name: /Pogledaj rezultate/ }).waitFor({ timeout: 20000 });
await b.getByText('Test je predan').waitFor({ timeout: 20000 });
await c.getByText('Test je predan').waitFor({ timeout: 20000 });
console.log('CLOSE FINALIZED B AND C');

// Results
await teacher.getByRole('link', { name: /Pogledaj rezultate/ }).click();
await teacher.waitForURL('**/results');
await teacher.waitForTimeout(800);
const resultsText = await teacher.locator('body').innerText();
if (!resultsText.includes('QA Amina Begić')) throw new Error('Results missing student');
await teacher.screenshot({ path: '.qa/10-results.png', fullPage: true });

// Manual score for absent Lejla
await teacher.goto(`${BASE}/teacher/sessions/${sessionId}`, { waitUntil: 'networkidle' });
await teacher.waitForTimeout(500);
const lejlaRow = teacher.locator('tbody tr').filter({ hasText: 'QA Lejla Dedić' });
await lejlaRow.getByTitle('Ručno upiši rezultat').click();
await teacher.waitForTimeout(2000);
const lejlaText = await lejlaRow.innerText();
console.log('LEJLA ROW', lejlaText.replace(/\n/g, ' | '));
if (!lejlaText.includes('4/5')) throw new Error('Manual score failed');
console.log('MANUAL SCORE OK');

// Quiz edit lock
await teacher.goto(`${BASE}/teacher/quizzes/${quizId}`, { waitUntil: 'networkidle' });
const lockedBanner = await teacher.getByText(/već korišten/).count();
console.log('LOCKED BANNER', lockedBanner);
if (lockedBanner === 0) throw new Error('Missing used-quiz banner');
await teacher.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await teacher.getByText(/ne može se mijenjati/).waitFor({ timeout: 20000 });
console.log('USED QUIZ EDIT BLOCKED');
await teacher.screenshot({ path: '.qa/11-quiz-locked.png', fullPage: true });

// Duplicate used quiz
await teacher.goto(`${BASE}/teacher/quizzes`, { waitUntil: 'networkidle' });
const mainQuizRow = teacher.locator('li').filter({ hasText: 'QA — hadis provjera' }).first();
await mainQuizRow.getByRole('button', { name: /Duplikuj/ }).click();
await teacher.waitForURL(/\/teacher\/quizzes\/[0-9a-f-]{36}/, { timeout: 20000 });
await teacher.waitForLoadState('networkidle');
const copyUrl = teacher.url();
await teacher.fill('#title', 'QA — kopija');
await teacher.getByRole('button', { name: /Sačuvaj kviz/ }).first().click();
await teacher.waitForURL('**/teacher/quizzes', { timeout: 20000 });
await teacher.getByText('QA — kopija').waitFor({ timeout: 15000 });
console.log('DUPLICATE QUIZ OK', copyUrl);

// Grades
await teacher.goto(`${BASE}/teacher/classes/${classId}/grades`, { waitUntil: 'networkidle' });
await teacher.selectOption('#studentId', { label: 'QA Amina Begić' });
await teacher.selectOption('#value', '5');
await teacher.fill('#note', 'QA usmeno');
await teacher.getByRole('button', { name: /Upiši ocjenu/ }).click();
await teacher.getByText('QA usmeno').waitFor({ timeout: 15000 }).catch(() => {});
await teacher.waitForTimeout(1000);
await teacher.selectOption('#studentId', { label: 'QA Amina Begić' });
await teacher.selectOption('#value', '4');
await teacher.fill('#note', 'QA test');
await teacher.getByRole('button', { name: /Upiši ocjenu/ }).click();
await teacher.waitForTimeout(1500);
const gradesText = await teacher.locator('body').innerText();
console.log('GRADES HAS I:', gradesText.includes('I:'));
if (!gradesText.includes('I:')) throw new Error('Grade chips missing');
await teacher.screenshot({ path: '.qa/12-grades.png', fullPage: true });

// CSV with cookie
const csvResponse = await teacherCtx.request.get(`${BASE}/api/classes/${classId}/export`);
const csv = await csvResponse.text();
console.log('CSV STATUS', csvResponse.status(), 'contains Amina', csv.includes('QA Amina Begić'), 'contains grade', csv.includes('5'));
if (csvResponse.status() !== 200 || !csv.includes('QA Amina Begić')) throw new Error('CSV export failed');
await teacher.screenshot({ path: '.qa/13-final-teacher.png', fullPage: true });

console.log('PHASE C DONE');
console.log(JSON.stringify({ copyUrl }));
await browser.close();

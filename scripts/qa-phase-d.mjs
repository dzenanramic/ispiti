import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
const BASE = 'https://ispiti-eta.vercel.app';
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const urls = JSON.parse(readFileSync('.supabase-urls.json', 'utf8'));
const sql = postgres((urls.pooler).split('?')[0] + '?sslmode=require', { max: 1, prepare: false, ssl: 'require' });

const teacherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const teacher = await teacherCtx.newPage();
teacher.on('dialog', (d) => { console.log('DIALOG', d.type(), d.message()); d.accept(); });
await teacher.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await teacher.fill('#email', 'qa.teacher@ispiti.local');
await teacher.fill('#password', 'QaTest12345!');
await Promise.all([teacher.waitForURL('**/teacher'), teacher.click('button[type=submit]')]);
await teacher.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: 'networkidle' });
await teacher.selectOption('select[name="quizId"]', { label: 'QA — hadis provjera' });
await teacher.selectOption('select[name="duration"]', '180');
await teacher.getByRole('button', { name: /Otvori sesiju/ }).click();
await teacher.waitForURL('**/teacher/sessions/**', { timeout: 20000 });
await teacher.waitForLoadState('networkidle');
const sessionId = teacher.url().split('/').pop();
const joinUrl = await teacher.getByRole('link', { name: /Otvori/ }).first().getAttribute('href');
const code = await teacher.locator('p.font-mono.text-3xl').innerText();
console.log('SESSION', sessionId, code, joinUrl);

// Join lock
await teacher.getByRole('button', { name: /Zaključaj ulaz/ }).click();
await teacher.getByRole('button', { name: /Otvori ulaz/ }).waitFor({ timeout: 10000 });
const blockedCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const blocked = await blockedCtx.newPage();
await blocked.goto(joinUrl, { waitUntil: 'networkidle' });
await blocked.getByText(/zaključao ulaz/).waitFor({ timeout: 10000 });
console.log('JOIN LOCK OK');
await blocked.screenshot({ path: '.qa/15-join-locked.png', fullPage: false });
await blockedCtx.close();

await teacher.getByRole('button', { name: /Otvori ulaz/ }).click();
await teacher.getByRole('button', { name: /Zaključaj ulaz/ }).waitFor({ timeout: 10000 });

// Student joins
const sCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const s = await sCtx.newPage();
await s.goto(joinUrl, { waitUntil: 'networkidle' });
await s.getByRole('button', { name: /QA Sara Ibrahimović/ }).click();
await s.getByRole('button', { name: /To sam ja/ }).click();
await s.getByText('Sačekaj početak').waitFor({ timeout: 15000 });
await teacher.waitForFunction(() => {
  const b = [...document.querySelectorAll('button')].find((e) => e.textContent?.includes('Počni test'));
  return b && !b.disabled;
}, { timeout: 20000 });
await teacher.getByRole('button', { name: /Počni test/ }).click();
await s.getByText('Pitanje 1 od 5').waitFor({ timeout: 15000 });

// Offline autosave
await sCtx.setOffline(true);
await s.locator('main section.card').nth(0).getByRole('button', { name: 'Tačno', exact: true }).click();
await s.getByText('Nije sačuvano').waitFor({ timeout: 15000 });
console.log('OFFLINE ERROR SHOWN');
await s.screenshot({ path: '.qa/16-offline.png', fullPage: false });
await sCtx.setOffline(false);
await s.getByRole('button', { name: /Pokušaj ponovo/ }).click();
await s.getByText('Sačuvano', { exact: true }).waitFor({ timeout: 15000 });
console.log('OFFLINE RETRY OK');

// Reload resume
await s.reload({ waitUntil: 'networkidle' });
await s.getByText('Pitanje 1 od 5').waitFor({ timeout: 15000 });
await s.getByText('1/5 odgovoreno').waitFor({ timeout: 15000 });
const trueClass = await s.locator('main section.card').nth(0).getByRole('button', { name: 'Tačno', exact: true }).getAttribute('class');
console.log('RESUME Q1 CLASS', trueClass);
if (!trueClass.includes('bg-brand')) throw new Error('Answer not restored after reload');
console.log('REFRESH RESUME OK');

// Extend time
const timer = s.locator('main').getByText(/^\d{1,2}:\d{2}$/).first();
const before = await timer.innerText();
await teacher.getByRole('button', { name: /\+1 min/ }).click();
await s.waitForTimeout(4000);
const after = await timer.innerText();
console.log('TIMER', before, '->', after);
const toSec = (v) => { const [m, sec] = v.split(':').map(Number); return m * 60 + sec; };
if (toSec(after) < toSec(before) + 40) throw new Error('Extend time did not work');
console.log('EXTEND OK');

// Force timeout
await sql`update sessions set ends_at = now() - interval '1 minute' where id=${sessionId}`;
await s.getByText('Test je predan').waitFor({ timeout: 20000 });
console.log('TIMEOUT AUTO-FINALIZE OK');

// Close and reset attempt
await teacher.getByRole('button', { name: /Završi/ }).click();
await teacher.waitForTimeout(2000);
const row = teacher.locator('tbody tr').filter({ hasText: 'QA Sara Ibrahimović' });
const rowText = await row.innerText();
console.log('SARA ROW', rowText.replace(/\n/g, ' | '));
if (!rowText.includes('1/5')) throw new Error('Timeout answer not scored');
await row.getByTitle('Poništi pokušaj').click();
await teacher.waitForTimeout(2500);
const afterReset = await teacher.locator('tbody tr').filter({ hasText: 'QA Sara Ibrahimović' }).innerText();
console.log('AFTER RESET', afterReset.replace(/\n/g, ' | '));
if (!afterReset.includes('nije ušao')) throw new Error('Reset attempt failed');
console.log('RESET OK');

console.log('PHASE D DONE');
console.log(JSON.stringify({ sessionId, code }));
await sql.end({ timeout: 5 });
await browser.close();

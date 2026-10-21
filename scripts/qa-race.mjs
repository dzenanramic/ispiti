import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
const BASE = 'https://ispiti-eta.vercel.app';
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const urls = JSON.parse(readFileSync('.supabase-urls.json', 'utf8'));
const sql = postgres((urls.pooler).split('?')[0] + '?sslmode=require', { max: 1, prepare: false, ssl: 'require' });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest12345!');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);
await page.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: 'networkidle' });
await page.selectOption('select[name="quizId"]', { label: 'QA — hadis provjera' });
await page.selectOption('select[name="duration"]', '180');
await page.getByRole('button', { name: /Otvori sesiju/ }).click();
await page.waitForURL('**/teacher/sessions/**', { timeout: 20000 });
const sessionId = page.url().split('/').pop();
const joinUrl = await page.getByRole('link', { name: /Otvori/ }).first().getAttribute('href');
const code = joinUrl.split('/').pop();
console.log('SESSION', sessionId, code);

const [amina] = await sql`select id from students where class_id=${classId} and name='QA Amina Begić'`;
const [tarik] = await sql`select id from students where class_id=${classId} and name='QA Tarik Čengić'`;

const claim = (studentId, deviceToken) => fetch(`${BASE}/api/join/${code}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentId, deviceToken }),
});
const [r1, r2] = await Promise.all([
  claim(amina.id, 'race-device-aaaaaaaa'),
  claim(amina.id, 'race-device-bbbbbbbb'),
]);
const [t1, t2] = await Promise.all([r1.text(), r2.text()]);
console.log('RACE', r1.status, t1, '|', r2.status, t2);
const statuses = [r1.status, r2.status].sort();
if (JSON.stringify(statuses) !== JSON.stringify([200, 409])) throw new Error('Race not handled: ' + statuses);
console.log('JOIN RACE OK');

const again = await claim(tarik.id, 'race-device-aaaaaaaa');
console.log('SAME DEVICE SECOND NAME', again.status, await again.text());
if (again.status !== 200) throw new Error('Idempotent device claim failed');
const count = await sql`select count(*)::int c from attempts where session_id=${sessionId}`;
console.log('ATTEMPTS COUNT', count[0].c);
if (count[0].c !== 1) throw new Error('One device created multiple attempts');

const invalid = await claim('00000000-0000-4000-8000-000000000000', 'race-device-cccccccc');
console.log('INVALID STUDENT', invalid.status);
if (invalid.status !== 404) throw new Error('Invalid student accepted');

await sql`update sessions set status='closed', closed_at=now() where id=${sessionId}`;
await sql.end({ timeout: 5 });
console.log('RACE CHECKS DONE');
await browser.close();

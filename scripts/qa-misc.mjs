import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());

// Wrong password
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'pogresna-lozinka');
await page.click('button[type=submit]');
await page.getByText(/Pogrešan email ili lozinka/).waitFor({ timeout: 15000 });
console.log('WRONG PASSWORD OK');

// Login
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest12345!');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);
console.log('LOGIN OK');

// Grade delete
await page.goto(`${BASE}/teacher/classes/${classId}/grades`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const row = page.locator('tbody tr').filter({ hasText: 'QA Amina Begić' });
const before = await row.locator('button[title="Obriši ocjenu"]').count();
console.log('GRADES BEFORE', before);
await row.locator('button[title="Obriši ocjenu"]').first().click();
await page.waitForTimeout(4000);
await page.reload({ waitUntil: 'networkidle' });
const after = await page.locator('tbody tr').filter({ hasText: 'QA Amina Begić' }).locator('button[title="Obriši ocjenu"]').count();
console.log('GRADES AFTER', after);
if (after !== before - 1) throw new Error('Grade delete failed');
const csv = await (await ctx.request.get(`${BASE}/api/classes/${classId}/export`)).text();
const line = csv.split('\n').find((l) => l.includes('QA Amina'));
console.log('CSV LINE', line);
if (!line.includes('1. polugodište') || !line.includes('2. polugodište')) throw new Error('CSV terms missing');
console.log('GRADE DELETE + CSV OK');

// 404s
for (const path of ['/teacher/classes/00000000-0000-4000-8000-000000000000', '/teacher/sessions/00000000-0000-4000-8000-000000000000']) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  console.log(path, res.status());
  if (res.status() !== 404) throw new Error('Expected 404: ' + path);
}
console.log('404 PAGES OK');

// Invalid join code
const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const sp = await anon.newPage();
await sp.goto(`${BASE}/j/NOPE00`, { waitUntil: 'networkidle' });
await sp.getByText(/Test sa tim kodom ne postoji/).waitFor({ timeout: 15000 });
console.log('INVALID CODE OK');

// Mobile teacher
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await mp.fill('#email', 'qa.teacher@ispiti.local');
await mp.fill('#password', 'QaTest12345!');
await Promise.all([mp.waitForURL('**/teacher'), mp.click('button[type=submit]')]);
await mp.waitForTimeout(800);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log('MOBILE OVERFLOW', overflow);
if (overflow > 2) throw new Error('Mobile horizontal overflow');
await mp.screenshot({ path: '.qa/17-mobile-teacher.png', fullPage: true });

console.log('MISC DONE');
await browser.close();

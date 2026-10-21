import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const classId = 'ef4406c3-13d6-4090-af8e-7fc2772a0de5';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest12345!');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);
await page.goto(`${BASE}/teacher/classes/${classId}/grades`, { waitUntil: 'networkidle' });

// Add term 2 grade
await page.selectOption('#studentId', { label: 'QA Amina Begić' });
await page.selectOption('#term', '2. polugodište');
await page.selectOption('#value', '3');
await page.fill('#note', 'QA drugi termin');
await page.getByRole('button', { name: /Upiši ocjenu/ }).click();
await page.waitForTimeout(2500);
const row = page.locator('tbody tr').filter({ hasText: 'QA Amina Begić' });
let text = await row.innerText();
console.log('AFTER TERM2', text.replace(/\n/g, ' | '));
if (!text.includes('II:')) throw new Error('Term 2 grade missing');

// Delete one term 1 grade
const before = await row.locator('button[title="Obriši ocjenu"]').count();
await row.locator('button[title="Obriši ocjenu"]').first().click();
await page.waitForTimeout(2500);
const after = await row.locator('button[title="Obriši ocjenu"]').count();
console.log('DELETE COUNT', before, '->', after);
if (after !== before - 1) throw new Error('Grade delete failed');

const csv = await (await ctx.request.get(`${BASE}/api/classes/${classId}/export`)).text();
const line = csv.split('\n').find((l) => l.includes('QA Amina'));
console.log('CSV', line);
console.log('GRADES2 DONE');
await browser.close();

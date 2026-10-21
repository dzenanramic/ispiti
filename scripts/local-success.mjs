import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'profesor@ispiti.local');
await page.fill('#password', 'profesor123');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);

// Class detail page tab label
await page.goto(`${BASE}/teacher/classes`, { waitUntil: 'networkidle' });
await page.getByRole('link', { name: /4\. razred/ }).first().click();
await page.waitForURL('**/teacher/classes/**');
const classId = page.url().split('/').pop();
const classBody = await page.locator('body').innerText();
if (classBody.includes('Ocjene')) throw new Error('Class page still says Ocjene');
if (!classBody.includes('Uspjeh')) throw new Error('Class page missing Uspjeh');
await page.screenshot({ path: '.qa/success-class.png', fullPage: true });

// Success page
await page.goto(`${BASE}/teacher/classes/${classId}/grades`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const body = await page.locator('body').innerText();
console.log('TITLE', body.split('\n').slice(0, 12).join(' | '));
if (body.includes('Upiši ocjenu') || body.includes('Tabela bodova i ocjena')) throw new Error('Grade table still present');
if (!body.includes('Uspjeh po testovima')) throw new Error('Success table missing');
if (!body.toLowerCase().includes('prosjek odjeljenja')) throw new Error('Stats missing');
console.log('SUCCESS PAGE OK');
await page.screenshot({ path: '.qa/success-page.png', fullPage: true });

// CSV without grades column
const csv = await (await ctx.request.get(`${BASE}/api/classes/${classId}/export`)).text();
console.log('CSV HEAD', csv.split('\n')[0]);
if (csv.includes('Ocjene')) throw new Error('CSV still has grades column');

// Results page link
await page.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: 'networkidle' });
await page.locator('a[href*="/teacher/sessions/"]').first().click();
await page.waitForURL('**/teacher/sessions/**');
const sessionUrl = page.url();
await page.goto(`${sessionUrl}/results`, { waitUntil: 'networkidle' });
const resultsBody = await page.locator('body').innerText();
if (resultsBody.includes('Ocjene')) throw new Error('Results still says Ocjene');
if (!resultsBody.includes('pregledu uspjeha')) throw new Error('Results text not updated');
console.log('RESULTS LINK OK');
await browser.close();

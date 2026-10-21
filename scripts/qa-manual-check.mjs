import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest12345!');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);
await page.goto(`${BASE}/teacher/sessions/a84b658e-1d71-4fc6-8ea3-07b6a097e8ed`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
for (const name of ['QA Amina Begić', 'QA Tarik Čengić', 'QA Lejla Dedić', 'QA Hamza Fazlić']) {
  const row = page.locator('tbody tr').filter({ hasText: name });
  console.log(name, '=>', (await row.innerText()).replace(/\n/g, ' | '));
}
await page.screenshot({ path: '.qa/14-manual-score.png', fullPage: true });
await browser.close();

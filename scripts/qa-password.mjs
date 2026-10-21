import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
async function login(email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  return page.url();
}
await login('qa.teacher@ispiti.local', 'QaTest12345!');
if (!page.url().endsWith('/teacher')) throw new Error('Initial login failed');
await page.goto(`${BASE}/teacher/account`, { waitUntil: 'networkidle' });
await page.fill('#current', 'pogresna');
await page.fill('#next', 'QaTest54321!');
await page.fill('#repeat', 'QaTest54321!');
await page.getByRole('button', { name: /Promijeni lozinku/ }).click();
await page.getByText(/Trenutna lozinka nije ispravna/).waitFor({ timeout: 15000 });
console.log('WRONG CURRENT PASSWORD OK');

await page.fill('#current', 'QaTest12345!');
await page.fill('#next', 'QaTest54321!');
await page.fill('#repeat', 'QaTest54321!');
await page.getByRole('button', { name: /Promijeni lozinku/ }).click();
await page.getByText(/Lozinka je promijenjena/).waitFor({ timeout: 15000 });
console.log('PASSWORD CHANGE OK');

await page.getByRole('button', { name: /Odjava/ }).click();
await page.waitForURL('**/login');
console.log('LOGOUT OK');
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest12345!');
await page.click('button[type=submit]');
await page.getByText(/Pogrešan email ili lozinka/).waitFor({ timeout: 15000 });
console.log('OLD PASSWORD REJECTED OK');
await page.fill('#email', 'qa.teacher@ispiti.local');
await page.fill('#password', 'QaTest54321!');
await Promise.all([page.waitForURL('**/teacher'), page.click('button[type=submit]')]);
console.log('NEW PASSWORD LOGIN OK');
await page.screenshot({ path: '.qa/20-password-changed.png', fullPage: true });
await browser.close();

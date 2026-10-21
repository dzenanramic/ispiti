import { chromium } from 'playwright';
const BASE = 'https://ispiti-eta.vercel.app';
const QA = { email: 'qa.teacher@ispiti.local', password: 'QaTest12345!' };
const adminClassId = '8cb1337e-d332-498a-b640-3046cebddf4d';
const adminSessionId = '4215c7c4-e990-47d7-9054-881ed929922f';
const adminQuizId = 'b8a00365-89b6-442f-8211-588650024fa7';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', QA.email);
await page.fill('#password', QA.password);
await Promise.all([page.waitForURL('**/teacher', { timeout: 25000 }), page.click('button[type=submit]')]);
console.log('QA LOGIN OK');

async function expectRedirect(path, expectedSuffix) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  console.log(path, '->', page.url());
  if (!page.url().endsWith(expectedSuffix)) throw new Error(`Expected ${expectedSuffix} for ${path}`);
}
await expectRedirect('/teacher/admin', '/teacher');
await expectRedirect(`/teacher/classes/${adminClassId}`, '/teacher/classes');
await expectRedirect(`/teacher/sessions/${adminSessionId}`, '/teacher');
await expectRedirect(`/teacher/quizzes/${adminQuizId}`, '/teacher/quizzes');
console.log('AUTHZ REDIRECTS OK');

const live = await ctx.request.get(`${BASE}/api/sessions/${adminSessionId}/live`);
console.log('live QA status', live.status());
if (live.status() !== 403) throw new Error('QA got live data for admin session');

const csv = await ctx.request.get(`${BASE}/api/classes/${adminClassId}/export`);
console.log('csv QA status', csv.status());
if (csv.status() !== 403) throw new Error('QA got admin CSV');

const anon = await browser.newContext();
const anonLive = await anon.request.get(`${BASE}/api/sessions/${adminSessionId}/live`);
console.log('live anon status', anonLive.status());
if (anonLive.status() !== 401) throw new Error('Anon got live data');

const badAttempt = await anon.request.get(`${BASE}/api/attempt/00000000-0000-4000-8000-000000000000`);
console.log('bad attempt status', badAttempt.status());
if (badAttempt.status() !== 404) throw new Error('Bad attempt not 404');

// static headers
const res = await anon.request.get(`${BASE}/login`);
console.log('headers', JSON.stringify({
  xcto: res.headers()['x-content-type-options'],
  xfo: res.headers()['x-frame-options'],
  csp: res.headers()['content-security-policy'],
  ref: res.headers()['referrer-policy'],
  powered: res.headers()['x-powered-by'],
}));
console.log('PHASE A2 DONE');
await browser.close();

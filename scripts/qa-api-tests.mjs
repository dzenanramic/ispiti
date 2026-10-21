const BASE = 'https://ispiti-eta.vercel.app';
const token = '330aa7ba-f914-4ba6-bb67-aeab62a7a1c9';
const questionId = 'f850fb90-c8a8-4518-ab49-dc4abdf3f54d';

async function req(path, init) {
  const r = await fetch(`${BASE}${path}`, init);
  const text = await r.text();
  return { status: r.status, text };
}
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let r = await req(`/api/attempt/${token}/answer`, json({ questionId, value: 0 }));
console.log('answer after submit', r.status, r.text);
if (r.status !== 409) throw new Error('answer after submit not 409');

r = await req(`/api/attempt/${token}/submit`, { method: 'POST' });
console.log('double submit', r.status, r.text);
if (r.status !== 200) throw new Error('double submit not idempotent');

r = await req(`/api/attempt/${token}`);
console.log('attempt after close', r.status, r.text.slice(0, 120));
if (r.status !== 200 || !r.text.includes('submitted')) throw new Error('attempt not submitted');

r = await req('/api/attempt/00000000-0000-4000-8000-000000000000');
console.log('random token', r.status);
if (r.status !== 404) throw new Error('random token not 404');

r = await req('/api/join/WEZHDG', json({ studentId: '00000000-0000-4000-8000-000000000000', deviceToken: 'qa-device-123456' }));
console.log('join closed', r.status, r.text);
if (r.status !== 410) throw new Error('join closed not 410');

r = await req('/api/join/ZZZZZZ');
console.log('invalid code', r.status);
if (r.status !== 404) throw new Error('invalid code not 404');

r = await req('/api/attempt/abcdef/answer', json({ questionId, value: 0 }));
console.log('answer invalid token', r.status);
if (r.status !== 404) throw new Error('invalid token not 404');

console.log('API TESTS DONE');

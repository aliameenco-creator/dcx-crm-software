import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { authHandler, createSession, verifySession, configured } from '../server/auth-core.js';
const c = { email: 'test@example.com', password: 'test-only-password-123', secret: 'test-only-secret-123456789012345678901234567890' };

test('session signatures, expiration and credential rotation are verified', () => {
  const token = createSession(c, 1000);
  assert.deepEqual(verifySession(token, c, 2000), { email: c.email });
  assert.equal(verifySession(token + 'x', c, 2000), null);
  assert.equal(verifySession(token, c, 1000 + 8 * 3600 * 1000), null);
  assert.equal(verifySession(token, { ...c, password: 'changed-password' }, 2000), null);
  assert.equal(verifySession(token, { ...c, email: 'other@example.com' }, 2000), null);
});
test('missing or short configuration fails closed', () => {
  assert.equal(configured({ email: '', password: '', secret: '' }), false);
  assert.equal(configured({ ...c, secret: 'short' }), false);
});
test('HTTP login, session check, wrong origin, wrong password, logout and throttling', async t => {
  const server = createServer((req, res) => authHandler(req, res, c));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', Origin: base };
  let res = await fetch(base); assert.deepEqual(await res.json(), { configured: true, user: null });
  res = await fetch(base, { method: 'POST', headers: { ...headers, Origin: 'https://elsewhere.example' }, body: JSON.stringify(c) }); assert.equal(res.status, 403);
  res = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ email: c.email, password: 'wrong' }) }); assert.equal(res.status, 401);
  res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(c) }); assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  res = await fetch(base, { headers: { Cookie: cookie.split(';')[0] } }); assert.deepEqual((await res.json()).user, { email: c.email });
  res = await fetch(base, { method: 'DELETE', headers }); assert.equal(res.status, 200); assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  for (let i = 0; i < 9; i++) res = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ email: c.email, password: 'wrong' }) });
  assert.equal(res.status, 429);
});

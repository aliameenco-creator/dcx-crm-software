import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createSession } from '../server/auth-core.js';
import { validateRecord } from '../server/crm-model.js';
import { crmHandler } from '../server/crm-api.js';
const id = '11111111-1111-4111-8111-111111111111';
const env = { APP_LOGIN_EMAIL: 'owner@example.com', APP_LOGIN_PASSWORD: 'test-password-long', APP_SESSION_SECRET: 's'.repeat(40), AUTOMATION_API_TOKEN: 't'.repeat(40) };
const cookie = `dcx_session=${createSession({ email: env.APP_LOGIN_EMAIL, password: env.APP_LOGIN_PASSWORD, secret: env.APP_SESSION_SECRET })}`;
test('CRM validates required fields, money, dates, IDs, and normalizes email', () => {
  assert.equal(validateRecord('contacts', { customer_id: id, name: ' Sam ', email: ' SAM@EXAMPLE.COM ' }).email, 'sam@example.com');
  assert.throws(() => validateRecord('equipment', { customer_id: id, name: 'UPS' }));
  assert.throws(() => validateRecord('purchases', { customer_id: id, name: 'Battery', source: 'Invoice', occurred_on: '2026-02-30' }));
  assert.throws(() => validateRecord('purchases', { customer_id: id, name: 'Battery', source: 'Invoice', occurred_on: '2026-02-20', amount: -1 }));
  assert.throws(() => validateRecord('contacts', { customer_id: 'bad', name: 'Sam', email: 'sam@example.com' }));
  assert.deepEqual(validateRecord('customers', { name: ' ABC ', malicious: 'ignored' }), { name: 'ABC', phone: '', notes: '', contact: '', email: '', billing_address: '', price_book: 'standard' });
});
async function serverFor(t, db) {
  const server = createServer((req, res) => crmHandler(req, res, env, db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
test('CRM rejects anonymous access, cross-origin writes, and automation writes', async t => {
  const base = await serverFor(t);
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base, { headers: { Cookie: cookie } })).status, 503);
  assert.equal((await fetch(base, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://wrong.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '?action=lookup', { method: 'POST', headers: { Authorization: `Bearer ${env.AUTOMATION_API_TOKEN}` }, body: '{}' })).status, 401);
  assert.equal((await fetch(base + '?entity=customers', { headers: { Authorization: `Bearer ${env.AUTOMATION_API_TOKEN}` } })).status, 401);
});
function fakeDb(tables, mutationResult = null) {
  return { from(table) {
    let rows = tables[table] || [], mutation = false;
    const query = {
      select() { return query; }, order() { return query; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      range(start, end) { rows = rows.slice(start, end + 1); return query; },
      insert() { mutation = true; return query; }, update() { mutation = true; return query; },
      single() { return Promise.resolve({ data: rows[0], error: null }); },
      maybeSingle() { return Promise.resolve(mutationResult || { data: mutation ? null : rows[0], error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
    }; return query;
  } };
}
test('lookup returns no match, exact linked history, and ambiguity without choosing', async t => {
  const tables = { crm_contacts: [{ name: 'Sam', email: 'sam@example.com', customer_id: id }], crm_customers: [{ id, name: 'ABC' }], crm_sites: [{ id: 'site', customer_id: id, name: 'Toronto' }] };
  const base = await serverFor(t, fakeDb(tables));
  const headers = { Authorization: `Bearer ${env.AUTOMATION_API_TOKEN}` };
  assert.equal((await (await fetch(base + '?action=lookup&email=missing@example.com', { headers })).json()).status, 'not_found');
  const matched = await (await fetch(base + '?action=lookup&email=SAM@example.com', { headers })).json();
  assert.equal(matched.status, 'matched'); assert.equal(matched.customer.name, 'ABC'); assert.equal(matched.sites[0].name, 'Toronto');
  tables.crm_contacts.push({ email: 'sam@example.com', customer_id: 'other' });
  const ambiguous = await (await fetch(base + '?action=lookup&email=sam@example.com', { headers })).json();
  assert.equal(ambiguous.status, 'needs_review'); assert.equal(ambiguous.customer, null);
});
test('stale updates and duplicate email conflicts do not report a successful save', async t => {
  const base = await serverFor(t, fakeDb({}));
  const response = await fetch(base, { method: 'PATCH', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, updated_at: '2026-09-16', name: 'ABC' }) });
  assert.equal(response.status, 409);
  const other = await serverFor(t, fakeDb({}, { error: { code: '23505' } }));
  assert.equal((await fetch(other, { method: 'POST', headers: { Cookie: cookie, Origin: other, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'ABC' }) })).status, 409);
});

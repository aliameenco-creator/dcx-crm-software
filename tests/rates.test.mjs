import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createSession } from '../server/auth-core.js';
import { crmHandler } from '../server/crm-api.js';
import { validatePriceBook } from '../server/rates-model.js';

const book = { id: 'standard', name: 'Standard', description: '', effectiveFrom: '2026-09-01', effectiveTo: '', status: 'Draft', items: [{ id: 'labor', description: 'Labor', supplier: '', unit: 'hour', costMode: 'manual', supplierCost: 0, manualCost: 100, multiplier: 1, exchangeRate: 1, margin: .3 }] };
const env = { APP_LOGIN_EMAIL: 'owner@example.com', APP_LOGIN_PASSWORD: 'test-password-long', APP_SESSION_SECRET: 's'.repeat(40) };
const cookie = `dcx_session=${createSession({ email: env.APP_LOGIN_EMAIL, password: env.APP_LOGIN_PASSWORD, secret: env.APP_SESSION_SECRET })}`;
test('invalid costs, duplicate rates and impossible dates cannot enter shared pricing', () => {
  assert.equal(validatePriceBook(book).items[0].manualCost, 100);
  for (const patch of [{ margin: 1 }, { exchangeRate: 0 }, { manualCost: -1 }, { supplierCost: '100' }, { costMode: 'other' }]) {
    assert.throws(() => validatePriceBook({ ...book, items: [{ ...book.items[0], ...patch }] }));
  }
  assert.throws(() => validatePriceBook({ ...book, effectiveFrom: '2026-02-30' }));
  assert.throws(() => validatePriceBook({ ...book, items: [...book.items, ...book.items] }));
});
test('shared rates survive a read, preserve history, and reject stale saves', async t => {
  const rows = [];
  const db = { from(table) {
    assert.equal(table, 'calculator_rate_versions');
    let filter, insertion, start = 0, end = Infinity;
    const result = () => rows.filter(r => !filter || r.book_id === filter).sort((a,b) => b.version - a.version).slice(start, end + 1);
    const query = {
      select() { return query; }, order() { return query; },
      eq(key, value) { filter = value; return query; },
      range(a,b) { start = a; end = b; return query; }, limit() { return query; },
      maybeSingle() { return Promise.resolve({ data: result()[0] || null }); },
      insert(row) { insertion = row; return query; },
      single() {
        const row = { ...insertion, created_at: new Date().toISOString() };
        if (rows.some(r => r.book_id === row.book_id && r.version === row.version)) return Promise.resolve({ error: { code: '23505' } });
        rows.push(row); return Promise.resolve({ data: row });
      },
      then(resolve, reject) { return Promise.resolve({ data: result() }).then(resolve, reject); }
    }; return query;
  } };
  const server = createServer((req,res) => crmHandler(req,res,env,db));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = origin + '/?action=rates';
  const save = (expectedVersion, value = book) => fetch(url, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ book: value, expectedVersion }) });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://other.example' }, body: '{}' })).status, 403);
  assert.equal((await save(null)).status, 201);
  assert.equal((await save(null)).status, 409);
  assert.equal((await save(1, { ...book, name: 'Updated' })).status, 201);
  assert.equal((await save(1)).status, 409);
  const saved = await (await fetch(url, { headers: { Cookie: cookie } })).json();
  assert.equal(saved.books[0].name, 'Updated');
  assert.equal(saved.books[0].version, 2);
  assert.equal(saved.history[0].name, 'Standard');
  assert.equal(rows[0].saved_by, env.APP_LOGIN_EMAIL);
});

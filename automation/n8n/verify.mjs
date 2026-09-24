import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir = new URL('./workflows/', import.meta.url);
const workflows = new Map();
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`PASS ${label}`); }
function run(w, name, json, prior = {}) {
  const node = w.nodes.find(n => n.name === name);
  assert(node, name);
  return vm.runInNewContext(`(function(){${node.parameters.jsCode}\n})()`, {
    $input: { first: () => ({ json }), all: () => [{ json }] },
    $execution: { id: 'test-execution' },
    $: name => ({ first: () => ({ json: prior[name] }) }), URL, Date,
  }, { timeout: 1000 });
}
for (const file of await readdir(dir)) {
  if (!file.endsWith('.json')) continue;
  const w = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
  workflows.set(file.split('-')[0], w);
  check(`${file}: graph and defaults`, () => {
    assert.equal(w.active, false);
    const names = new Set(w.nodes.map(n => n.name));
    assert.equal(names.size, w.nodes.length);
    for (const [source, conn] of Object.entries(w.connections)) {
      assert(names.has(source));
      for (const branch of conn.main) for (const edge of branch) assert(names.has(edge.node));
    }
    for (const n of w.nodes) {
      if (n.type.endsWith('.code')) new vm.Script(`(function(){${n.parameters.jsCode}\n})`);
      if (n.type.endsWith('.webhook')) assert.equal(n.parameters.authentication, 'headerAuth');
      assert(!n.retryOnFail, 'No automatic retry of external mutations');
    }
    const sample = run(w, 'Sample input', {})[0].json;
    const configured = run(w, 'Configuration', sample)[0].json;
    assert.equal(configured.config.dry_run, true);
    const validated = run(w, 'Validate input', configured)[0].json;
    const output = run(w, 'Sample result - no external calls', validated)[0].json;
    assert.equal(output.dry_run, true);
    assert.equal(output.persisted, false);
    assert.throws(() => run(w, 'Require configured HTTPS backend', validated), /Configure/);
    const poisoned = run(w, 'Configuration', { ...sample, config: { dry_run: false } })[0].json;
    assert.equal(poisoned.config.dry_run, true);
    assert.throws(() => run(w, 'Validate input', { input: {}, config: {} }), /Missing/);
  });
}
const intake = workflows.get('WF01');
check('duplicates stop before customer lookup', () => {
  assert.equal(run(intake, 'Stop duplicate ingestion', { accepted: false }).length, 0);
  assert.throws(() => run(intake, 'Stop duplicate ingestion', { accepted: true }), /message_id/);
});
check('tenders go to manual review; historical messages are record-only', () => {
  const x = { category: 'tender_rfq_rfp', urgency: 'high', summary: 'Bid request' };
  const prior = { 'Validate input': { payload: { direction: 'incoming', historical: false } } };
  assert.equal(run(intake, 'Validate triage', x, prior)[0].json.route, 'manual_review');
  prior['Validate input'].payload.historical = true;
  assert.equal(run(intake, 'Validate triage', x, prior)[0].json.route, 'record_only');
  assert.throws(() => run(intake, 'Validate triage', { ...x, category: 'invented' }, prior), /Invalid/);
});
check('unsourced technical draft rejected', () => {
  const x = { body_text: 'Unverified procedure', technical_claims: true, source_refs: [], missing_fields: [] };
  assert.throws(() => run(workflows.get('WF02'), 'Validate draft', x), /no source/);
});
check('quoted amounts must be deterministic decimal strings', () => {
  const x = { validated: true, revision_id: 'r1', formula_version: 'v1', currency: 'CAD', total_decimal: '123.45', missing_inputs: [] };
  assert.equal(run(workflows.get('WF03'), 'Validate calculated quote', x)[0].json.send_authorized, false);
  assert.throws(() => run(workflows.get('WF03'), 'Validate calculated quote', { ...x, total_decimal: 'NaN' }), /invalid/);
});
check('dispatch rejects stale revisions and expired leases', () => {
  const x = { claimed: true, authorized: true, approval_status: 'approved', current_revision: 1, approved_revision: 1, lease_token: 'lease', outbound_id: 'out', payload_hash: 'hash', send_mode: 'live', lease_expires_at: new Date(Date.now() + 60000).toISOString() };
  const w = workflows.get('WF05B');
  assert.equal(run(w, 'Require current authorized lease', x).length, 1);
  assert.throws(() => run(w, 'Require current authorized lease', { ...x, current_revision: 2 }), /not approved/);
  assert.throws(() => run(w, 'Require current authorized lease', { ...x, lease_expires_at: '2020-01-01T00:00:00Z' }), /expired/);
  assert.throws(() => run(w, 'Require current authorized lease', { ...x, authorized: false }), /not approved/);
});
check('knowledge chunks preserve page provenance and publication gate', () => {
  const w = workflows.get('WF00');
  const result = run(w, 'Validate extraction and split passages', { document_id: 'd', version: 1, content_hash: 'h', pages: [{ page: 2, text: 'x'.repeat(3100) }] })[0].json;
  assert(result.chunks.length > 1);
  assert(result.chunks.every(c => c.source_page === '2' && c.content.length <= 1600));
  assert.equal(result.status, 'draft');
  assert.throws(() => run(w, 'Validate homogeneous embeddings', { ...result, embedding_model: 'test', dimension: 3, chunks: [{ content: 'test', embedding: [1, 2] }] }), /Invalid vector/);
});
console.log(`${checks} checks passed; ${workflows.size} exports. Live n8n import and external integrations NOT tested.`);

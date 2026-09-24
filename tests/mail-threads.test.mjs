import test from 'node:test';
import assert from 'node:assert/strict';
import { mailThreads } from '../src/lib/mail-threads.ts';
const mail = (id, threadId, overrides = {}) => ({ id, threadId, date: '2026-09-19T08:00:00Z', from: 'Example', email: 'test@example.com', body: '', subject: 'Same subject', draft: '', clientId: '', category: 'General', status: 'Needs review', urgent: false, attachments: [], ...overrides });
test('mail groups by conversation ID, sorts history and preserves unrelated same-subject requests', () => {
  const input = [mail('new', 'a', { date: '2026-09-19T10:00:00Z' }), mail('other', 'b'), mail('old', 'a')];
  const groups = mailThreads(input);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].messages.map(m => m.id), ['old','new']);
  assert.equal(groups[0].latest.id, 'new');
  assert.deepEqual(input.map(m => m.id), ['new','other','old']);
});
test('an archived historical reply does not archive an active conversation; drafts are not marked sent', () => {
  const groups = mailThreads([mail('old','a',{status:'Archived',isRead:true}),mail('reply','a',{direction:'outgoing',status:'Draft saved',draft:'Pending response',date:'2026-09-19T10:00:00Z'})]);
  assert.equal(groups[0].archived, false);
  assert.equal(groups[0].unread, false);
  assert.equal(groups[0].latest.sentAt, undefined);
});

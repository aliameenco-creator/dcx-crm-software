import { createHash } from 'node:crypto';

export const workflowStatuses = ['needs_attention', 'draft_ready', 'waiting_customer', 'closed', 'failed'];
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function requireId(value) { if (!uuid(value)) throw new Error('A valid record ID is required.'); return value; }
export function revision(value) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('A valid revision is required.'); return value; }
export function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Enter ${required ? 'non-empty ' : ''}text up to ${max} characters.`);
  return value;
}
export function validateWorkflow(input) {
  requireId(input.thread_id); revision(input.version);
  if (!workflowStatuses.includes(input.status) || !['normal', 'high'].includes(input.priority)) throw new Error('Invalid conversation status or priority.');
  if (input.customer_id) requireId(input.customer_id);
  if (input.followup_at && !Number.isFinite(Date.parse(input.followup_at))) throw new Error('Invalid follow-up date.');
  return { thread_id: input.thread_id, version: input.version, status: input.status, priority: input.priority,
    assigned_to: text(input.assigned_to, 320), next_action: text(input.next_action, 2000),
    customer_id: input.customer_id || '', followup_at: input.followup_at || '' };
}
const hash = value => createHash('sha256').update(value).digest('hex');
const addresses = values => (values || []).map(r => r.emailAddress?.address?.toLowerCase()).filter(Boolean);
export function normalizeMessage(record, provider, mailbox) {
  if (!record?.id || record.isDraft) throw new Error('Only received or sent messages can be tracked.');
  const internetId = record.internetMessageId || null;
  const sender = record.from?.emailAddress?.address?.toLowerCase() || '';
  // Hostinger's UI conversation tokens expire and are subject-based: never persist them as identity.
  let providerKey = record.id;
  if (provider === 'hostinger') {
    if (internetId) providerKey = 'mid:' + hash(internetId);
    else {
      const ref = JSON.parse(Buffer.from(record.id.split('.')[0], 'base64url').toString());
      if (ref.kind !== 'message' || typeof ref.folder !== 'string' || !Number.isInteger(ref.uid)) throw new Error('Invalid provider reference.');
      providerKey = 'uid:' + hash(JSON.stringify([ref.folder, ref.uid]));
    }
  }
  const occurredAt = sender === mailbox.toLowerCase() ? record.sentDateTime || record.receivedDateTime : record.receivedDateTime || record.sentDateTime;
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error('Message has no valid timestamp.');
  const html = record.body?.contentType?.toLowerCase() === 'html';
  return { provider_key: providerKey, provider_ref: record.id,
    thread_key: provider === 'microsoft' ? record.conversationId || providerKey : 'mail:' + hash(record.inReplyTo || internetId || providerKey),
    internet_message_id: internetId, in_reply_to: record.inReplyTo || null,
    direction: sender === mailbox.toLowerCase() ? 'outgoing' : 'incoming', sender,
    to_addresses: addresses(record.toRecipients), cc_addresses: addresses(record.ccRecipients), subject: record.subject || '(No subject)',
    body_text: html ? '' : record.body?.content || record.bodyPreview || '', body_html: html ? record.body.content : '',
    body_loaded: !!record.body, has_attachments: !!record.hasAttachments, occurred_at: new Date(occurredAt).toISOString() };
}
export function pageCursor(value) {
  if (!value) return null;
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (!uuid(data.id) || typeof data.at !== 'string' || !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|\+00:00)$/.test(data.at) || !Number.isFinite(Date.parse(data.at))) throw 0;
    return data;
  } catch { throw new Error('Invalid page cursor.'); }
}
export const encodeCursor = (row, column) => Buffer.from(JSON.stringify({ at: row[column], id: row.id })).toString('base64url');

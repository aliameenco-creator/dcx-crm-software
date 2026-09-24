import { createHmac, timingSafeEqual } from 'node:crypto';
import { configuration, getSession } from './auth-core.js';
import { MailError, mailConfiguration, mailConfigured } from './microsoft-graph.js';
import { delegatedGraphClient } from './microsoft-oauth.js';
import { hostingerConfigured, hostingerConfiguration, hostingerMailHandler } from './hostinger-mail.js';

const fields = 'id,internetMessageId,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,lastModifiedDateTime,isRead,isDraft,importance,hasAttachments,parentFolderId,webLink,changeKey';
// Prevent parallel/repeated dispatch in one warm instance. Microsoft is still authoritative;
// a durable dispatch ledger is required before supporting multiple send workers.
const dispatches = new Map();
const respond = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
const segment = value => { if (typeof value !== 'string' || !value || value.length > 2048) throw new MailError(400, 'A valid message or folder ID is required.'); return encodeURIComponent(value); };
const version = m => m['@odata.etag'] || `W/"${m.changeKey}"`;
function seal(data, env) {
  const payload = Buffer.from(JSON.stringify({ ...data, mailbox: env.MICROSOFT_MAILBOX, exp: Date.now() + 10 * 60000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', env.APP_SESSION_SECRET).update(payload).digest('base64url')}`;
}
function unseal(value, kind, env) {
  try {
    if (typeof value !== 'string' || value.length > 20000) throw 0;
    const [payload, signature, extra] = value.split('.');
    const expected = createHmac('sha256', env.APP_SESSION_SECRET).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw 0;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.kind !== kind || data.mailbox !== env.MICROSOFT_MAILBOX || data.exp < Date.now()) throw 0;
    return data;
  } catch { throw new MailError(400, 'This review or page has expired. Refresh and try again.'); }
}
async function readBody(req) {
  let raw = '';
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 100000) throw new MailError(413, 'Message is too large.'); }
  if (Buffer.byteLength(raw) > 100000) throw new MailError(413, 'Message is too large.');
  try { return JSON.parse(raw || '{}'); } catch { throw new MailError(400, 'Invalid request.'); }
}
function content(value) { if (typeof value !== 'string' || !value.trim() || value.length > 50000) throw new MailError(400, 'Enter a message of up to 50,000 characters.'); return value; }
function recipients(value) {
  if (typeof value !== 'string') throw new MailError(400, 'Enter recipient email addresses.');
  const list = value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
  if (!list.length || list.length > 20 || list.some(v => v.length > 320 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v))) throw new MailError(400, 'Enter valid email addresses separated by commas (up to 20).');
  return list.map(address => ({ emailAddress: { address } }));
}
export async function microsoftMailHandler(req, res, env = process.env, injectedGraph) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!getSession(req, configuration(env))) return respond(res, 401, { error: 'Sign in with the configured workspace account to access Microsoft mail.' });
  if (!['GET', 'POST'].includes(req.method)) return respond(res, 405, { error: 'Method not allowed.' });
  if (req.method === 'POST' && (req.headers.origin !== `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${req.headers.host}` || req.headers['sec-fetch-site'] === 'cross-site')) return respond(res, 403, { error: 'Request origin is not allowed.' });
  const url = new URL(req.url, 'http://localhost'); const action = url.searchParams.get('action') || 'status';
  const config = mailConfiguration(env);
  let graph = injectedGraph, mailbox = config.mailbox;
  if (!graph) {
    const delegated = await delegatedGraphClient(env).catch(error => { if (['PGRST205','42P01'].includes(error.code)) return null; throw error; });
    if (delegated) { graph = delegated.graph; mailbox = delegated.connection.email_address; env = { ...env, MICROSOFT_MAILBOX: mailbox }; }
  }
  if (!graph) return respond(res, action === 'status' ? 200 : 503, { configured: false, provider: 'microsoft', connectionRequired: true, error: 'Connect a Microsoft mailbox from the dashboard.' });
  const page = async path => {
    const data = await graph(path);
    return { records: data.value || [], next: data['@odata.nextLink'] ? seal({ kind: 'page', path: data['@odata.nextLink'] }, env) : null };
  };
  try {
    if (req.method === 'GET') {
      if (action === 'status') { const inbox = await graph('/mailFolders/inbox?$select=id'); return respond(res, 200, { configured: true, connected: true, provider: 'microsoft', mailbox, inboxId: inbox.id }); }
      if (action === 'page') {
        const data = unseal(url.searchParams.get('cursor'), 'page', env);
        return respond(res, 200, await page(data.path));
      }
      if (action === 'folders') return respond(res, 200, await page(`${url.searchParams.has('parent') ? `/mailFolders/${segment(url.searchParams.get('parent'))}/childFolders` : '/mailFolders'}?$top=100&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount`));
      if (action === 'messages') {
        const params = new URLSearchParams({ '$top': '50', '$select': fields, '$orderby': 'receivedDateTime desc' });
        return respond(res, 200, await page(`/mailFolders/${segment(url.searchParams.get('folder') || 'inbox')}/messages?${params}`));
      }
      if (action === 'thread') {
        const conversation = url.searchParams.get('conversation'); segment(conversation);
        const params = new URLSearchParams({ '$top': '50', '$select': fields, '$filter': `conversationId eq '${conversation.replaceAll("'", "''")}'` });
        return respond(res, 200, await page(`/messages?${params}`));
      }
      if (action === 'message') {
        const record = await graph(`/messages/${segment(url.searchParams.get('id'))}?$select=${fields},body,uniqueBody,replyTo`, { text: url.searchParams.get('text') === 'true' });
        return respond(res, 200, { record, version: version(record) });
      }
      if (action === 'attachments') return respond(res, 200, await page(`/messages/${segment(url.searchParams.get('id'))}/attachments?$select=id,name,contentType,size,isInline&$top=50`));
      if (action === 'download') {
        const path = `/messages/${segment(url.searchParams.get('id'))}/attachments/${segment(url.searchParams.get('attachment'))}`;
        const metadata = await graph(path + '?$select=id,name,size');
        if (metadata.size > 3 * 1024 * 1024) throw new MailError(413, 'For attachments over 3 MB, use Open in Outlook.');
        const response = await graph(path + '/$value', { raw: true });
        const data = Buffer.from(await response.arrayBuffer());
        if (data.length > 3 * 1024 * 1024) throw new MailError(413, 'For attachments over 3 MB, use Open in Outlook.');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent((metadata.name || 'attachment').replace(/[\r\n]/g, ''))}`);
        res.statusCode = 200; return res.end(data);
      }
    } else {
      const input = await readBody(req);
      if (action === 'read') {
        if (typeof input.isRead !== 'boolean') throw new MailError(400, 'Read state is required.');
        await graph(`/messages/${segment(input.id)}`, { method: 'PATCH', body: { isRead: input.isRead } }); return respond(res, 200, { ok: true });
      }
      if (action === 'move') {
        const record = await graph(`/messages/${segment(input.id)}/move`, { method: 'POST', body: { destinationId: input.restore ? 'inbox' : 'archive' } });
        return respond(res, 200, { record });
      }
      if (action === 'draft') {
        const body = { contentType: 'Text', content: content(input.content) }; let record;
        if (input.draftId) {
          const path = `/messages/${segment(input.draftId)}`; const current = await graph(path + '?$select=id,isDraft,changeKey');
          if (!current.isDraft || input.version !== version(current)) throw new MailError(409, 'This draft changed or was sent. Reload it before editing.');
          record = await graph(path, { method: 'PATCH', etag: version(current), body: { body } });
        } else if (input.replyTo) {
          const path = `/messages/${segment(input.replyTo)}`;
          const original = await graph(path + '?$select=id,isDraft');
          if (original.isDraft) throw new MailError(400, 'Open the draft to edit it instead.');
          record = await graph(path + (input.replyAll ? '/createReplyAll' : '/createReply'), { method: 'POST', body: { message: { body } } });
        } else {
          if (typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 998) throw new MailError(400, 'Enter a subject.');
          record = await graph('/messages', { method: 'POST', body: { subject: input.subject, toRecipients: recipients(input.to), body } });
        }
        return respond(res, 200, { record, version: version(record) });
      }
      if (action === 'review') {
        const record = await graph(`/messages/${segment(input.id)}?$select=${fields},body`, { text: true });
        if (!record.isDraft || !record.toRecipients?.length || !record.body?.content?.trim()) throw new MailError(409, 'Open a saved draft with a recipient and message before reviewing.');
        return respond(res, 200, { record, approval: seal({ kind: 'approval', id: record.id, version: version(record) }, env) });
      }
      if (action === 'send') {
        const approved = unseal(input.approval, 'approval', env);
        for (const [key, expires] of dispatches) if (expires < Date.now()) dispatches.delete(key);
        const key = `${mailbox}:${approved.id}`;
        if (dispatches.has(key)) throw new MailError(409, 'A send was already requested for this draft. Check Sent Items in Outlook before taking another action.');
        dispatches.set(key, Date.now() + 10 * 60000);
        let requested = false;
        try {
          const record = await graph(`/messages/${segment(approved.id)}?$select=id,isDraft,changeKey`);
          if (!record.isDraft || version(record) !== approved.version) throw new MailError(409, 'This draft changed or was sent. Review its current version before sending.');
          requested = true;
          await graph(`/messages/${segment(approved.id)}/send`, { method: 'POST' });
        } catch (error) { if (!requested) dispatches.delete(key); throw error; }
        return respond(res, 202, { accepted: true, message: 'Microsoft accepted the send request. Delivery is not yet confirmed; check Sent Items.' });
      }
    }
    return respond(res, 400, { error: 'Unknown mail action.' });
  } catch (error) {
    if (error.retryAfter && /^\d+$/.test(error.retryAfter)) res.setHeader('Retry-After', error.retryAfter);
    return respond(res, error instanceof MailError ? error.status : 502, { error: error instanceof MailError ? error.message : 'Mail request failed. Refresh or check Outlook before retrying a write.' });
  }
}

export async function mailHandler(req, res, env = process.env, injectedGraph) {
  const requested = String(env.MAIL_PROVIDER || '').toLowerCase();
  const useHostinger = !injectedGraph && (requested === 'hostinger' || (requested !== 'microsoft' && hostingerConfigured(hostingerConfiguration(env)) && !mailConfigured(mailConfiguration(env))));
  return useHostinger ? hostingerMailHandler(req, res, env) : microsoftMailHandler(req, res, env, injectedGraph);
}

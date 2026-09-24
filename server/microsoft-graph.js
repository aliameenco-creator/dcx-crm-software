import { createHash } from 'node:crypto';

export const GRAPH = 'https://graph.microsoft.com/v1.0';
export class MailError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
export function mailConfiguration(env) {
  return { tenant: env.MICROSOFT_TENANT_ID || '', client: env.MICROSOFT_CLIENT_ID || '', secret: env.MICROSOFT_CLIENT_SECRET || '', mailbox: env.MICROSOFT_MAILBOX || '' };
}
export const mailConfigured = c => !!(c.tenant && c.client && c.secret && c.mailbox);
let cachedToken;
export function graphClient(env, transport = fetch) {
  const config = mailConfiguration(env);
  const root = `${GRAPH}/users/${encodeURIComponent(config.mailbox)}`;
  async function token() {
    const key = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    if (cachedToken?.key === key && cachedToken.until > Date.now()) return cachedToken.value;
    const response = await transport(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
      method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error',
      body: new URLSearchParams({ client_id: config.client, client_secret: config.secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    });
    if (!response.ok) throw new MailError(502, 'Microsoft authentication failed. Check the tenant, app credentials and mailbox permissions.');
    const data = await response.json();
    if (!data.access_token) throw new MailError(502, 'Microsoft did not provide an access token.');
    cachedToken = { key, value: data.access_token, until: Date.now() + Math.max(0, Number(data.expires_in) - 120) * 1000 };
    return cachedToken.value;
  }
  return async function graph(path, { method = 'GET', body, text = false, etag, raw = false } = {}) {
    const url = path.startsWith('https://') ? path : root + path;
    // Continuations may only access this configured mailbox. Never proxy arbitrary URLs.
    if (!url.startsWith(root + '/')) throw new MailError(400, 'Invalid mailbox continuation.');
    let response;
    try {
      response = await transport(url, { method, redirect: 'error', signal: AbortSignal.timeout(20000), headers: {
        Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json',
        Prefer: `IdType="ImmutableId"${text ? ', outlook.body-content-type="text"' : ''}`,
        ...(etag ? { 'If-Match': etag } : {}),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch (error) {
      if (error instanceof MailError) throw error;
      throw new MailError(502, method === 'GET' ? 'Microsoft could not be reached. Refresh to try again.' : 'Microsoft did not confirm the action. Check Outlook before retrying; it may have completed.');
    }
    if (!response.ok) {
      const status = response.status;
      if (status === 401) cachedToken = undefined;
      const message = status === 429 ? 'Microsoft is limiting requests. Please wait before refreshing.'
        : status === 403 ? 'Microsoft denied this action. Check the app permissions and mailbox access scope.'
        : status === 404 ? 'This message or folder is no longer available. Refresh the mailbox.'
        : status === 412 ? 'This draft changed in Outlook. Reload it before approving.'
        : 'Microsoft could not complete the action. Check Outlook before retrying a write.';
      throw new MailError([404, 410, 412, 429].includes(status) ? status : 502, message, response.headers.get('Retry-After'));
    }
    if (raw) return response;
    return response.status === 204 || response.status === 202 ? null : response.json();
  };
}

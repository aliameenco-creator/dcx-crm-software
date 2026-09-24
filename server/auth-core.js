import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'dcx_session';
const MAX_AGE = 8 * 60 * 60;
const failures = new Map();
const equal = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
export function configuration(env = process.env) {
  return { email: env.APP_LOGIN_EMAIL || '', password: env.APP_LOGIN_PASSWORD || '', secret: env.APP_SESSION_SECRET || '' };
}
export function configured(c) { return !!(c.email && c.password.length >= 12 && c.secret.length >= 32); }
const sign = (data, c) => createHmac('sha256', c.secret).update(data).digest('base64url');
export function createSession(c, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ email: c.email, expires: now + MAX_AGE * 1000, credential: sign(c.password, c) })).toString('base64url');
  return `${data}.${sign(data, c)}`;
}
export function verifySession(token, c, now = Date.now()) {
  if (!configured(c) || typeof token !== 'string' || token.length > 2048) return null;
  try {
    const parts = token.split('.'); if (parts.length !== 2 || !equal(sign(parts[0], c), parts[1])) return null;
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return data.email === c.email && Number.isFinite(data.expires) && data.expires > now && equal(data.credential, sign(c.password, c)) ? { email: c.email } : null;
  } catch { return null; }
}
export function getSession(req, c = configuration()) {
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
  return verifySession(cookie?.slice(COOKIE.length + 1), c);
}
function send(res, status, body) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); }
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 8192) throw new Error('body too large'); }
  return JSON.parse(raw || '{}');
}
export async function authHandler(req, res, c = configuration()) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET') return send(res, 200, { configured: configured(c), user: getSession(req, c) });
  if (req.method !== 'POST' && req.method !== 'DELETE') { res.setHeader('Allow', 'GET, POST, DELETE'); return send(res, 405, { error: 'Method not allowed.' }); }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = req.headers.origin;
  const expected = `${protocol}://${req.headers.host}`;
  if (origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Request origin is not allowed.' });
  const secure = protocol === 'https' ? '; Secure' : '';
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`); return send(res, 200, { ok: true }); }
  if (!configured(c)) return send(res, 503, { error: 'Login is not configured. Set the server environment variables first.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  for (const [key, item] of failures) if (item.until <= now) failures.delete(key);
  if (failures.size > 10000) return send(res, 429, { error: 'Please try again later.' });
  const attempt = failures.get(ip);
  if (attempt?.count >= 8) { res.setHeader('Retry-After', '900'); return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' }); }
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'Invalid request.' }); }
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length > 512) return send(res, 400, { error: 'Enter your email and password.' });
  const emailMatches = equal(body.email.trim().toLowerCase(), c.email.toLowerCase());
  const passwordMatches = equal(body.password, c.password);
  if (!emailMatches || !passwordMatches) { failures.set(ip, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + 15 * 60 * 1000 }); return send(res, 401, { error: 'Email or password is incorrect.' }); }
  failures.delete(ip);
  res.setHeader('Set-Cookie', `${COOKIE}=${createSession(c)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}${secure}`);
  return send(res, 200, { user: { email: c.email } });
}

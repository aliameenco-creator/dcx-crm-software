import { getSession, configuration } from '../server/auth-core.js';

const WEBHOOK = 'https://dcx-tech.app.n8n.cloud/webhook/bca2dd48-ecb0-49b9-b60a-bb87d9824cdc/chat';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!getSession(req, configuration())) return res.status(401).json({ error: 'Sign in to use Calendar Agent.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const origin = req.headers.origin;
  const expected = `https://${req.headers.host}`;
  if (origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Request origin is not allowed.' });
  const { message, sessionId } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > 4000 || typeof sessionId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(sessionId)) return res.status(400).json({ error: 'Invalid message or session.' });
  try {
    const upstream = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', chatInput: message.trim(), sessionId }), signal: AbortSignal.timeout(90000) });
    const raw = await upstream.text();
    if (!upstream.ok) return res.status(502).json({ error: 'Calendar Agent is unavailable. Check that the n8n workflow is active.' });
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }
    const answer = Array.isArray(data) ? data[0]?.output ?? data[0]?.text : data?.output ?? data?.text ?? data?.message ?? data;
    if (typeof answer !== 'string') return res.status(502).json({ error: 'Calendar Agent returned an unexpected response.' });
    return res.status(200).json({ answer });
  } catch { return res.status(502).json({ error: 'Could not reach Calendar Agent. Please try again.' }); }
}

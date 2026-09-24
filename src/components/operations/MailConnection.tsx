import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { mailRequest } from '../../lib/microsoft-mail';

export type MailProviderName = 'microsoft' | 'hostinger';
type Connection = { mode: 'loading' | 'preview' | 'live' | 'error'; mailbox?: string; inboxId?: string; provider?: MailProviderName; error?: string; check: () => void };
const Context = createContext<Connection>({ mode: 'loading', check: () => {} });
export function MailProvider({ preview, children }: { preview: boolean; children: ReactNode }) {
  const [state, setState] = useState<Omit<Connection, 'check'>>({ mode: preview ? 'preview' : 'loading' });
  const sequence = useRef(0);
  const check = useCallback(async () => {
    if (preview) { setState({ mode: 'preview' }); return; }
    const id = ++sequence.current; setState({ mode: 'loading' });
    try { const data = await mailRequest('status'); if (id === sequence.current) setState(data.connected ? { mode: 'live', mailbox: data.mailbox, inboxId: data.inboxId, provider: data.provider || 'microsoft' } : { mode: 'preview', provider: data.provider }); }
    catch (error) { if (id === sequence.current) setState({ mode: 'error', error: (error as Error).message }); }
  }, [preview]);
  useEffect(() => { check(); return () => { sequence.current++; }; }, [check]);
  return <Context.Provider value={{ ...state, check }}>{children}</Context.Provider>;
}
export const useMailConnection = () => useContext(Context);
export function MailConnectionCard() {
  const connection = useMailConnection();
  const name = connection.provider === 'hostinger' ? 'Hostinger Mail' : 'Microsoft Outlook';
  const [oauth, setOauth] = useState<{ connections: { id: string; email_address: string; display_name: string; is_active: boolean }[]; redirectUri?: string } | null>(null);
  const [oauthError, setOauthError] = useState('');
  const loadOauth = useCallback(() => {
    if (connection.provider === 'hostinger') return;
    fetch('/api/microsoft-oauth?action=status', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load Microsoft connections.');
        setOauth(data); setOauthError('');
      })
      .catch(error => setOauthError(error.message));
  }, [connection.provider]);
  useEffect(() => { loadOauth(); }, [loadOauth]);
  async function choose(id: string) {
    const response = await fetch('/api/microsoft-oauth?action=select', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await response.json();
    if (!response.ok) return setOauthError(data.error || 'Unable to select this mailbox.');
    loadOauth(); connection.check();
  }
  return <section className="panel mail-setup"><div className="panel-heading"><h2>{name}</h2><span className={`pill ${connection.mode === 'live' ? 'green' : 'neutral'}`}>{connection.mode === 'live' ? 'Connected' : connection.mode === 'loading' ? 'Checking connection' : 'Setup required'}</span></div>
    {connection.mode === 'live' ? <><p>{connection.mailbox}</p><p>The inbox refreshes while visible. Every outbound message requires a final review before sending.</p></> : connection.provider === 'hostinger' ? <><p>Connect a Hostinger mailbox with a server-only Mail API token.</p><p>Full instructions: <code>docs/hostinger-mail-setup.md</code></p></> : <><p>Sign in to connect a personal Outlook.com or Microsoft 365 mailbox.</p><a className="primary inline-button" href="/api/microsoft-oauth?action=start">Connect Microsoft</a>{oauth?.redirectUri && <p className="field-help">Azure redirect URI: <code>{oauth.redirectUri}</code></p>}</>}
    {connection.provider !== 'hostinger' && oauth?.connections?.length ? <div className="mail-connections"><strong>Connected Microsoft accounts</strong>{oauth.connections.map(item => <button className={item.is_active ? 'secondary active' : 'text-button'} key={item.id} disabled={item.is_active} onClick={() => choose(item.id)}><span>{item.display_name || item.email_address}</span><small>{item.email_address}{item.is_active ? ' · Active' : ''}</small></button>)}<a className="text-button" href="/api/microsoft-oauth?action=start">Connect another mailbox</a></div> : null}
    {oauthError && <p role="alert" className="form-error">{oauthError}</p>}
    {connection.error && <p role="alert" className="form-error">{connection.error}</p>}
    <button className="secondary" disabled={connection.mode === 'loading'} onClick={connection.check}>Check connection</button><p className="field-help">Tracked conversations are stored separately in Supabase after mailbox sync.</p>
  </section>;
}

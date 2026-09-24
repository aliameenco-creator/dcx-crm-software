import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, LockKeyhole, Zap } from 'lucide-react';

export function LoginGate({ children }: { children: (email: string, logout: () => void, preview: boolean) => ReactNode }) {
  const [user, setUser] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [preview, setPreview] = useState(false);
  useEffect(() => { fetch('/api/auth').then(r => r.json()).then(data => { setUser(data.user?.email || ''); setReady(data.configured); }).catch(() => setError('Login service is unavailable. Please try again.')).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!user || preview) return;
    const check = () => fetch('/api/auth').then(r => r.json()).then(data => { if (!data.user) { setUser(''); setError('Your session expired. Please sign in again.'); } }).catch(() => { setUser(''); setError('Could not verify your session. Sign in again.'); });
    const timer = setInterval(check, 60000); window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); };
  }, [user, preview]);
  async function login(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError('');
    try { const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setUser(data.user.email); setPassword(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); } finally { setBusy(false); }
  }
  async function logout() { if (preview) { setUser(''); setPreview(false); return; } try { const r = await fetch('/api/auth', { method: 'DELETE' }); if (!r.ok) throw new Error(); setUser(''); } catch { setError('Sign out failed. Please retry.'); } }
  if (loading) return <div className="login-screen"><div className="loading-dot" /> <span>Opening your workspace…</span></div>;
  if (user) return <>{error && <div role="alert" className="session-error">{error}</div>}{children(user, logout, preview)}</>;
  return <div className="login-screen"><div className="login-card"><div className="login-brand"><Zap size={28} /><span>DCX<span className="brand-light"> / Operations</span></span></div><p className="eyebrow">YOUR OPERATIONS, IN ONE PLACE</p><h1>Welcome back.</h1><p className="muted">Sign in to your business workspace.</p><form onSubmit={login}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /></label>{error && <p role="alert" className="form-error">{error}</p>}{!ready && <p className="small muted">The workspace owner needs to configure login before signing in.</p>}<button className="primary" disabled={busy || !ready}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button></form><p className="login-foot"><LockKeyhole size={13} /> Private workspace · single-user access</p>{import.meta.env.DEV && !ready && <button className="text-button preview-button" onClick={() => { setPreview(true); setUser('Local preview'); }}>Open local dashboard preview <ArrowRight size={14} /></button>}</div><span className="login-copyright">DCX Technical Inc. · Critical power services</span></div>;
}

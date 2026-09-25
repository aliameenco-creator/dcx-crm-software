import { useState } from 'react';
import { CalendarDays, Send } from 'lucide-react';

type Message = { role: 'user' | 'agent'; text: string };
const sessionKey = 'dcx-calendar-agent-session';
function sessionId() {
  let id = sessionStorage.getItem(sessionKey);
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(sessionKey, id); }
  return id;
}

export function CalendarAgent({ preview }: { preview: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy || preview) return;
    setInput(''); setError(''); setBusy(true);
    setMessages(current => [...current, { role: 'user', text: message }]);
    try {
      const response = await fetch('/api/calendar-agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sessionId: sessionId() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Calendar Agent is unavailable.');
      setMessages(current => [...current, { role: 'agent', text: data.answer }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Calendar Agent is unavailable.'); }
    finally { setBusy(false); }
  }
  return <section className="panel calendar-agent">
    <div className="panel-heading"><h1><CalendarDays size={22} /> Calendar Agent</h1></div>
    <p className="muted">Ask about your calendar, create meetings, or change events.</p>
    <div className="calendar-agent-messages" role="log" aria-live="polite">
      {!messages.length && <p className="muted">Try “What’s on my calendar tomorrow?”</p>}
      {messages.map((message, index) => <div className={`calendar-agent-message ${message.role}`} key={index}>{message.text}</div>)}
      {busy && <p className="muted">Calendar Agent is thinking…</p>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <p className="notice amber">Sign in to use Calendar Agent.</p>}
    <form className="calendar-agent-compose" onSubmit={send}><input aria-label="Message Calendar Agent" placeholder="Ask about your calendar…" value={input} onChange={event => setInput(event.target.value)} disabled={busy || preview} maxLength={4000} /><button className="primary" disabled={busy || preview || !input.trim()} aria-label="Send message"><Send size={17} /></button></form>
  </section>;
}

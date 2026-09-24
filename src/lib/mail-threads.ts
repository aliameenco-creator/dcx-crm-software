import type { Mail } from '../types/operations';
export function mailThreads(messages: Mail[]) {
  const groups = new Map<string, Mail[]>();
  for (const message of messages) { const key = message.threadId || message.id; groups.set(key, [...(groups.get(key) || []), message]); }
  return [...groups.entries()].map(([id, rows]) => { const messages = rows.sort((a, b) => Date.parse(a.date) - Date.parse(b.date)); return { id, messages, latest: messages[messages.length - 1], unread: messages.some(m => m.direction !== 'outgoing' && !m.isRead && m.status !== 'Archived'), urgent: messages.some(m => m.urgent), archived: messages.every(m => m.status === 'Archived') }; }).sort((a, b) => Date.parse(b.latest.date) - Date.parse(a.latest.date));
}

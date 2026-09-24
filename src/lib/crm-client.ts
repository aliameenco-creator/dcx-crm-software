import type { Client, Workspace } from '../types/operations';
type Row = Record<string, any>;
const KEY = 'dcx-crm-preview-v2';
export const toClient = (c: Row): Client => ({ id: c.id, name: c.name, notes: c.notes || '', contact: c.contact || '', email: c.email || '', phone: c.phone || '', billingAddress: c.billing_address || '', site: (c.billing_address || '').replace(/\s*\n\s*/g, ', '), equipment: c.equipment || '', bookId: c.price_book || 'standard' });
export function previewStore(seed: Workspace): Record<string, Row[]> {
  const existing = localStorage.getItem(KEY);
  if (existing) {
    const saved = JSON.parse(existing);
    const example = seed.customers.find(c => c.id === 'demo-northstar');
    if (example && !saved.customers.some(c => c.id === example.id)) {
      saved.customers.unshift({ id: example.id, name: example.name, contact: example.contact, email: example.email, phone: example.phone, billing_address: example.billingAddress, price_book: example.bookId, notes: example.notes, updated_at: new Date().toISOString() });
      localStorage.setItem(KEY, JSON.stringify(saved));
    }
    return saved;
  }
  const now = new Date().toISOString();
  const customers = seed.customers.map(c => ({ id: c.id, name: c.name, contact: c.contact, email: c.email, phone: c.phone || '', billing_address: c.billingAddress || c.site, price_book: c.bookId, notes: c.notes, created_at: now, updated_at: now }));
  const sites = seed.customers.filter(c => c.site).map(c => ({ id: crypto.randomUUID(), customer_id: c.id, name: 'Primary site', address: c.site, notes: '', updated_at: now }));
  const store = { customers, sites, contacts: seed.customers.map(c => ({ id: crypto.randomUUID(), customer_id: c.id, name: c.contact, email: c.email.toLowerCase(), phone: c.phone || '', notes: '', updated_at: now })), equipment: seed.customers.filter(c => c.equipment).map(c => ({ id: crypto.randomUUID(), customer_id: c.id, site_id: sites.find(s => s.customer_id === c.id)?.id, name: c.equipment, model: c.equipment, source: 'Example record — verify before use', updated_at: now })), purchases: [], services: [] };
  localStorage.setItem(KEY, JSON.stringify(store)); return store;
}
export async function crmRequest(query: string, options?: RequestInit, previewSeed?: Workspace) {
  if (!previewSeed) {
    const response = await fetch(`/api/crm?${query}`, { ...options, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Customer request failed.'); return data;
  }
  const params = new URLSearchParams(query); const store = previewStore(previewSeed); const entity = params.get('entity') || 'customers';
  if (params.get('action') === 'lookup') {
    const email = (params.get('email') || '').trim().toLowerCase();
    const ids = new Set([...store.contacts.filter(c => c.email === email).map(c => c.customer_id), ...store.customers.filter(c => c.email === email).map(c => c.id)]);
    if (ids.size !== 1) return { status: ids.size ? 'needs_review' : 'not_found', message: ids.size ? 'Multiple matches. Review the customer identity.' : 'No contact matches this email.' };
    const id = [...ids][0]; return { status: 'matched', customer: store.customers.find(c => c.id === id), ...Object.fromEntries(Object.entries(store).filter(([k]) => k !== 'customers').map(([k, rows]) => [k, rows.filter(r => r.customer_id === id)])), message: 'Preview match. Confirm the site and equipment before preparing a response.' };
  }
  if (!store[entity]) throw new Error('Unknown record type.');
  if (!options?.method || options.method === 'GET') return { records: store[entity].filter(r => entity === 'customers' || r.customer_id === params.get('customer_id')) };
  const input = JSON.parse(String(options.body));
  if (!input.name?.trim()) throw new Error('Name is required.');
  if (input.email) input.email = input.email.trim().toLowerCase();
  if (entity === 'contacts' && store.contacts.some(c => c.customer_id === input.customer_id && c.email === input.email && c.id !== input.id)) throw new Error('This contact email already exists for this customer.');
  if (input.id && !store[entity].some(r => r.id === input.id && r.updated_at === input.updated_at)) throw new Error('Record changed. Close, refresh and try again.');
  const record = { ...input, id: input.id || crypto.randomUUID(), created_at: input.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
  store[entity] = input.id ? store[entity].map(r => r.id === input.id ? record : r) : [...store[entity], record];
  localStorage.setItem(KEY, JSON.stringify(store)); return { record };
}

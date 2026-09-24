import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Search, ArrowLeft, RefreshCw, Database } from 'lucide-react';
import type { Client, Workspace } from '../../types/operations';
import { CustomerProposals } from './CustomerProposals';
import { crmRequest, toClient } from '../../lib/crm-client';

type Row = Record<string, any>;
type Field = { key: string; label: string; required?: boolean; type?: string };
const fields: Record<string, Field[]> = {
  customers: [{ key: 'name', label: 'Company / customer name', required: true }, { key: 'contact', label: 'Primary contact' }, { key: 'email', label: 'Primary email', type: 'email' }, { key: 'phone', label: 'Phone' }, { key: 'billing_address', label: 'Billing address', type: 'textarea' }, { key: 'price_book', label: 'Pricing agreement', type: 'books' }, { key: 'notes', label: 'Notes', type: 'textarea' }],
  contacts: [{ key: 'name', label: 'Contact name', required: true }, { key: 'email', label: 'Email', required: true, type: 'email' }, { key: 'phone', label: 'Phone' }, { key: 'notes', label: 'Notes', type: 'textarea' }],
  sites: [{ key: 'name', label: 'Site name', required: true }, { key: 'address', label: 'Service address', required: true }, { key: 'notes', label: 'Notes', type: 'textarea' }],
  equipment: [{ key: 'name', label: 'Equipment label', required: true }, { key: 'site_id', label: 'Installed at', required: true, type: 'sites' }, { key: 'model', label: 'Model' }, { key: 'serial_number', label: 'Serial number' }, { key: 'battery_configuration', label: 'Battery configuration' }, { key: 'source', label: 'Source / evidence reference' }, { key: 'confirmed_on', label: 'Last confirmed', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' }],
  purchases: [{ key: 'name', label: 'Purchased items / completed order', required: true }, { key: 'equipment_id', label: 'Related equipment', type: 'equipment' }, { key: 'occurred_on', label: 'Purchase date', required: true, type: 'date' }, { key: 'amount', label: 'Total CAD (optional)', type: 'number' }, { key: 'source', label: 'Invoice / completed order reference', required: true }, { key: 'notes', label: 'Notes', type: 'textarea' }],
  services: [{ key: 'name', label: 'Service performed', required: true }, { key: 'equipment_id', label: 'Related equipment', type: 'equipment' }, { key: 'occurred_on', label: 'Service date', required: true, type: 'date' }, { key: 'source', label: 'Service report / confirmation reference', required: true }, { key: 'notes', label: 'Notes', type: 'textarea' }],
};
const labels: Record<string, string> = { contacts: 'Contacts', sites: 'Sites', equipment: 'Equipment', purchases: 'Purchases', services: 'Service history' };
export function CustomerHub({ preview, onLoaded, onQuote, focusId, data, renderQuotes, quoteFocus }: { preview: boolean; onLoaded: (clients: Client[]) => void; onQuote: (id: string) => void; focusId?: string; data: Workspace; renderQuotes: (id: string) => ReactNode; quoteFocus?: string }) {
  const api = (query: string, options?: RequestInit) => crmRequest(query, options, preview ? data : undefined);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [selected, setSelected] = useState(focusId || '');
  const [tab, setTab] = useState(quoteFocus ? 'quotations' : 'proposals');
  const [createProposal,setCreateProposal]=useState(false);
  function makeProposal(id:string){setSelected(id);setTab('proposals');setCreateProposal(true);}
  const [history, setHistory] = useState<Record<string, Row[]>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<{ entity: string; row: Row } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setHistory({});
    (async () => {
      try {
        const { records } = await api('entity=customers');
        const entries = selected ? await Promise.all(Object.keys(labels).map(async entity => [entity, (await api(`entity=${entity}&customer_id=${encodeURIComponent(selected)}`)).records])) : [];
        if (cancelled) return;
        setCustomers(records); setHistory(Object.fromEntries(entries));
        onLoaded(records.map(toClient));
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selected, revision, preview]);
  function open(entity: string, row?: Row) { setSaveError(''); setEdit({ entity, row: row ? { ...row } : { customer_id: selected } }); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!edit || saving) return;
    setSaving(true); setSaveError('');
    try {
      const result = await api(`entity=${edit.entity}`, { method: edit.row.id ? 'PATCH' : 'POST', body: JSON.stringify(edit.row) });
      if (edit.entity === 'customers') setSelected(result.record.id);
      setEdit(null); setRevision(r => r + 1); setMessage(preview ? 'Saved in this browser preview.' : 'Saved to Supabase. Available to customer lookup now.');
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }
  const customer = customers.find(c => c.id === selected);
  const rows = history[tab] || [];
  return <>
    <div className="page-heading"><div><p className="eyebrow">RELATIONSHIPS & COMMERCIAL HISTORY</p><h1>{customer?.name || 'Customers'}</h1><p>{customer ? 'Contact details, equipment and every quotation, together.' : 'Save a customer once. Reuse their details for every proposal.'}</p></div><span className="pill neutral"><Database size={13} />{preview ? 'Interactive preview · saved locally' : 'Customer database'}</span></div>
    <>
      <div className="toolbar"><button className="secondary" disabled={loading || saving} onClick={() => { setRevision(r => r + 1); }}><RefreshCw size={15} /> Refresh</button>{selected && <button className="secondary" onClick={() => { setSelected(''); setMessage(''); }}><ArrowLeft size={15} /> All customers</button>}<button className="primary" disabled={loading || !!error} onClick={() => open('customers')}><Plus size={15} /> Add customer</button></div>
      {error && <div role="alert" className="notice amber">{error} Your unsaved form stays open if a save fails.</div>}
      {message && <p role="status" className="notice">{message}</p>}
      {loading ? <p role="status">Loading customer records…</p> : !error && <>
        {!customer ? <><div className="search-field"><Search size={15} /><input aria-label="Search customer companies" placeholder="Search customers, contacts or email" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="customer-grid crm-cards">{customers.filter(c => `${c.name} ${c.contact || ''} ${c.email || ''} ${c.notes}`.toLowerCase().includes(search.toLowerCase())).map(c => <section className="panel crm-customer" key={c.id}><h2>{c.name}</h2><p>{c.contact || c.email || c.phone || 'Add contact details'}</p><p>{c.notes || 'Open profile to add contacts, equipment and history.'}</p><div className="button-row"><button className="text-button" onClick={() => { setSelected(c.id); setMessage(''); }}>View customer</button><button className="secondary compact" onClick={() => makeProposal(c.id)}>Make proposal</button></div></section>)}</div>{!customers.length && <div className="empty-state"><h2>Your customer database is ready</h2><p>Add a customer, then their contacts and sites. Sample customers are never uploaded automatically.</p></div>}</> : <>
          <section className="panel customer-profile"><div className="panel-heading"><div><span className={`pill ${customer.price_book === 'bgis' ? 'purple' : 'neutral'}`}>{data.books.find(b => b.id === customer.price_book)?.name || 'Standard'} pricing</span><h2>{customer.contact || 'Primary contact to add'}</h2></div><button className="secondary" onClick={() => open('customers', customer)}>Edit customer</button></div><div className="profile-contact-grid"><div><small>EMAIL</small><p>{customer.email || 'Not recorded'}</p></div><div><small>PHONE</small><p>{customer.phone || 'Not recorded'}</p></div><div><small>BILLING ADDRESS</small><p className="pre-line">{customer.billing_address || 'Not recorded'}</p></div></div>{customer.notes && <p className="profile-notes">{customer.notes}</p>}{customer.price_book === 'bgis' && <p className="notice amber">BGIS has a separate rate book. Example rates require review before a quotation can be approved.</p>}<div className="toolbar"><span className="small muted">{history.sites?.length || 0} sites · {history.equipment?.length || 0} equipment records · {data.quotes.filter(q => q.customerId === customer.id).length} quotations</span><button className="primary" onClick={() => makeProposal(customer.id)}><Plus size={15} /> Make proposal</button></div></section>
          <div className="toolbar crm-tabs"><button className={tab === 'proposals' ? 'primary' : 'secondary'} onClick={() => setTab('proposals')}>Proposals</button><button className={tab === 'quotations' ? 'primary' : 'secondary'} onClick={() => setTab('quotations')}>Quotations ({data.quotes.filter(q => q.customerId === customer.id).length})</button>{Object.entries(labels).map(([key, title]) => <button className={tab === key ? 'primary' : 'secondary'} key={key} onClick={() => setTab(key)}>{title} ({history[key]?.length || 0})</button>)}</div>
          {tab === 'proposals' ? <CustomerProposals key={customer.id} customer={customer} preview={preview} createNow={createProposal} onCreated={()=>setCreateProposal(false)}/> : tab === 'quotations' ? renderQuotes(customer.id) : <section className="panel"><div className="panel-heading"><h2>{labels[tab]}</h2><button className="secondary" disabled={tab === 'equipment' && !history.sites?.length} onClick={() => open(tab)}><Plus size={14} /> Add record</button></div>{tab === 'equipment' && !history.sites?.length && <p>Add a site before recording installed equipment.</p>}{tab === 'purchases' && <p className="small muted">Record completed purchases with an invoice or order reference. An offered quotation does not confirm a purchase.</p>}{!rows.length && <p className="muted">No records yet.</p>}{rows.map(row => <article className="crm-record" key={row.id}><div><h3>{row.name}</h3>{fields[tab].filter(f => f.key !== 'name' && row[f.key] !== null && row[f.key] !== '').map(f => <p key={f.key}><strong>{f.label}: </strong>{f.type === 'sites' || f.type === 'equipment' ? history[f.type]?.find(r => r.id === row[f.key])?.name || 'Unresolved record' : String(row[f.key] ?? '')}</p>)}</div><button className="secondary compact" onClick={() => open(tab, row)}>Edit</button></article>)}</section>}
        </>}

      </>}
    </>
    {edit && <div className="modal-backdrop"><form className="detail-modal" role="dialog" aria-modal="true" aria-label="Customer record editor" onSubmit={save}><div className="panel-heading"><h2>{edit.row.id ? 'Edit' : 'Add'} {edit.entity === 'customers' ? 'customer' : labels[edit.entity].toLowerCase()}</h2><button className="text-button" type="button" disabled={saving} onClick={() => setEdit(null)}>Close</button></div>
      <div className="form-grid">{fields[edit.entity].map(f => {
        const set = (value: string) => setEdit({ ...edit, row: { ...edit.row, [f.key]: value } });
        return <label className={f.type === 'textarea' ? 'span-2' : ''} key={f.key}>{f.label}{f.required ? ' *' : ''}{f.type === 'textarea' ? <textarea disabled={saving} maxLength={10000} rows={3} value={edit.row[f.key] || ''} onChange={e => set(e.target.value)} /> : ['sites','equipment','books'].includes(f.type || '') ? <select disabled={saving} required={f.required} value={edit.row[f.key] || (f.type === 'books' ? 'standard' : '')} onChange={e => set(e.target.value)}>{f.type !== 'books' && <option value="">Select {f.required ? 'a record' : '(optional)'}</option>}{(f.type === 'books' ? data.books : history[f.type!] || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : <input disabled={saving} required={f.required} maxLength={1000} type={f.type || 'text'} min={f.type === 'number' ? 0 : undefined} max={f.type === 'number' ? 999999999 : undefined} step={f.type === 'number' ? '0.01' : undefined} value={edit.row[f.key] ?? ''} onChange={e => set(e.target.value)} />}</label>;
      })}</div>{saveError && <p className="form-error" role="alert">{saveError}</p>}<button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save customer record'}</button><p className="small muted">{preview ? 'Preview changes are saved only in this browser.' : 'Changes become available to automation after a successful save.'}</p></form></div>}
  </>;
}

import { useEffect, useState } from 'react';
import { Plus, FileText, Download, Save } from 'lucide-react';
import { crmRequest } from '../../lib/crm-client';
import { emptyProposal, exportProposalPdf, proposalSections, type Proposal, type ProposalContent } from '../../lib/proposal';

export function CustomerProposals({customer,preview,createNow,onCreated}:{customer:Record<string,any>;preview:boolean;createNow:boolean;onCreated:()=>void}) {
  const [records,setRecords]=useState<Proposal[]>([]),[editor,setEditor]=useState<ProposalContent|null>(createNow?emptyProposal():null);
  const [selected,setSelected]=useState<Proposal|null>(null),[dirty,setDirty]=useState(createNow),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const key=`customer-proposals-preview:${customer.id}`;
  useEffect(()=>{let active=true;setLoading(true);(async()=>{try{const rows=preview?JSON.parse(localStorage.getItem(key)||'[]'):(await crmRequest(`action=proposals&customer_id=${encodeURIComponent(customer.id)}`)).records;if(active)setRecords(rows);}catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[customer.id,preview]);
  useEffect(()=>{if(createNow){setEditor(emptyProposal());setSelected(null);setDirty(true);onCreated();}},[createNow]);
  useEffect(()=>{const guard=(e:Event)=>{if(dirty&&!window.confirm('Discard unsaved proposal changes?'))e.preventDefault();};const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('dcx-before-navigate',guard);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('dcx-before-navigate',guard);window.removeEventListener('beforeunload',unload);};},[dirty]);
  async function save(exportAfter=false){if(!editor||busy)return;setBusy(true);setError('');try{
    if(!editor.title.trim()||!editor.scope.trim())throw new Error('Enter a title and scope of work.');
    const record:Proposal=preview?{id:selected?.id||crypto.randomUUID(),customer_id:customer.id,title:editor.title,customer_snapshot:selected?.customer_snapshot||{name:customer.name,contact:customer.contact,email:customer.email,phone:customer.phone,billing_address:customer.billing_address},content:editor,template_key:'basic-v1',version:(selected?.version||0)+1,created_at:selected?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()}:(await crmRequest('action=proposals',{method:selected?'PATCH':'POST',body:JSON.stringify({id:selected?.id,version:selected?.version,customer_id:customer.id,content:editor})})).record;
    const next=[record,...records.filter(p=>p.id!==record.id)];if(preview)localStorage.setItem(key,JSON.stringify(next));setRecords(next);setSelected(record);setDirty(false);if(exportAfter)await exportProposalPdf(record);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function download(record:Proposal){setError('');setBusy(true);try{await exportProposalPdf(record);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="panel"><div className="panel-heading"><div><h2>Customer proposals</h2><p className="small muted">Separate from cost estimates. Customer details are filled in automatically.</p></div><button className="primary" disabled={loading||busy} onClick={()=>{setSelected(null);setEditor(emptyProposal());setDirty(true);}}><Plus size={15}/> Make proposal</button></div>
    <p className="notice">Basic proposal layout available now. Your custom template will replace this layout when you provide it.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}{loading&&<p role="status">Loading proposals…</p>}
    {!loading&&!records.length&&<p className="muted">No proposals yet. Add the scope, deliverables and terms, then export a PDF.</p>}
    {records.map(p=><article className="crm-record" key={p.id}><div><h3><FileText size={15}/> {p.title}</h3><p>Version {p.version} · {new Date(p.updated_at).toLocaleDateString()}</p></div><div className="button-row"><button className="secondary" disabled={busy} onClick={()=>{setSelected(p);setEditor({...p.content});setDirty(false);}}>Open proposal</button><button className="secondary" disabled={busy} onClick={()=>download(p)}><Download size={14}/> PDF</button></div></article>)}
    {editor&&<div className="modal-backdrop"><section className="detail-modal" role="dialog" aria-modal="true" aria-label="Customer proposal editor"><div className="panel-heading"><h2>{selected?'Edit proposal':'New proposal'}</h2><button className="text-button" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard unsaved proposal changes?')){setEditor(null);setDirty(false);}}}>Close</button></div>
      <p>Prepared for <strong>{selected?.customer_snapshot.name||customer.name}</strong> · {selected?.customer_snapshot.email||customer.email}</p><p className="small muted">{preview?'Preview saves stay in this browser.':'Saved proposals stay in Supabase.'} Basic layout · customer details are captured when first saved.</p>
      <fieldset disabled={busy} className="proposal-fields"><label>Proposal title *<input maxLength={200} value={editor.title} onChange={e=>{setEditor({...editor,title:e.target.value});setDirty(true);}}/></label>
      {proposalSections.map(([field,label])=><label key={field}>{label}{field==='scope'?' *':''}<textarea rows={field==='scope'?5:3} maxLength={10000} value={editor[field]} onChange={e=>{setEditor({...editor,[field]:e.target.value});setDirty(true);}}/></label>)}</fieldset>
      {error&&<p role="alert" className="form-error">{error}</p>}<div className="button-row"><button className="secondary" disabled={busy||!dirty} onClick={()=>save()}><Save size={15}/> {busy?'Saving…':'Save proposal'}</button><button className="primary" disabled={busy} onClick={()=>dirty||!selected?save(true):download(selected)}><Download size={15}/> {dirty?'Save & export PDF':'Export PDF'}</button></div>
    </section></div>}
  </section>;
}

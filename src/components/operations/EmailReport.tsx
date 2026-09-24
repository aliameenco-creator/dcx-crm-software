import { useEffect, useState } from 'react';
import { trackingRequest } from '../../lib/email-tracking';

export function EmailReport() {
  const [days,setDays]=useState('7'), [timezone,setTimezone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [data,setData]=useState<any>(null), [error,setError]=useState('');
  useEffect(()=>{
    let active=true;setData(null);
    const load=()=>trackingRequest('report',{days,timezone}).then(result=>{if(active){setData(result);setError('');}}).catch(e=>{if(active)setError(e.message);});
    load(); const timer=setInterval(()=>{if(document.visibilityState==='visible')load();},30000);
    return()=>{active=false;clearInterval(timer);};
  },[days,timezone]);
  const r=data?.report;
  const zones=[...new Set([Intl.DateTimeFormat().resolvedOptions().timeZone,'America/Toronto','America/Vancouver','UTC'])];
  const complete=r?.folders?.filter((f:any)=>['inbox','sentitems'].includes(f.folder.toLowerCase()));
  return <section className="panel email-report">
    <div className="panel-heading"><div><h2>Email performance</h2><p className="small muted">Actual received and sent mail across the selected period.</p></div><div className="button-row">
      <select aria-label="Email reporting period" value={days} onChange={e=>setDays(e.target.value)}><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
      <select aria-label="Email reporting timezone" value={timezone} onChange={e=>setTimezone(e.target.value)}>{zones.map(z=><option key={z} value={z}>{z}</option>)}</select>
    </div></div>
    {error&&<p className="notice amber" role="alert">{error}</p>}
    {!r&&!error&&<p role="status">Loading email performance…</p>}
    {r&&<>
      <p className="small muted">{data.mailbox.address} · Last sync: {data.mailbox.last_synced_at?new Date(data.mailbox.last_synced_at).toLocaleString():'Not synced'}</p>
      {(complete?.length!==2||complete.some((f:any)=>!f.backfill_complete||f.last_error))&&<p className="notice amber">Counts may be incomplete. Finish syncing Inbox and Sent mail; check folder errors below.</p>}
      <div className="metric-grid">{[['Received',r.received],['Sent',r.sent],['Conversations replied',`${r.conversations_replied} / ${r.conversations_received}`],['Reply rate',r.reply_rate===null?'—':`${r.reply_rate}%`]].map(([label,value])=><div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="small muted">Reply rate = conversations received in this period with a later sent message, divided by conversations received. Average first response: {r.average_response_minutes===null?'no replies yet':`${r.average_response_minutes} minutes`}. These are sent-copy counts, not delivery or read receipts.</p>
      <details open={days==='1'}><summary>Daily breakdown</summary><div className="table-scroll"><table><thead><tr><th>Date ({timezone})</th><th>Received</th><th>Sent</th><th>Conversations replied that day</th></tr></thead><tbody>{r.daily.map((day:any)=><tr key={day.day}><td>{day.day}</td><td>{day.received}</td><td>{day.sent}</td><td>{day.replied}</td></tr>)}</tbody></table></div><p className="field-help">Daily replies include conversations received on earlier days. A conversation can appear on several days; daily counts do not add up to the period's distinct conversation count.</p></details>
      <details><summary>Sync health</summary>{r.folders.length?r.folders.map((f:any)=><p key={f.folder}>{f.folder}: {f.last_error|| (f.backfill_complete?'History loaded':'Importing history')} · {new Date(f.updated_at).toLocaleString()}</p>):<p>No folder sync completed yet.</p>}</details>
    </>}
  </section>;
}

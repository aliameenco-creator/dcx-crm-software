import { useEffect, useState } from 'react';
import { ArrowRight, Inbox } from 'lucide-react';
import { trackingRequest, trackingLabels } from '../../lib/email-tracking';
export function TrackingOverview({navigate}:{navigate:(tab:string,id?:string)=>void}) {
  const [summary,setSummary]=useState<any>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;const load=()=>trackingRequest('overview').then(result=>{if(active){setSummary(result);setError('');}}).catch(e=>{if(active)setError(e.message);});load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load();},30000);return()=>{active=false;clearInterval(timer);};},[]);
  if(error)return <p className="notice amber" role="status">Email tracking: {error}</p>;
  if(!summary)return <p role="status" className="small muted">Loading shared email activity…</p>;
  return <section className="panel"><div className="panel-heading"><h2><Inbox size={17}/> Email activity</h2><button className="text-button" onClick={()=>navigate('inbox')}>Open conversations <ArrowRight size={14}/></button></div><div className="metric-grid">{[['attention','Needs attention'],['drafts','Drafts ready'],['waiting','Waiting for customer'],['due','Follow-ups due']].map(([key,label])=><button className="metric-card" key={key} onClick={()=>navigate('inbox')}><span>{label}</span><strong>{summary[key]}</strong></button>)}</div>{summary.recent.map((t:any)=><button className="book-summary" key={t.id} onClick={()=>navigate('inbox',t.id)}><span><strong>{t.subject}</strong><small>{t.next_action || 'Review conversation'}</small></span><span className="pill neutral">{trackingLabels[t.status]}</span></button>)}{!summary.recent.length&&<p className="small muted">Sync your inbox to start tracking conversations.</p>}</section>;
}

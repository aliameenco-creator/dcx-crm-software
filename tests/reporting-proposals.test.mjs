import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createSession,configuration} from '../server/auth-core.js';
import {crmHandler} from '../server/crm-api.js';
import {trackingDb} from './helpers/tracking-db.mjs';
import {validateProposal} from '../server/proposal-model.js';
import {normalizeMessage} from '../server/email-tracking-model.js';
const mailbox='11111111-1111-4111-8111-111111111111';
const migrations=['202609160001_customer_crm.sql','202609230001_manageable_workspace.sql','202609230002_email_tracking.sql','202609240001_reporting_and_proposals.sql'];
test('reporting counts real mail, deduplicates conversations, separates periods and mailboxes',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());await pg.exec('create role anon;create role authenticated;create role service_role;');for(const f of migrations)await pg.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await pg.query("insert into email_mailboxes(id,provider,address) values($1,'microsoft','owner@example.com')",[mailbox]);
 const command=async(a,input)=>(await pg.query('select email_command($1,$2,$3::jsonb,$4) result',[mailbox,a,JSON.stringify(input),'test'])).rows[0].result;
 const now=Date.now(),ago=h=>new Date(now-h*3600000).toISOString();
 const ingest=(id,chain,direction,h)=>command('ingest',normalizeMessage({id,conversationId:chain,subject:chain,from:{emailAddress:{address:direction==='outgoing'?'owner@example.com':'customer@example.com'}},receivedDateTime:ago(h),sentDateTime:ago(h)},'microsoft','owner@example.com'));
 const first=await ingest('in1','chain1','incoming',3);await ingest('in2','chain1','incoming',2);await ingest('out1','chain1','outgoing',1);await ingest('out1','chain1','outgoing',1);
 await ingest('in3','chain2','incoming',4);await ingest('campaign','chain3','outgoing',1);await ingest('old','old-chain','incoming',40*24);
 const r=(await pg.query("select email_report($1,7,'UTC') result",[mailbox])).rows[0].result;
 assert.equal(r.received,3);assert.equal(r.sent,2);assert.equal(r.conversations_received,2);assert.equal(r.conversations_replied,1);assert.equal(r.reply_rate,50);assert.equal(r.average_response_minutes,120);assert.equal(r.daily.length,7);
 assert.equal(r.daily.reduce((sum,d)=>sum+d.replied,0),1);
 assert.equal((await pg.query('select status from email_threads where id=$1',[first.thread_id])).rows[0].status,'waiting_customer');
 const empty=(await pg.query("select email_report($1,1,'America/Toronto') result",[crypto.randomUUID()])).rows[0].result;assert.equal(empty.reply_rate,null);assert.equal(empty.received,0);
 await assert.rejects(pg.query("select email_report($1,365,'UTC')",[mailbox]),/Choose/);
 await assert.rejects(pg.query("select email_report($1,7,'invalid')",[mailbox]),/timezone/);
 // Local calendar days, including offsets, must match the UTC bounds returned.
 const local=(await pg.query("select email_report($1,1,'Asia/Karachi') result",[mailbox])).rows[0].result;
 assert.equal(local.received,(await pg.query("select count(*)::int n from email_messages where mailbox_id=$1 and direction='incoming' and occurred_at >= $2 and occurred_at <= $3",[mailbox,local.from,local.through])).rows[0].n);

 // Proposal writes use the actual database customer and optimistic versioning.
 const customer=(await pg.query("insert into crm_customers(name,email) values('Test customer','customer@example.com') returning *")).rows[0];
 const env={APP_LOGIN_EMAIL:'owner@example.com',APP_LOGIN_PASSWORD:'long-password-value',APP_SESSION_SECRET:'s'.repeat(40)};
 const content={title:'Service proposal',introduction:'',scope:'Inspect the UPS.',deliverables:'Inspection report',timeline:'To agree',commercial_terms:'To agree',exclusions:''};
 const call=async(method,body,cookie=true)=>{let output;const res={statusCode:200,setHeader(){},end(value){output=JSON.parse(value);}};await crmHandler({url:'/?action=proposals',method,body,headers:{host:'localhost',origin:'http://localhost',cookie:cookie?`dcx_session=${createSession(configuration(env))}`:''}},res,env,trackingDb(pg));return {status:res.statusCode,...output};};
 assert.equal((await call('POST',{customer_id:customer.id,content},false)).status,401);
 const created=await call('POST',{customer_id:customer.id,content,customer_snapshot:{name:'Forged'}});assert.equal(created.status,201);assert.equal(created.record.customer_snapshot.name,'Test customer');
 const changed=await call('PATCH',{customer_id:customer.id,id:created.record.id,version:1,content:{...content,title:'Revised proposal'}});assert.equal(changed.record.version,2);
 const stale=await call('PATCH',{customer_id:customer.id,id:created.record.id,version:1,content});assert.equal(stale.status,409);
 assert.throws(()=>validateProposal({...content,scope:''}),/scope/);
});

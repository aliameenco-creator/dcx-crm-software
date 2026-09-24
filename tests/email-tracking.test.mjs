import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createSession } from '../server/auth-core.js';
import { trackingHandler } from '../server/email-tracking-api.js';
import { trackingDb } from './helpers/tracking-db.mjs';
import { PGlite } from '@electric-sql/pglite';
import { normalizeMessage, validateWorkflow, pageCursor, encodeCursor } from '../server/email-tracking-model.js';

const mailbox='11111111-1111-4111-8111-111111111111';
const sample=(id,extra={})=>({ id,conversationId:'conversation-1',subject:'Battery replacement',from:{emailAddress:{address:'Sam@Example.com'}},toRecipients:[{emailAddress:{address:'sales@example.com'}}],receivedDateTime:'2026-09-23T10:00:00Z',bodyPreview:'Please quote',isDraft:false,...extra });
test('provider-neutral identity: signed Hostinger references rotate without duplicating messages; subjects are not identity',()=>{
  const locator=(uid,exp)=>Buffer.from(JSON.stringify({kind:'message',folder:'INBOX',uid,exp})).toString('base64url')+'.signature';
  const a=normalizeMessage(sample(locator(5,1)),'hostinger','sales@example.com');
  const b=normalizeMessage(sample(locator(5,2)),'hostinger','sales@example.com');
  const c=normalizeMessage(sample(locator(6,2)),'hostinger','sales@example.com');
  assert.equal(a.provider_key,b.provider_key);assert.equal(a.thread_key,b.thread_key);assert.notEqual(a.thread_key,c.thread_key);
  assert.equal(a.sender,'sam@example.com');
  assert.equal(normalizeMessage(sample('immutable',{from:{emailAddress:{address:'sales@example.com'}}}),'microsoft','sales@example.com').direction,'outgoing');
  assert.throws(()=>normalizeMessage(sample('draft',{isDraft:true}),'microsoft','sales@example.com'));
});
test('cursor and workflow validation reject forged filters and invalid dates',()=>{
  const cursor=encodeCursor({id:mailbox,last_message_at:'2026-09-23T10:00:00+00:00'},'last_message_at');
  assert.equal(pageCursor(cursor).id,mailbox);
  assert.throws(()=>pageCursor(Buffer.from(JSON.stringify({id:mailbox,at:'a,b)'})).toString('base64url')));
  assert.throws(()=>validateWorkflow({thread_id:mailbox,version:1,status:'sent',priority:'normal'}));
});

test('real PostgreSQL tracking transactions: deduplication, revisions, approvals, dispatch locking and AI leases',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for(const migration of ['202609160001_customer_crm.sql','202609230001_manageable_workspace.sql','202609230002_email_tracking.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
  await db.query("insert into email_mailboxes(id,provider,address) values($1,'microsoft','sales@example.com')",[mailbox]);
  const command=async(action,input,actor='owner@example.com')=>(await db.query('select email_command($1,$2,$3::jsonb,$4) as result',[mailbox,action,JSON.stringify(input),actor])).rows[0].result;
  const worker=async(action,input)=>(await db.query('select email_worker($1,$2,$3::jsonb) as result',[mailbox,action,JSON.stringify(input)])).rows[0].result;
  const m=await command('ingest',normalizeMessage(sample('message-1'),'microsoft','sales@example.com'));
  const repeated=await command('ingest',normalizeMessage(sample('message-1'),'microsoft','sales@example.com'));
  assert.equal(m.id,repeated.id);
  assert.equal((await db.query('select count(*)::int n from email_activity')).rows[0].n,1);
  let draft=await command('save_draft',{thread_id:m.thread_id,reply_to_message_id:m.id,revision:0,body:'First reply'});
  await assert.rejects(command('save_draft',{thread_id:m.thread_id,reply_to_message_id:m.id,revision:0,body:'Stale edit'}),/Conflict/);
  await command('approve',{thread_id:m.thread_id,draft_id:draft.id,revision:1,provider_draft_id:'provider-draft',provider_review:{approval:'sealed'}});
  draft=await command('save_draft',{thread_id:m.thread_id,reply_to_message_id:m.id,revision:1,body:'Changed reply'});
  await assert.rejects(command('claim_send',{thread_id:m.thread_id,draft_id:draft.id,revision:1}),/Conflict/);
  await command('approve',{thread_id:m.thread_id,draft_id:draft.id,revision:2,provider_review:{approval:'sealed-2'}});
  const claim=await command('claim_send',{thread_id:m.thread_id,draft_id:draft.id,revision:2});
  assert.equal(claim.provider_review.approval,'sealed-2');
  await assert.rejects(command('claim_send',{thread_id:m.thread_id,draft_id:draft.id,revision:2}),/Conflict/);
  await assert.rejects(command('save_draft',{thread_id:m.thread_id,reply_to_message_id:m.id,revision:2,body:'Late edit'}),/Dispatch/);
  await command('finish_send',{thread_id:m.thread_id,draft_id:draft.id,job_id:claim.job_id,status:'uncertain',error:'Provider timeout'});
  await assert.rejects(command('claim_send',{thread_id:m.thread_id,draft_id:draft.id,revision:2}),/Conflict/);
  const out=await command('ingest',normalizeMessage(sample('sent-copy',{receivedDateTime:new Date().toISOString(),from:{emailAddress:{address:'sales@example.com'}}}),'microsoft','sales@example.com'));
  await command('confirm_sent',{thread_id:m.thread_id,draft_id:draft.id,message_id:out.id});
  assert.equal((await db.query('select status from email_drafts where id=$1',[draft.id])).rows[0].status,'sent');
  await command('queue_draft',{thread_id:m.thread_id,request_id:crypto.randomUUID()});
  const job=await worker('claim',{execution_id:'execution-1'});
  assert.ok(job.lease_token);
  assert.equal(await worker('claim',{}),null);
  await assert.rejects(worker('complete',{job_id:job.id,lease_token:crypto.randomUUID(),body:'Bad worker'}),/lease/);
  const generated=await worker('complete',{job_id:job.id,lease_token:job.lease_token,body:'AI reply',summary:'Customer requests a quote.'});
  assert.equal(generated.original_ai_body,'AI reply');
  await assert.rejects(worker('complete',{job_id:job.id,lease_token:job.lease_token,body:'Duplicate'}),/lease/);
  await command('queue_draft',{thread_id:m.thread_id,request_id:crypto.randomUUID()});
  const stale=await worker('claim',{});
  await command('save_draft',{thread_id:m.thread_id,reply_to_message_id:m.id,revision:generated.revision,body:'Human correction'});
  assert.equal((await worker('complete',{job_id:stale.id,lease_token:stale.lease_token,body:'Overwrite human'})).stale,true);
  assert.equal((await db.query("select current_body from email_drafts where status='editing'")).rows[0].current_body,'Human correction');
  const sync=async(action,input)=>(await db.query('select email_sync($1,$2,$3,$4::jsonb) result',[mailbox,'inbox',action,JSON.stringify(input)])).rows[0].result;
  const firstSync=await sync('claim',{});
  await assert.rejects(sync('claim',{}),/already syncing/);
  await assert.rejects(sync('finish',{lease_token:crypto.randomUUID(),cursor_url:'wrong'}),/lease/);
  await sync('finish',{lease_token:firstSync.lease_token,cursor_url:'https://graph.microsoft.com/checkpoint'});
  const nextSync=await sync('claim',{});
  assert.equal(nextSync.cursor_url,'https://graph.microsoft.com/checkpoint');
  await sync('finish',{lease_token:nextSync.lease_token,error:'Temporary provider failure'});
  assert.equal((await sync('claim',{})).cursor_url,'https://graph.microsoft.com/checkpoint');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from email_messages'),/permission denied/);
  await assert.rejects(db.query("select email_command($1,'ingest','{}','intruder')",[mailbox]),/permission denied/);
});


test('tracking API persists provider sync and drafts, scopes automation, and sends each revision once',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec('create role anon; create role authenticated; create role service_role;');
 for(const file of ['202609160001_customer_crm.sql','202609230001_manageable_workspace.sql','202609230002_email_tracking.sql'])await pg.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const env={APP_LOGIN_EMAIL:'owner@example.com',APP_LOGIN_PASSWORD:'test-password-long',APP_SESSION_SECRET:'s'.repeat(40),MAIL_PROVIDER:'microsoft',MICROSOFT_MAILBOX:'sales@example.com',EMAIL_TRACKING_TOKEN:'w'.repeat(40)};
 const cookie='dcx_session='+createSession({email:env.APP_LOGIN_EMAIL,password:env.APP_LOGIN_PASSWORD,secret:env.APP_SESSION_SECRET});
 let sends=0,externalDraft;
 const provider=async(action,params,body)=>{
   if(action==='messages')return {records:[sample('api-message')],next:null};
   if(action==='message')return {record:sample('api-message',{body:{contentType:'text',content:'Please quote a replacement battery.'}})};
   if(action==='draft'){externalDraft={id:'provider-draft',toRecipients:[{emailAddress:{address:'sam@example.com'}}],body:{content:body.content},subject:'Re: Battery replacement'};return {record:externalDraft};}
   if(action==='review')return {record:externalDraft,approval:'review-token'};
   if(action==='send'){sends++;return {accepted:true};}
   throw new Error('Unexpected provider action '+action);
 };
 let deltaCalls=0,failDelta=false;
 const checkpoint='https://graph.microsoft.com/v1.0/users/sales%40example.com/mailFolders/inbox/messages/delta?$deltatoken=safe';
 const delta=async path=>{
   if(failDelta){const error=new Error('Provider unavailable');error.status=502;throw error;}
   deltaCalls++;
   if(deltaCalls===1){assert.match(path,/messages\/delta/);return {value:[sample('api-message')],'@odata.nextLink':'https://graph.microsoft.com/next-page'};}
   if(deltaCalls===2)assert.equal(path,'https://graph.microsoft.com/next-page');
   return {value:[sample('api-message')],'@odata.deltaLink':checkpoint};
 };
 const server=createServer((req,res)=>trackingHandler(req,res,env,{db:trackingDb(pg),provider,delta}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const call=(action,body,headers={Cookie:cookie,Origin:origin})=>fetch(origin+'/?action='+action,{method:body===undefined?'GET':'POST',headers:{...headers,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal((await call('threads',undefined,{})).status,401);
 assert.equal((await call('sync',{}, {Cookie:cookie,Origin:'https://wrong.example'})).status,403);
 for(const action of ['send','review','update_thread','threads'])assert.equal((await call(action,{}, {Authorization:'Bearer '+env.EMAIL_TRACKING_TOKEN})).status,403);
 assert.equal((await call('sync',{})).status,200);
 assert.equal((await call('sync',{})).status,200);
 assert.equal((await pg.query('select cursor_url from email_sync_cursors')).rows[0].cursor_url,checkpoint);
 failDelta=true;assert.equal((await call('sync',{})).status,502);failDelta=false;
 const afterFailure=(await pg.query('select cursor_url,lease_token from email_sync_cursors')).rows[0];
 assert.equal(afterFailure.cursor_url,checkpoint);assert.equal(afterFailure.lease_token,null);
 const threads=await (await call('threads')).json();assert.equal(threads.records.length,1);
 const thread=threads.records[0];
 const record=(await pg.query('select * from email_messages')).rows[0];
 const hydrated=await (await call('hydrate',{thread_id:thread.id,message_id:record.id})).json();assert.equal(hydrated.message.body_loaded,true);assert.equal(hydrated.message.provider_ref,undefined);
 const saved=await (await call('save_draft',{thread_id:thread.id,reply_to_message_id:record.id,revision:0,body:'Please confirm the UPS model.'})).json();
 assert.equal(saved.draft.revision,1);
 assert.equal((await call('send',{draft_id:saved.draft.id,revision:1})).status,409);
 const review=await (await call('review',{draft_id:saved.draft.id,revision:1})).json();assert.equal(review.review.body,'Please confirm the UPS model.');assert.equal(JSON.stringify(review).includes('review-token'),false);
 assert.equal((await call('send',{draft_id:saved.draft.id,revision:1})).status,202);
 assert.equal((await call('send',{draft_id:saved.draft.id,revision:1})).status,409);
 assert.equal(sends,1);
 assert.equal((await pg.query('select status from email_drafts')).rows[0].status,'submitted');
});

import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { configuration, getSession, createSession } from './auth-core.js';
import { mailHandler } from './mail-api.js';
import { renewHostingerReference, hostingerConfigured, hostingerConfiguration } from './hostinger-mail.js';
import { mailConfigured, mailConfiguration } from './microsoft-graph.js';
import { activeMicrosoftConnection, delegatedGraphClient } from './microsoft-oauth.js';
import { normalizeMessage, requireId, revision, text, validateWorkflow, workflowStatuses, pageCursor, encodeCursor } from './email-tracking-model.js';

const respond = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
const equal = (a,b) => timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const safeDraft = d => d && ({ id:d.id, thread_id:d.thread_id, reply_to_message_id:d.reply_to_message_id, current_body:d.current_body, original_ai_body:d.original_ai_body, to_addresses:d.to_addresses, subject:d.subject, revision:d.revision, source_message_version:d.source_message_version, status:d.status, updated_at:d.updated_at });
const safeMessage = ({ provider_ref, ...m }) => m;
async function bodyOf(req) {
  let raw = '';
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw)>180000) throw new Error('Request is too large.'); }
  if (Buffer.byteLength(raw)>180000) throw new Error('Request is too large.');
  const body = JSON.parse(raw || '{}');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request.');
  return body;
}
// Reuse provider validation and transport without an HTTP round-trip or exposing credentials.
export async function providerRequest(action, params, body, env) {
  const config = configuration(env);
  const req = { method: body === undefined ? 'GET' : 'POST', url:'/?'+new URLSearchParams({action,...params}), body,
    headers:{ host:'tracking.internal', origin:`${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://tracking.internal`, cookie:`dcx_session=${createSession(config)}` } };
  // Hostinger uses env.NODE_ENV; keep both handlers on the same internally generated origin.
  const effectiveEnv = { ...env, NODE_ENV: process.env.NODE_ENV };
  let output;
  const res = { statusCode:200, setHeader() {}, end(data) { output = JSON.parse(String(data)); } };
  await mailHandler(req,res,effectiveEnv);
  if (res.statusCode>=400 || !output) { const e = new Error(output?.error || 'Mailbox request failed.'); e.status = res.statusCode; throw e; }
  return output;
}
export async function trackingHandler(req,res,env=process.env,injected={}) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  const url = new URL(req.url,'http://localhost'); const action = url.searchParams.get('action') || 'threads';
  const token = String(req.headers.authorization || '').replace(/^Bearer /,'');
  const worker = (env.EMAIL_TRACKING_TOKEN || '').length>=32 && equal(token,env.EMAIL_TRACKING_TOKEN);
  const session = getSession(req,configuration(env));
  if (!session && !worker) return respond(res,401,{error:'Sign in to access tracked email.'});
  const workerActions = ['sync','claim','context','complete','fail','report'];
  if (worker && !workerActions.includes(action)) return respond(res,403,{error:'Automation cannot approve, send, or change user workflow decisions.'});
  if (!['GET','POST'].includes(req.method)) return respond(res,405,{error:'Method not allowed.'});
  if (!worker && req.method==='POST' && (req.headers.origin!==`${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${req.headers.host}` || req.headers['sec-fetch-site']==='cross-site')) return respond(res,403,{error:'Request origin is not allowed.'});
  if (!injected.db && (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY)) return respond(res,503,{error:'Email tracking requires the server Supabase connection.'});
  const db = injected.db || createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const provider = String(env.MAIL_PROVIDER || '').toLowerCase()==='hostinger' || (!env.MAIL_PROVIDER && hostingerConfigured(hostingerConfiguration(env)) && !mailConfigured(mailConfiguration(env))) ? 'hostinger' : 'microsoft';
  const mail = injected.provider || ((a,p={},b) => providerRequest(a,p,b,env));
  const oauth = provider==='microsoft' ? await activeMicrosoftConnection(env,injected.db).catch(()=>null) : null;
  const delegated = provider==='microsoft' && oauth && !injected.provider ? await delegatedGraphClient(env,injected.db) : null;
  const delta = injected.delta || (provider==='microsoft' && !injected.provider ? delegated?.graph || null : null);
  const checked = async query => { const {data,error} = await query; if(error) { const e=new Error(error.message); e.code=error.code; throw e; } return data; };
  let box;
  try {
    let address = provider==='hostinger' ? env.HOSTINGER_MAILBOX : oauth?.email_address || env.MICROSOFT_MAILBOX;
    if (!address) address = (await mail('status')).mailbox;
    if (!address) return respond(res,503,{error:'Configure the mailbox before enabling tracking.'});
    box = await checked(db.from('email_mailboxes').upsert({provider,address:address.toLowerCase()},{onConflict:'provider,address'}).select().single());
    const actor = worker ? 'n8n' : session.email;
    const command = (name,input) => checked(db.rpc('email_command',{p_mailbox:box.id,p_action:name,p_input:input,p_actor:actor}));
    const workerCommand = (name,input) => checked(db.rpc('email_worker',{p_mailbox:box.id,p_action:name,p_input:input}));
    const getThread = async id => { requireId(id); const t=await checked(db.from('email_threads').select('*').eq('mailbox_id',box.id).eq('id',id).maybeSingle()); if (!t) { const e=new Error('Conversation not found.');e.status=404;throw e; } return t; };
    const getDraft = async id => { requireId(id); const d=await checked(db.from('email_drafts').select('*').eq('id',id).maybeSingle()); if(!d) throw new Error('Draft not found.'); await getThread(d.thread_id); return d; };
    const refFor = m => provider==='hostinger' ? renewHostingerReference(m.provider_ref,env) : m.provider_ref;
    const hydrate = async m => {
      const {record}=await mail('message',{id:refFor(m)});
      const normalized=normalizeMessage(record,provider,box.address);
      if(normalized.provider_key!==m.provider_key) throw new Error('Message identity changed; sync the mailbox again.');
      const saved=await command('ingest',normalized);
      if(record.hasAttachments) {
        const page=await mail('attachments',{id:refFor(m)});
        if(page.records?.length) await checked(db.from('email_attachments').upsert(page.records.map(a=>({message_id:m.id,provider_id:a.id,name:a.name,content_type:a.contentType || '',size_bytes:a.size || 0})),{onConflict:'message_id,provider_id'}));
      }
      return saved;
    };
    if(req.method==='GET') {
      if(action==='report') {
        const days=Number(url.searchParams.get('days') || 7), timezone=url.searchParams.get('timezone') || 'UTC';
        if(![1,7,30].includes(days))throw new Error('Choose 1, 7 or 30 days.');
        try { new Intl.DateTimeFormat('en',{timeZone:timezone}); } catch { throw new Error('Invalid reporting timezone.'); }
        return respond(res,200,{report:await checked(db.rpc('email_report',{p_mailbox:box.id,p_days:days,p_timezone:timezone})),mailbox:{address:box.address,last_synced_at:box.last_synced_at}});
      }
      if(action==='overview') {
        const count=async query=>{const {count,error}=await query;if(error)throw error;return count || 0;};
        const [attention,drafts,waiting,due,recent]=await Promise.all([
          count(db.from('email_threads').select('id',{count:'exact',head:true}).eq('mailbox_id',box.id).eq('status','needs_attention')),
          count(db.from('email_threads').select('id',{count:'exact',head:true}).eq('mailbox_id',box.id).eq('status','draft_ready')),
          count(db.from('email_threads').select('id',{count:'exact',head:true}).eq('mailbox_id',box.id).eq('status','waiting_customer')),
          count(db.from('email_threads').select('id',{count:'exact',head:true}).eq('mailbox_id',box.id).neq('status','closed').lte('followup_at',new Date().toISOString())),
          checked(db.from('email_threads').select('id,subject,status,next_action,last_message_at').eq('mailbox_id',box.id).neq('status','closed').order('last_message_at',{ascending:false}).limit(4))
        ]);
        return respond(res,200,{attention,drafts,waiting,due,recent});
      }
      if(action==='attachment') {
        const id=requireId(url.searchParams.get('id'));
        const a=await checked(db.from('email_attachments').select('*').eq('id',id).single());
        const m=await checked(db.from('email_messages').select('*').eq('id',a.message_id).eq('mailbox_id',box.id).single());
        await getThread(m.thread_id);
        res.statusCode=302;res.setHeader('Location','/api/mail?'+new URLSearchParams({action:'download',id:refFor(m),attachment:a.provider_id}));return res.end();
      }
      if(action==='threads') {
        const status=url.searchParams.get('status') || 'all';
        if(!['all','due',...workflowStatuses].includes(status)) throw new Error('Invalid queue.');
        let query=db.from('email_threads').select('*').eq('mailbox_id',box.id);
        if(status==='due') query=query.neq('status','closed').lte('followup_at',new Date().toISOString());
        else if(status!=='all') query=query.eq('status',status);
        const search=url.searchParams.get('q'); if(search) query=query.ilike('subject',`%${text(search,200).replace(/[\\%_]/g,'\\$&')}%`);
        const cursor=pageCursor(url.searchParams.get('cursor'));
        if(cursor) query=query.or(`last_message_at.lt.${cursor.at},and(last_message_at.eq.${cursor.at},id.lt.${cursor.id})`);
        const records=await checked(query.order('last_message_at',{ascending:false}).order('id',{ascending:false}).limit(31));
        return respond(res,200,{records:records.slice(0,30),next:records.length>30?encodeCursor(records[29],'last_message_at'):null,mailbox:{address:box.address,last_synced_at:box.last_synced_at},automationEnabled:(env.EMAIL_TRACKING_TOKEN || '').length>=32});
      }
      if(action==='thread') {
        const thread=await getThread(url.searchParams.get('id'));
        let q=db.from('email_messages').select('*').eq('thread_id',thread.id);
        const cursor=pageCursor(url.searchParams.get('cursor'));
        if(cursor) q=q.or(`occurred_at.lt.${cursor.at},and(occurred_at.eq.${cursor.at},id.lt.${cursor.id})`);
        const [messages,drafts,activity,jobs,replyTarget]=await Promise.all([
          checked(q.order('occurred_at',{ascending:false}).order('id',{ascending:false}).limit(31)),
          checked(db.from('email_drafts').select('*').eq('thread_id',thread.id).neq('status','sent').limit(1)),
          checked(db.from('email_activity').select('*').eq('thread_id',thread.id).order('id',{ascending:false}).limit(30)),
          checked(db.from('email_automation_jobs').select('id,kind,status,error,attempts,execution_id,created_at').eq('thread_id',thread.id).order('created_at',{ascending:false}).limit(10)),
          checked(db.from('email_messages').select('*').eq('thread_id',thread.id).eq('direction','incoming').order('occurred_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle())
        ]);
        return respond(res,200,{thread,messages:messages.slice(0,30).map(safeMessage),next:messages.length>30?encodeCursor(messages[29],'occurred_at'):null,draft:safeDraft(drafts[0]),activity,jobs,reply_target:replyTarget?safeMessage(replyTarget):null});
      }
      return respond(res,400,{error:'Unknown read action.'});
    }
    const input=await bodyOf(req);
    if(action==='sync') {
      // Each request processes one bounded provider page; its returned cursor enables backfill.
      const requestedFolder=text(input.folder || 'inbox',500,true);
      const folder=provider==='hostinger'?({inbox:'INBOX',sentitems:'INBOX.Sent'}[requestedFolder] || requestedFolder):requestedFolder;
      if(input.cursor && typeof input.cursor!=='string') throw new Error('Invalid sync cursor.');
      let lease, page;
      const syncState=(name,data)=>checked(db.rpc('email_sync',{p_mailbox:box.id,p_folder:folder,p_action:name,p_input:data}));
      if(delta) lease=await syncState('claim',{});
      try {
      if(delta) {
        const fields='id,internetMessageId,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isDraft,hasAttachments';
        const raw=await delta(lease.cursor_url || `/mailFolders/${encodeURIComponent(folder)}/messages/delta?${new URLSearchParams({'$select':fields,'$top':'50'})}`);
        page={records:(raw.value || []).filter(m=>!m['@removed']),next:raw['@odata.nextLink']?'continue':null,cursor:raw['@odata.nextLink'] || raw['@odata.deltaLink']};
        if(!page.cursor)throw new Error('Outlook returned no sync checkpoint; the folder will be retried safely.');
      } else page=await mail(input.cursor?'page':'messages',input.cursor?{cursor:input.cursor}:{folder});
      let count=0;const touched=new Set();
      for(const record of [...page.records].filter(m=>!m.isDraft).sort((a,b)=>Date.parse(a.receivedDateTime)-Date.parse(b.receivedDateTime))) {
        const saved=await command('ingest',normalizeMessage(record,provider,box.address)); count++;
        if(saved.direction==='incoming')touched.add(saved.thread_id);
      }
      if(worker && input.generate_drafts===true) for(const id of touched) {
        const thread=await getThread(id);
        const drafts=await checked(db.from('email_drafts').select('id').eq('thread_id',id).neq('status','sent').limit(1));
        const latest=await checked(db.from('email_messages').select('direction,occurred_at').eq('thread_id',id).order('occurred_at',{ascending:false}).limit(1).maybeSingle());
        // Initial history imports must not generate years of obsolete replies.
        if(thread.status==='needs_attention'&&!drafts.length&&latest?.direction==='incoming'&&Date.parse(latest.occurred_at)>=Date.now()-7*86400000) await command('queue_draft',{thread_id:id,request_id:`auto:${id}:${thread.message_version}`});
      }
      if(lease)await syncState('finish',{lease_token:lease.lease_token,cursor_url:page.cursor});
      // Outlook checkpoints advance only after ingestion under a leased database lock.
      await checked(db.from('email_mailboxes').update({last_synced_at:new Date().toISOString()}).eq('id',box.id));
      return respond(res,200,{processed:count,next:page.next,folder});
      } catch(error) {
        if(lease)await syncState('finish',{lease_token:lease.lease_token,error:String(error.message).slice(0,2000),...(error.status===410?{cursor_url:null}:{})}).catch(()=>{});
        throw error;
      }
    }
    if(action==='hydrate') {
      const thread=await getThread(input.thread_id); requireId(input.message_id);
      const m=await checked(db.from('email_messages').select('*').eq('thread_id',thread.id).eq('id',input.message_id).single());
      return respond(res,200,{message:safeMessage(await hydrate(m)),attachments:await checked(db.from('email_attachments').select('id,name,size_bytes,content_type').eq('message_id',m.id))});
    }
    if(action==='update_thread') return respond(res,200,{thread:await command(action,validateWorkflow(input))});
    if(action==='save_draft') {
      requireId(input.thread_id);requireId(input.reply_to_message_id);revision(input.revision);text(input.body,50000,true);
      return respond(res,200,{draft:safeDraft(await command(action,{thread_id:input.thread_id,reply_to_message_id:input.reply_to_message_id,revision:input.revision,body:input.body}))});
    }
    if(action==='queue_draft') {
      if((env.EMAIL_TRACKING_TOKEN || '').length<32) return respond(res,503,{error:'Configure the n8n tracking worker before requesting AI drafts. You can write and save a reply now.'});
      requireId(input.thread_id); requireId(input.request_id);
      return respond(res,202,{job:await command(action,{thread_id:input.thread_id,request_id:input.request_id})});
    }
    if(action==='review') {
      const d=await getDraft(input.draft_id); revision(input.revision);
      if(d.revision!==input.revision || !['editing','approved'].includes(d.status)) return respond(res,409,{error:'Draft changed or dispatch already requested.'});
      const original=await checked(db.from('email_messages').select('*').eq('id',d.reply_to_message_id).single());
      const prepared=await mail('draft',{}, {replyTo:refFor(original),content:d.current_body});
      const reviewed=await mail('review',{}, {id:prepared.record.id});
      const reviewedRecipients=(reviewed.record.toRecipients || []).map(r=>r.emailAddress.address.toLowerCase());
      if(JSON.stringify(reviewedRecipients)!==JSON.stringify(d.to_addresses) || reviewed.record.ccRecipients?.length || reviewed.record.bccRecipients?.length || reviewed.record.body?.content!==d.current_body || reviewed.record.hasAttachments) throw new Error('Provider draft differs from the saved reply. Review it in the mailbox before sending.');
      await command('approve',{thread_id:d.thread_id,draft_id:d.id,revision:d.revision,provider_draft_id:prepared.record.id,provider_review:{approval:reviewed.approval}});
      return respond(res,200,{review:{draft_id:d.id,revision:d.revision,to:d.to_addresses,subject:reviewed.record.subject,body:d.current_body,expires_at:new Date(Date.now()+9*60000).toISOString()}});
    }
    if(action==='send') {
      const d=await getDraft(input.draft_id);revision(input.revision);
      const claim=await command('claim_send',{thread_id:d.thread_id,draft_id:d.id,revision:input.revision});
      let result;
      try { result=await mail('send',{}, {approval:claim.provider_review.approval}); }
      catch(e) {
        await command('finish_send',{thread_id:d.thread_id,draft_id:d.id,job_id:claim.job_id,status:'uncertain',error:String(e.message).slice(0,2000)});
        return respond(res,502,{error:'Send outcome needs checking. Inspect Sent mail before taking further action. Automatic resend is blocked.'});
      }
      await command('finish_send',{thread_id:d.thread_id,draft_id:d.id,job_id:claim.job_id,status:'submitted'});
      return respond(res,202,{accepted:true,message:result.message || 'Submitted. Delivery is not yet confirmed.'});
    }
    if(action==='confirm_sent') {
      const d=await getDraft(input.draft_id);requireId(input.message_id);
      return respond(res,200,await command(action,{thread_id:d.thread_id,draft_id:d.id,message_id:input.message_id}));
    }
    if(worker && action==='claim') return respond(res,200,{job:await workerCommand('claim',{execution_id:text(input.execution_id || '',200)})});
    if(worker && ['context','complete','fail'].includes(action)) {
      requireId(input.job_id);requireId(input.lease_token);
      if(action==='context') {
        const job=await checked(db.from('email_automation_jobs').select('*').eq('id',input.job_id).eq('lease_token',input.lease_token).eq('status','running').gt('lease_until',new Date().toISOString()).single());
        if(job.kind!=='generate_draft') throw new Error('Unsupported job type.');
        const thread=await getThread(job.thread_id);
        const messages=await checked(db.from('email_messages').select('*').eq('thread_id',thread.id).order('occurred_at',{ascending:false}).limit(10));
        const hydrated=[];for(const m of messages) hydrated.push(safeMessage(m.body_loaded?m:await hydrate(m)));
        const customer=thread.customer_id?await checked(db.from('crm_customers').select('*').eq('id',thread.customer_id).single()):null;
        const history={};
        if(customer)for(const entity of ['sites','equipment','purchases','services'])history[entity]=await checked(db.from(`crm_${entity}`).select('*').eq('customer_id',customer.id).order('updated_at',{ascending:false}).limit(10));
        return respond(res,200,{thread,customer,customer_history:history,history_limit_per_type:10,messages:hydrated.reverse(),truncated:messages.length===10});
      }
      if(action==='complete') {text(input.body,50000,true);text(input.summary || '',10000);}
      else text(input.error,2000,true);
      const result=await workerCommand(action,{job_id:input.job_id,lease_token:input.lease_token,body:input.body,summary:input.summary || '',error:input.error});
      return respond(res,200,{result:action==='complete' && result?.id?safeDraft(result):result});
    }
    return respond(res,400,{error:'Unknown tracking action.'});
  } catch(e) {
    if(['PGRST202','PGRST205','42P01','42703'].includes(e.code)) return respond(res,503,{code:'MIGRATION_REQUIRED',error:action==='report'?'Run supabase/migrations/202609240001_reporting_and_proposals.sql in Supabase SQL Editor, then retry.':'Apply the email tracking migrations in Supabase SQL Editor, then retry.'});
    const conflict=e.code==='23505' || /Conflict:|Dispatch|Review expired/i.test(e.message);
    const databaseError=e.code && !['P0001','23505'].includes(e.code);
    return respond(res,conflict?409:e.status || (databaseError?502:400),{error:databaseError?'Email tracking database request failed. Your changes were not confirmed.':e.message || 'Tracking request failed.'});
  }
}

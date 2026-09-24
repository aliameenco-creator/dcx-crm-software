-- Run after the customer CRM and manageable workspace migrations.
-- Single-owner workspace; all access goes through the authenticated server.
begin;
create table public.email_mailboxes (
 id uuid primary key default gen_random_uuid(), provider text not null check(provider in ('hostinger','microsoft')),
 address text not null, sync_state jsonb not null default '{}', last_synced_at timestamptz,
 created_at timestamptz not null default now(), unique(provider,address)
);
create table public.email_threads (
 id uuid primary key default gen_random_uuid(), mailbox_id uuid not null references public.email_mailboxes(id),
 provider_thread_key text not null, customer_id uuid references public.crm_customers(id), subject text not null,
 status text not null default 'needs_attention' check(status in ('needs_attention','draft_ready','waiting_customer','closed','failed')),
 priority text not null default 'normal' check(priority in ('normal','high')),
 assigned_to text not null default '', next_action text not null default '', followup_at timestamptz,
 summary text not null default '', summary_message_version integer,
 version integer not null default 1, message_version integer not null default 0,
 last_message_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(mailbox_id,provider_thread_key)
);
create table public.email_sync_cursors (
 mailbox_id uuid not null references public.email_mailboxes(id), folder text not null,
 cursor_url text, lease_token uuid, lease_until timestamptz, last_error text, updated_at timestamptz not null default now(),
 primary key(mailbox_id,folder)
);
create index email_threads_queue on public.email_threads(mailbox_id,status,last_message_at desc,id);
create index email_threads_followups on public.email_threads(mailbox_id,followup_at) where followup_at is not null and status <> 'closed';
create index email_threads_customer on public.email_threads(customer_id);
create table public.email_messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.email_threads(id), mailbox_id uuid not null references public.email_mailboxes(id),
 provider_key text not null, provider_ref text not null, internet_message_id text, in_reply_to text,
 direction text not null check(direction in ('incoming','outgoing')), sender text not null default '',
 to_addresses jsonb not null default '[]', cc_addresses jsonb not null default '[]', subject text not null,
 body_text text not null default '', body_html text not null default '', body_loaded boolean not null default false,
 has_attachments boolean not null default false, occurred_at timestamptz not null,
 created_at timestamptz not null default now(), unique(mailbox_id,provider_key)
);
create index email_messages_thread on public.email_messages(thread_id,occurred_at,id);
create index email_messages_internet on public.email_messages(mailbox_id,internet_message_id);
create table public.email_attachments (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.email_messages(id),
 provider_id text not null, name text not null, content_type text not null default '', size_bytes bigint not null default 0,
 storage_path text, created_at timestamptz not null default now(), unique(message_id,provider_id)
);
create table public.email_drafts (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.email_threads(id),
 reply_to_message_id uuid not null references public.email_messages(id),
 current_body text not null, original_ai_body text, to_addresses jsonb not null, subject text not null,
 revision integer not null default 1, source_message_version integer not null,
 status text not null default 'editing' check(status in ('editing','approved','sending','submitted','uncertain','sent')),
 provider_draft_id text, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create unique index email_one_open_draft on public.email_drafts(thread_id) where status <> 'sent';
create table public.email_draft_revisions (
 id uuid primary key default gen_random_uuid(), draft_id uuid not null references public.email_drafts(id), revision integer not null,
 body text not null, to_addresses jsonb not null, subject text not null, actor text not null, created_at timestamptz not null default now(), unique(draft_id,revision)
);
create table public.email_approvals (
 id uuid primary key default gen_random_uuid(), draft_id uuid not null references public.email_drafts(id), revision integer not null,
 actor text not null, provider_review jsonb not null, approved_at timestamptz not null default now(), unique(draft_id,revision)
);
create table public.email_automation_jobs (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.email_threads(id),
 kind text not null check(kind in ('generate_draft','send')), idempotency_key text not null unique,
 status text not null default 'queued' check(status in ('queued','running','completed','failed','submitted','uncertain')),
 payload jsonb not null default '{}', lease_token uuid, lease_until timestamptz, attempts integer not null default 0,
 execution_id text, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index email_jobs_queue on public.email_automation_jobs(kind,status,created_at);
create table public.email_activity (
 id bigint generated always as identity primary key, thread_id uuid not null references public.email_threads(id),
 action text not null, actor text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index email_activity_thread on public.email_activity(thread_id,id desc);

-- Each command is a transaction. Row locks protect revisions, approvals and send claims.
create function public.email_command(p_mailbox uuid, p_action text, p_input jsonb, p_actor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 t public.email_threads; m public.email_messages; d public.email_drafts; j public.email_automation_jobs;
 v_thread uuid; v_key text; v_new boolean := false; v_count integer; v_customer uuid; v_result jsonb;
begin
 if not exists(select 1 from public.email_mailboxes where id=p_mailbox) then raise exception 'Mailbox not found'; end if;
 if p_action='ingest' then
  -- Serialize intake for a mailbox; repeat events only refresh provider references/body.
  perform 1 from public.email_mailboxes where id=p_mailbox for update;
  select * into m from public.email_messages where mailbox_id=p_mailbox and provider_key=p_input->>'provider_key';
  if found then
   update public.email_messages set provider_ref=p_input->>'provider_ref',
    body_text=case when (p_input->>'body_loaded')::boolean then p_input->>'body_text' else body_text end,
    body_html=case when (p_input->>'body_loaded')::boolean then p_input->>'body_html' else body_html end,
    body_loaded=body_loaded or (p_input->>'body_loaded')::boolean where id=m.id returning * into m;
   return to_jsonb(m);
  end if;
  v_key := p_input->>'thread_key';
  if p_input->>'in_reply_to' is not null then
   select thread_id into v_thread from public.email_messages where mailbox_id=p_mailbox and internet_message_id=p_input->>'in_reply_to' order by created_at limit 1;
  end if;
  if v_thread is null then
   select id into v_thread from public.email_threads where mailbox_id=p_mailbox and provider_thread_key=v_key;
  end if;
  if v_thread is null then
   insert into public.email_threads(mailbox_id,provider_thread_key,subject,last_message_at)
   values(p_mailbox,v_key,p_input->>'subject',(p_input->>'occurred_at')::timestamptz) returning id into v_thread;
   v_new := true;
  end if;
  select * into t from public.email_threads where id=v_thread for update;
  insert into public.email_messages(thread_id,mailbox_id,provider_key,provider_ref,internet_message_id,in_reply_to,direction,sender,to_addresses,cc_addresses,subject,body_text,body_html,body_loaded,has_attachments,occurred_at)
  values(v_thread,p_mailbox,p_input->>'provider_key',p_input->>'provider_ref',p_input->>'internet_message_id',p_input->>'in_reply_to',p_input->>'direction',p_input->>'sender',p_input->'to_addresses',p_input->'cc_addresses',p_input->>'subject',p_input->>'body_text',p_input->>'body_html',(p_input->>'body_loaded')::boolean,(p_input->>'has_attachments')::boolean,(p_input->>'occurred_at')::timestamptz) returning * into m;
  if t.customer_id is null and m.direction='incoming' then
   select count(*), (array_agg(id))[1] into v_count,v_customer from (
    select id from public.crm_customers where email=m.sender
    union select customer_id from public.crm_contacts where email=m.sender
   ) matches;
   if v_count <> 1 then v_customer := null; end if;
  end if;
  update public.email_threads set message_version=message_version+1, version=version+1,
   customer_id=coalesce(customer_id,v_customer), last_message_at=greatest(last_message_at,m.occurred_at),
   status=case when v_new and m.direction='outgoing' then 'waiting_customer' when m.direction='incoming' and (v_new or m.occurred_at>=t.last_message_at) then 'needs_attention' else status end,
   updated_at=now() where id=v_thread;
  insert into public.email_activity(thread_id,action,actor,details) values(v_thread,'message_synced',p_actor,jsonb_build_object('message_id',m.id,'direction',m.direction));
  return to_jsonb(m);
 end if;

 select * into t from public.email_threads where id=(p_input->>'thread_id')::uuid and mailbox_id=p_mailbox for update;
 if not found then raise exception 'Conversation not found'; end if;
 if p_action='update_thread' then
  if t.version<>(p_input->>'version')::integer then raise exception 'Conflict: conversation changed; reload'; end if;
  update public.email_threads set status=p_input->>'status', priority=p_input->>'priority', assigned_to=p_input->>'assigned_to',
   next_action=p_input->>'next_action', followup_at=nullif(p_input->>'followup_at','')::timestamptz,
   customer_id=nullif(p_input->>'customer_id','')::uuid, version=version+1,updated_at=now() where id=t.id returning * into t;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'workflow_updated',p_actor,jsonb_build_object('status',t.status,'customer_id',t.customer_id,'assigned_to',t.assigned_to,'next_action',t.next_action,'followup_at',t.followup_at));
  return to_jsonb(t);
 end if;
 if p_action='queue_draft' then
  if not exists(select 1 from public.email_messages where thread_id=t.id and direction='incoming') then raise exception 'An incoming message is required'; end if;
  select * into d from public.email_drafts where thread_id=t.id and status<>'sent';
  if found and d.status in ('sending','submitted','uncertain') then raise exception 'Dispatch pending; check sent mail'; end if;
  insert into public.email_automation_jobs(thread_id,kind,idempotency_key,payload)
  values(t.id,'generate_draft',p_input->>'request_id',jsonb_build_object('message_version',t.message_version,'thread_version',t.version,'draft_revision',coalesce(d.revision,0)))
  on conflict(idempotency_key) do nothing returning * into j;
  if j.id is null then select * into j from public.email_automation_jobs where idempotency_key=p_input->>'request_id' and thread_id=t.id; end if;
  insert into public.email_activity(thread_id,action,actor) values(t.id,'draft_requested',p_actor);
  return to_jsonb(j);
 end if;
 if p_action='save_draft' then
  select * into m from public.email_messages where id=(p_input->>'reply_to_message_id')::uuid and thread_id=t.id and direction='incoming';
  if not found then raise exception 'Select an incoming message to reply to'; end if;
  select * into d from public.email_drafts where thread_id=t.id and status<>'sent' for update;
  if coalesce(d.revision,0)<>(p_input->>'revision')::integer then raise exception 'Conflict: draft changed; reload'; end if;
  if d.status in ('sending','submitted','uncertain') then raise exception 'Dispatch already requested; do not resend'; end if;
  if d.id is null then
   insert into public.email_drafts(thread_id,reply_to_message_id,current_body,to_addresses,subject,source_message_version,original_ai_body)
   values(t.id,m.id,p_input->>'body',jsonb_build_array(m.sender),case when m.subject ~* '^re:' then m.subject else 'Re: '||m.subject end,t.message_version,p_input->>'original_ai_body') returning * into d;
  else
   update public.email_drafts set current_body=p_input->>'body', reply_to_message_id=m.id, to_addresses=jsonb_build_array(m.sender),
    revision=revision+1,status='editing',original_ai_body=coalesce(original_ai_body,p_input->>'original_ai_body'),source_message_version=t.message_version,updated_at=now() where id=d.id returning * into d;
  end if;
  insert into public.email_draft_revisions(draft_id,revision,body,to_addresses,subject,actor) values(d.id,d.revision,d.current_body,d.to_addresses,d.subject,p_actor);
  update public.email_threads set status='draft_ready',version=version+1,updated_at=now() where id=t.id;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'draft_saved',p_actor,jsonb_build_object('draft_id',d.id,'revision',d.revision));
  return to_jsonb(d);
 end if;
 select * into d from public.email_drafts where id=(p_input->>'draft_id')::uuid and thread_id=t.id for update;
 if not found then raise exception 'Draft not found'; end if;
 if p_action='approve' then
  if d.status not in ('editing','approved') or d.revision<>(p_input->>'revision')::integer or d.source_message_version<>t.message_version then raise exception 'Conflict: draft or conversation changed; save and review again'; end if;
  insert into public.email_approvals(draft_id,revision,actor,provider_review) values(d.id,d.revision,p_actor,p_input->'provider_review')
  on conflict(draft_id,revision) do update set actor=excluded.actor, provider_review=excluded.provider_review,approved_at=now();
  update public.email_drafts set status='approved',provider_draft_id=p_input->>'provider_draft_id' where id=d.id;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'draft_reviewed',p_actor,jsonb_build_object('revision',d.revision));
  return jsonb_build_object('ok',true);
 elsif p_action='claim_send' then
  if d.status<>'approved' or d.revision<>(p_input->>'revision')::integer or d.source_message_version<>t.message_version then raise exception 'Conflict: review this draft again before sending'; end if;
  select provider_review into v_result from public.email_approvals where draft_id=d.id and revision=d.revision and approved_at>now()-interval '9 minutes';
  if v_result is null then raise exception 'Review expired; review again'; end if;
  insert into public.email_automation_jobs(thread_id,kind,idempotency_key,status,payload)
  values(t.id,'send','send:'||d.id||':'||d.revision,'running',jsonb_build_object('draft_id',d.id,'revision',d.revision)) returning * into j;
  update public.email_drafts set status='sending',updated_at=now() where id=d.id;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'send_requested',p_actor,jsonb_build_object('draft_id',d.id,'revision',d.revision));
  return jsonb_build_object('job_id',j.id,'provider_review',v_result);
 elsif p_action='finish_send' then
  if d.status<>'sending' then raise exception 'Send was not claimed'; end if;
  update public.email_drafts set status=p_input->>'status',updated_at=now() where id=d.id;
  update public.email_automation_jobs set status=p_input->>'status',error=p_input->>'error',updated_at=now() where id=(p_input->>'job_id')::uuid and thread_id=t.id and kind='send';
  update public.email_threads set status=case when p_input->>'status'='uncertain' then 'failed' else 'waiting_customer' end,version=version+1,updated_at=now() where id=t.id;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'send_'||(p_input->>'status'),p_actor,jsonb_build_object('draft_id',d.id,'error',p_input->>'error'));
  return jsonb_build_object('ok',true);
 elsif p_action='confirm_sent' then
  if d.status not in ('sending','submitted','uncertain') then raise exception 'No pending dispatch'; end if;
  select * into m from public.email_messages where id=(p_input->>'message_id')::uuid and thread_id=t.id and direction='outgoing';
  if not found or m.occurred_at<d.updated_at-interval '5 minutes' then raise exception 'Choose the matching sent message after this dispatch'; end if;
  update public.email_drafts set status='sent',updated_at=now() where id=d.id;
  update public.email_automation_jobs set status='completed',updated_at=now() where kind='send' and payload->>'draft_id'=d.id::text;
  update public.email_threads set status=case when exists(select 1 from public.email_messages where thread_id=t.id and direction='incoming' and occurred_at>m.occurred_at) then 'needs_attention' else 'waiting_customer' end,version=version+1,updated_at=now() where id=t.id;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'sent_copy_confirmed',p_actor,jsonb_build_object('draft_id',d.id,'message_id',m.id));
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown tracking command';
end $$;

create function public.email_worker(p_mailbox uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.email_automation_jobs; t public.email_threads; d public.email_drafts; m public.email_messages; result jsonb;
begin
 if p_action='claim' then
  -- Exhausted jobs remain inspectable instead of looping forever.
  update public.email_automation_jobs set status='failed',error='Worker lease expired after 3 attempts',updated_at=now()
   where kind='generate_draft' and status='running' and lease_until<now() and attempts>=3
   and thread_id in(select id from public.email_threads where mailbox_id=p_mailbox);
  select q.* into j from public.email_automation_jobs q join public.email_threads et on et.id=q.thread_id
   where et.mailbox_id=p_mailbox and q.kind='generate_draft' and q.attempts<3 and (q.status='queued' or(q.status='running' and q.lease_until<now()))
   order by q.created_at for update of q skip locked limit 1;
  if not found then return null; end if;
  update public.email_automation_jobs set status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1,execution_id=p_input->>'execution_id',updated_at=now() where id=j.id returning * into j;
  return to_jsonb(j);
 end if;
 -- Same lock order as user commands: thread, then draft/job.
 select et.* into t from public.email_threads et join public.email_automation_jobs q on q.thread_id=et.id where q.id=(p_input->>'job_id')::uuid and et.mailbox_id=p_mailbox for update of et;
 if not found then raise exception 'Job not found'; end if;
 select * into j from public.email_automation_jobs where id=(p_input->>'job_id')::uuid for update;
 if j.kind<>'generate_draft' or j.status<>'running' or j.lease_token<>(p_input->>'lease_token')::uuid or j.lease_until<now() then raise exception 'Conflict: worker lease expired or job already completed'; end if;
 if p_action='fail' then
  update public.email_automation_jobs set status='failed',error=p_input->>'error',updated_at=now() where id=j.id;
  insert into public.email_activity(thread_id,action,actor,details) values(t.id,'automation_failed','n8n',jsonb_build_object('job_id',j.id,'error',p_input->>'error'));
  return jsonb_build_object('ok',true);
 end if;
 select * into d from public.email_drafts where thread_id=t.id and status<>'sent';
 if t.version<>(j.payload->>'thread_version')::integer or t.status='closed' or t.message_version<>(j.payload->>'message_version')::integer or coalesce(d.revision,0)<>(j.payload->>'draft_revision')::integer or d.status in ('sending','submitted','uncertain') then
  update public.email_automation_jobs set status='failed',error='Conversation or draft changed. Generate a fresh draft.',updated_at=now() where id=j.id;
  return jsonb_build_object('stale',true);
 end if;
 select * into m from public.email_messages where thread_id=t.id and direction='incoming' order by occurred_at desc,id desc limit 1;
 result := public.email_command(p_mailbox,'save_draft',jsonb_build_object('thread_id',t.id,'reply_to_message_id',m.id,'revision',coalesce(d.revision,0),'body',p_input->>'body','original_ai_body',p_input->>'body'),'n8n');
 update public.email_threads set summary=coalesce(p_input->>'summary',''),summary_message_version=message_version where id=t.id;
 update public.email_automation_jobs set status='completed',updated_at=now() where id=j.id;
 return result;
end $$;

create function public.email_sync(p_mailbox uuid,p_folder text,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.email_sync_cursors;
begin
 insert into public.email_sync_cursors(mailbox_id,folder) values(p_mailbox,p_folder) on conflict do nothing;
 select * into s from public.email_sync_cursors where mailbox_id=p_mailbox and folder=p_folder for update;
 if p_action='claim' then
  if s.lease_until>now() then raise exception 'Conflict: this folder is already syncing'; end if;
  update public.email_sync_cursors set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
   where mailbox_id=p_mailbox and folder=p_folder returning * into s;
 elsif p_action='finish' then
  if s.lease_token is distinct from (p_input->>'lease_token')::uuid or s.lease_until<now() then raise exception 'Conflict: sync lease expired'; end if;
  update public.email_sync_cursors set cursor_url=case when p_input ? 'cursor_url' then p_input->>'cursor_url' else cursor_url end,
   last_error=p_input->>'error',lease_token=null,lease_until=null,updated_at=now()
   where mailbox_id=p_mailbox and folder=p_folder returning * into s;
 else raise exception 'Unknown sync action'; end if;
 return to_jsonb(s);
end $$;

do $$ declare n text; begin
 foreach n in array array['email_mailboxes','email_sync_cursors','email_threads','email_messages','email_attachments','email_drafts','email_draft_revisions','email_approvals','email_automation_jobs','email_activity'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on public.%I from anon,authenticated',n);
  execute format('grant select,insert,update on public.%I to service_role',n);
 end loop;
end $$;
grant usage,select on sequence public.email_activity_id_seq to service_role;
revoke all on function public.email_command(uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.email_worker(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.email_sync(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.email_command(uuid,text,jsonb,text),public.email_worker(uuid,text,jsonb) to service_role;
grant execute on function public.email_sync(uuid,text,text,jsonb) to service_role;
commit;

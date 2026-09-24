begin;

create index if not exists email_messages_reporting on public.email_messages(mailbox_id, occurred_at, direction);

create function public.email_reconcile_sent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare draft_id uuid;
begin
 if new.direction<>'outgoing' then return new; end if;
 -- Old backfill cannot reset a conversation with a newer incoming message.
 update public.email_threads set status='waiting_customer'
 where id=new.thread_id and new.occurred_at>=last_message_at and status not in ('closed','failed')
 and not exists(select 1 from public.email_drafts d where d.thread_id=new.thread_id and d.status in ('editing','approved'));
 -- Microsoft immutable IDs survive the move from Drafts to Sent Items.
 update public.email_drafts d set status='sent',updated_at=now()
 where d.thread_id=new.thread_id and d.provider_draft_id=new.provider_key
 and d.status in ('submitted','uncertain') and new.occurred_at>=d.created_at
 and exists(select 1 from public.email_mailboxes b where b.id=new.mailbox_id and b.provider='microsoft')
 returning d.id into draft_id;
 if draft_id is not null then
  update public.email_automation_jobs set status='completed',updated_at=now() where kind='send' and payload->>'draft_id'=draft_id::text;
  update public.email_threads set status='waiting_customer' where id=new.thread_id and status<>'closed' and new.occurred_at>=last_message_at;
  insert into public.email_activity(thread_id,action,actor,details) values(new.thread_id,'sent_copy_matched','sync',jsonb_build_object('draft_id',draft_id,'message_id',new.id));
 end if;
 return new;
end $$;
create trigger email_reconcile_sent after insert on public.email_messages for each row execute function public.email_reconcile_sent();
revoke all on function public.email_reconcile_sent() from public,anon,authenticated;

-- Reporting uses actual synced mail, never a draft or a send request as proof of reply.
create or replace function public.email_report(p_mailbox uuid, p_days integer default 7, p_timezone text default 'UTC')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; start_at timestamptz; end_at timestamptz := now();
begin
 if p_days not in (1,7,30) then raise exception 'Choose 1, 7 or 30 days'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid reporting timezone'; end if;
 start_at := ((end_at at time zone p_timezone)::date - (p_days-1))::timestamp at time zone p_timezone;
 with period as (
  select * from public.email_messages where mailbox_id=p_mailbox and occurred_at>=start_at and occurred_at<=end_at
 ), cohort as (
  select thread_id,min(occurred_at) first_incoming from period where direction='incoming' group by thread_id
 ), answered as (
  select c.*, (select min(m.occurred_at) from public.email_messages m where m.mailbox_id=p_mailbox and m.thread_id=c.thread_id and m.direction='outgoing' and m.occurred_at>c.first_incoming and m.occurred_at<=end_at) first_reply from cohort c
 ), days as (
  select ((end_at at time zone p_timezone)::date - n) as day from generate_series(0,p_days-1) n
 ), daily as (
  select d.day,
   count(m.id) filter(where m.direction='incoming') received,
   count(m.id) filter(where m.direction='outgoing') sent,
   count(distinct m.thread_id) filter(where m.direction='outgoing' and exists(select 1 from public.email_messages i where i.thread_id=m.thread_id and i.mailbox_id=p_mailbox and i.direction='incoming' and i.occurred_at<m.occurred_at)) replied
  from days d left join period m on (m.occurred_at at time zone p_timezone)::date=d.day group by d.day
 ) select jsonb_build_object(
  'days',p_days,'timezone',p_timezone,'from',start_at,'through',end_at,
  'received',(select count(*) from period where direction='incoming'),
  'sent',(select count(*) from period where direction='outgoing'),
  'conversations_received',(select count(*) from cohort),
  'conversations_replied',(select count(*) from answered where first_reply is not null),
  'reply_rate',(select round(100.0*count(first_reply)/nullif(count(*),0),1) from answered),
  'average_response_minutes',(select round(avg(extract(epoch from (first_reply-first_incoming))/60),1) from answered),
  'daily',(select coalesce(jsonb_agg(to_jsonb(daily) order by day desc),'[]'::jsonb) from daily),
  'folders',(select coalesce(jsonb_agg(jsonb_build_object('folder',folder,'updated_at',updated_at,'last_error',last_error,'backfill_complete',position('deltatoken' in lower(coalesce(cursor_url,'')))>0)),'[]'::jsonb) from public.email_sync_cursors where mailbox_id=p_mailbox)
 ) into result;
 return result;
end $$;
revoke all on function public.email_report(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.email_report(uuid,integer,text) to service_role;

create table public.crm_proposals (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.crm_customers(id),
 title text not null,
 customer_snapshot jsonb not null,
 content jsonb not null,
 template_key text not null default 'basic-v1',
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index crm_proposals_customer on public.crm_proposals(customer_id,created_at desc);
alter table public.crm_proposals enable row level security;
revoke all on public.crm_proposals from anon,authenticated;
grant select,insert,update on public.crm_proposals to service_role;
commit;

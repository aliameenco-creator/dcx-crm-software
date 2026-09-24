-- Run once in Supabase SQL Editor. Separate crm_ tables preserve legacy data.
begin;
create table public.crm_customers (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) > 0),
 phone text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.crm_contacts (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.crm_customers(id),
 name text not null, email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
 phone text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(customer_id,email)
);
create index crm_contacts_email_idx on public.crm_contacts(email);
create table public.crm_sites (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.crm_customers(id),
 name text not null, address text not null, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(customer_id,id)
);
create table public.crm_equipment (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.crm_customers(id),
 site_id uuid not null, name text not null, model text not null default '', serial_number text not null default '',
 battery_configuration text not null default '', source text not null default '', confirmed_on date, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(customer_id,id),
 foreign key(customer_id,site_id) references public.crm_sites(customer_id,id)
);
create unique index crm_equipment_serial_idx on public.crm_equipment(customer_id,lower(serial_number)) where serial_number <> '';
create table public.crm_purchases (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.crm_customers(id),
 equipment_id uuid, name text not null, occurred_on date not null, amount numeric(12,2) check(amount >= 0),
 source text not null check(length(trim(source)) > 0), notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(customer_id,equipment_id) references public.crm_equipment(customer_id,id)
);
create table public.crm_services (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.crm_customers(id),
 equipment_id uuid, name text not null, occurred_on date not null,
 source text not null check(length(trim(source)) > 0), notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(customer_id,equipment_id) references public.crm_equipment(customer_id,id)
);
create table public.crm_audit (
 id bigint generated always as identity primary key, table_name text not null, record_id uuid not null,
 operation text not null, old_record jsonb, new_record jsonb, occurred_at timestamptz not null default now()
);
create function public.crm_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end $$;
create function public.crm_log() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.crm_audit(table_name,record_id,operation,old_record,new_record)
 values(TG_TABLE_NAME,NEW.id,TG_OP,case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end,to_jsonb(NEW));
 return NEW;
end $$;
revoke all on function public.crm_touch() from public;
revoke all on function public.crm_log() from public;
do $$ declare t text; begin
 foreach t in array array['crm_customers','crm_contacts','crm_sites','crm_equipment','crm_purchases','crm_services'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select, insert, update on public.%I to service_role',t);
  execute format('create trigger touch_record before update on public.%I for each row execute function public.crm_touch()',t);
  execute format('create trigger record_change after insert or update on public.%I for each row execute function public.crm_log()',t);
  if t <> 'crm_customers' then execute format('create index %I on public.%I(customer_id)',t || '_customer_idx',t); end if;
 end loop;
end $$;
alter table public.crm_audit enable row level security;
revoke all on public.crm_audit from anon, authenticated;
grant select on public.crm_audit to service_role;
commit;

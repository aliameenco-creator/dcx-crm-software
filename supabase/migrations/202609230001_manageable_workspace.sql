begin;
alter table public.crm_customers
  add column if not exists contact text not null default '',
  add column if not exists email text not null default '',
  add column if not exists billing_address text not null default '',
  add column if not exists price_book text not null default 'standard';
create index if not exists crm_customers_email_idx on public.crm_customers(email) where email <> '';

-- Append-only snapshots: one unique version per book prevents concurrent overwrites.
create table public.calculator_rate_versions (
  id uuid primary key default gen_random_uuid(),
  book_id text not null,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  saved_by text not null,
  created_at timestamptz not null default now(),
  unique(book_id, version)
);
alter table public.calculator_rate_versions enable row level security;
revoke all on public.calculator_rate_versions from anon, authenticated;
grant select, insert on public.calculator_rate_versions to service_role;
revoke update, delete on public.calculator_rate_versions from service_role;
commit;

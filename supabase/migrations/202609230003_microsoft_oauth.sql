-- Delegated Microsoft connections for personal Outlook and Microsoft 365 accounts.
begin;
create table public.microsoft_oauth_connections (
 id uuid primary key default gen_random_uuid(),
 microsoft_account_id text not null unique,
 email_address text not null,
 display_name text not null default '',
 tenant_id text,
 token_ciphertext text not null,
 granted_scopes text[] not null default '{}',
 token_expires_at timestamptz not null,
 is_active boolean not null default false,
 connected_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index microsoft_one_active_connection on public.microsoft_oauth_connections(is_active) where is_active;
alter table public.microsoft_oauth_connections enable row level security;
revoke all on public.microsoft_oauth_connections from anon,authenticated;
grant select,insert,update,delete on public.microsoft_oauth_connections to service_role;
commit;

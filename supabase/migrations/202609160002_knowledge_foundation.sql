-- Optional foundation only. Document uploading/embedding/search workflows are not implemented yet.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create table public.crm_documents (
 id uuid primary key default gen_random_uuid(), title text not null,
 storage_path text not null, version integer not null default 1,
 status text not null default 'draft' check(status in ('draft','approved','retired')),
 created_at timestamptz not null default now()
);
-- Dimension is deliberately unspecified until an embedding model is chosen.
-- All searchable chunks must later use the same model/dimension.
create table public.crm_knowledge_chunks (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.crm_documents(id),
 chunk_index integer not null, content text not null, source_page text,
 embedding extensions.vector, embedding_model text,
 unique(document_id,chunk_index)
);
alter table public.crm_documents enable row level security;
alter table public.crm_knowledge_chunks enable row level security;
revoke all on public.crm_documents,public.crm_knowledge_chunks from anon,authenticated;
grant select,insert,update,delete on public.crm_documents,public.crm_knowledge_chunks to service_role;
insert into storage.buckets(id,name,public) values ('crm-private','crm-private',false) on conflict(id) do nothing;
commit;

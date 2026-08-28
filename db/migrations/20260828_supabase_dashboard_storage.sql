create table if not exists public.dashboard_state (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  bucket text not null,
  storage_path text not null,
  original_name text not null,
  content_type text not null default 'application/octet-stream',
  size bigint not null default 0,
  category text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

create index if not exists documents_category_created_at_idx on public.documents (category, created_at desc);

insert into storage.buckets (id, name, public)
values
  ('tax-documents', 'tax-documents', false),
  ('legal-documents', 'legal-documents', false),
  ('bank-statements', 'bank-statements', false),
  ('payment-attachments', 'payment-attachments', false),
  ('excel-imports', 'excel-imports', false)
on conflict (id) do update set public = false;

alter table public.dashboard_state enable row level security;
alter table public.documents enable row level security;

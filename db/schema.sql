create table if not exists upload_batches (
  id uuid primary key,
  file_name text not null,
  uploaded_at timestamp not null default now(),
  total_rows integer not null default 0,
  status text not null default 'success',
  error_message text
);

create table if not exists tax_entries (
  id uuid primary key,
  perusahaan text,
  tahun text,
  masa_pajak text,
  jenis_pajak text,
  dpp numeric,
  pajak numeric,
  ntpn_ntpd text,
  tanggal_bayar date,
  status text,
  status_auto text,
  keterangan text,
  source_data text,
  source_sheet text,
  source_row integer,
  upload_batch_id uuid references upload_batches(id) on delete cascade,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

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

alter table upload_batches add column if not exists uploaded_by text;
alter table tax_entries add column if not exists source_row integer;

create index if not exists tax_entries_created_at_idx on tax_entries (created_at desc);
create index if not exists tax_entries_upload_batch_id_idx on tax_entries (upload_batch_id);
create index if not exists upload_batches_uploaded_at_idx on upload_batches (uploaded_at desc);

-- Legacy SQL schema retained for reference only; the dashboard now runs in static-file mode.
alter table upload_batches enable row level security;
alter table tax_entries enable row level security;

drop policy if exists "public read upload_batches" on upload_batches;
create policy "public read upload_batches" on upload_batches for select using (true);
drop policy if exists "public insert upload_batches" on upload_batches;
create policy "public insert upload_batches" on upload_batches for insert with check (true);
drop policy if exists "public update upload_batches" on upload_batches;
create policy "public update upload_batches" on upload_batches for update using (true) with check (true);
drop policy if exists "public delete upload_batches" on upload_batches;
create policy "public delete upload_batches" on upload_batches for delete using (true);

drop policy if exists "public read tax_entries" on tax_entries;
create policy "public read tax_entries" on tax_entries for select using (true);
drop policy if exists "public insert tax_entries" on tax_entries;
create policy "public insert tax_entries" on tax_entries for insert with check (true);
drop policy if exists "public update tax_entries" on tax_entries;
create policy "public update tax_entries" on tax_entries for update using (true) with check (true);
drop policy if exists "public delete tax_entries" on tax_entries;
create policy "public delete tax_entries" on tax_entries for delete using (true);

create table if not exists upload_batches (
  id uuid primary key,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  total_rows integer not null default 0,
  uploaded_by text,
  status text not null default 'success',
  error_message text
);

create table if not exists tax_entries (
  id uuid primary key,
  perusahaan text not null,
  tahun text not null,
  masa_pajak text not null,
  jenis_pajak text not null,
  dpp numeric not null default 0,
  pajak numeric not null default 0,
  ntpn_ntpd text,
  tanggal_bayar date,
  status text not null,
  status_auto text,
  keterangan text,
  source_data text not null check (source_data in ('Excel Import', 'Manual Input')),
  source_sheet text not null,
  upload_batch_id uuid references upload_batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tax_documents (
  id uuid primary key,
  perusahaan text not null,
  tahun text not null,
  masa_pajak text not null,
  jenis_pajak text not null,
  jenis_dokumen text,
  nomor_dokumen text,
  tanggal_dokumen date,
  link_dokumen text,
  file_url text,
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

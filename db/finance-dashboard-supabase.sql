create table if not exists public.finance_dashboard_state (
  id text primary key,
  finance_data jsonb not null default '{"accounts":[],"deviceStatus":[],"lastUpdated":null}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_dashboard_state enable row level security;

-- Server-side Vercel API uses the Supabase service role key, which bypasses RLS.
-- No public client policies are required for this table.

insert into public.finance_dashboard_state (id, finance_data, updated_at)
values ('finance-dashboard', '{"accounts":[],"deviceStatus":[],"lastUpdated":null}'::jsonb, now())
on conflict (id) do nothing;

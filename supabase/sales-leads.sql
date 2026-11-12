-- Leads inbox for brandastic.co /leads
-- Run once in the Supabase SQL editor.

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  source text,
  first_contact_date date,
  jira_key text,
  name text,
  company text,
  telephone text,
  email text,
  notes text,
  month text,
  quality text,
  close_amount numeric,
  referred_by text,
  deal_type text check (deal_type is null or deal_type in ('One-time', 'Monthly')),
  value_2026 numeric,
  import_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_leads enable row level security;

drop policy if exists "Team can view sales leads" on public.sales_leads;
create policy "Team can view sales leads" on public.sales_leads
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can insert sales leads" on public.sales_leads;
create policy "Team can insert sales leads" on public.sales_leads
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can update sales leads" on public.sales_leads;
create policy "Team can update sales leads" on public.sales_leads
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can delete sales leads" on public.sales_leads;
create policy "Team can delete sales leads" on public.sales_leads
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

alter table public.sales_leads add column if not exists deal_interest text;
alter table public.sales_leads add column if not exists pipeline_stage text;

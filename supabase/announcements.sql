-- Company Announcements: birthdays, start dates, and company holidays.
-- Run once in the Supabase SQL editor.
-- labor_rates is the source of truth. Do not use profiles.birthday, profiles.work_start_date, or upcoming_celebrations.

alter table public.labor_rates
  add column if not exists birthday date,
  add column if not exists start_date date,
  add column if not exists show_on_announcements boolean not null default true;

create table if not exists public.company_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date,
  notes text,
  updated_at timestamptz default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.company_holidays enable row level security;

drop policy if exists "Team can view company holidays" on public.company_holidays;
create policy "Team can view company holidays" on public.company_holidays
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can insert company holidays" on public.company_holidays;
create policy "Team can insert company holidays" on public.company_holidays
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can update company holidays" on public.company_holidays;
create policy "Team can update company holidays" on public.company_holidays
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can delete company holidays" on public.company_holidays;
create policy "Team can delete company holidays" on public.company_holidays
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

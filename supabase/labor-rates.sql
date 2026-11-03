-- Hourly cost rates for Profitability and Team.
-- Run once in the Supabase SQL editor.
-- Overhead and Brand Care clients stay on their sheets.

create table if not exists public.labor_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hourly numeric(10, 2) not null check (hourly > 0),
  position integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.labor_rates enable row level security;

drop policy if exists "Team can view labor rates" on public.labor_rates;
create policy "Team can view labor rates" on public.labor_rates
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can insert labor rates" on public.labor_rates;
create policy "Team can insert labor rates" on public.labor_rates
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can update labor rates" on public.labor_rates;
create policy "Team can update labor rates" on public.labor_rates
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can delete labor rates" on public.labor_rates;
create policy "Team can delete labor rates" on public.labor_rates
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

insert into public.labor_rates (name, hourly, position) values
  ('Aimee McAfee', 40.64, 0),
  ('Carlos Cerda', 100.00, 1),
  ('Chloe Uyehara', 30.96, 2),
  ('CJ Williams', 50.00, 3),
  ('Clara', 25.00, 4),
  ('Cory', 75.00, 5),
  ('Jonathan', 25.00, 6),
  ('Justin Nassie', 83.90, 7),
  ('Maxwell Gilbert', 42.12, 8),
  ('Megan Hahn', 85.00, 9),
  ('Quentin Dietz', 100.00, 10),
  ('Samantha O''Leary', 57.46, 11),
  ('Sandy Ortiz', 63.70, 12),
  ('Stacy Williams', 45.19, 13),
  ('Melissa', 140.00, 14),
  ('Unassigned', 50.00, 15)
on conflict (name) do nothing;

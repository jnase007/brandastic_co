alter table public.sales_leads add column if not exists pipeline_stage text;
alter table public.sales_leads add column if not exists deal_interest text;

create table if not exists public.scorecard_channel_spend (
  channel text primary key,
  amount numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.scorecard_channel_spend enable row level security;

drop policy if exists "Team can view scorecard spend" on public.scorecard_channel_spend;
create policy "Team can view scorecard spend" on public.scorecard_channel_spend
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin')));

drop policy if exists "Team can write scorecard spend" on public.scorecard_channel_spend;
create policy "Team can write scorecard spend" on public.scorecard_channel_spend
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin')));

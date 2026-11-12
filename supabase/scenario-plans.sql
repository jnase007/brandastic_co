create table if not exists scenario_plans (
  id integer primary key default 1,
  raise_from text,
  raises jsonb default '{}'::jsonb,
  extra_client numeric default 0,
  client_ends jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  constraint scenario_plans_one_row check (id = 1)
);

alter table scenario_plans enable row level security;

drop policy if exists "Authenticated users can read scenario plans" on scenario_plans;
create policy "Authenticated users can read scenario plans"
  on scenario_plans for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can write scenario plans" on scenario_plans;
create policy "Authenticated users can write scenario plans"
  on scenario_plans for all
  to authenticated
  using (true)
  with check (true);

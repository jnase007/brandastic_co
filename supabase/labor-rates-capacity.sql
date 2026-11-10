-- Type, weekly capacity, and role for the Team page.
-- Run once in the Supabase SQL editor. Hourly costs and monthly overhead stay as they are.

alter table public.labor_rates
  add column if not exists worker_type text not null default 'employee';

alter table public.labor_rates
  add column if not exists weekly_capacity numeric(6, 2);

alter table public.labor_rates
  add column if not exists role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'labor_rates_worker_type_check'
  ) then
    alter table public.labor_rates
      add constraint labor_rates_worker_type_check
      check (worker_type in ('employee', 'contractor'));
  end if;
end $$;

update public.labor_rates
set weekly_capacity = 40
where worker_type = 'employee' and weekly_capacity is null;

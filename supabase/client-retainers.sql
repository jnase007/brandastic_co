create table if not exists public.client_retainers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly numeric not null default 0,
  position integer,
  updated_at timestamptz default now()
);

alter table public.client_retainers enable row level security;

drop policy if exists "client_retainers_read" on public.client_retainers;
create policy "client_retainers_read" on public.client_retainers for select to authenticated using (true);

drop policy if exists "client_retainers_write" on public.client_retainers;
create policy "client_retainers_write" on public.client_retainers for all to authenticated using (true) with check (true);

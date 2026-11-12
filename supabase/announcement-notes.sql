-- Announcement notes for /announcements.
-- Run once in the Supabase SQL editor.
-- A note with no dates stays in "Announce this week" until it is deleted.
-- A note with dates drops off after its end date (or its start date, when there is no end date).

create table if not exists public.announcement_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or (start_date is not null and end_date >= start_date))
);

alter table public.announcement_notes enable row level security;

drop policy if exists "Team can view announcement notes" on public.announcement_notes;
create policy "Team can view announcement notes" on public.announcement_notes
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can insert announcement notes" on public.announcement_notes;
create policy "Team can insert announcement notes" on public.announcement_notes
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can update announcement notes" on public.announcement_notes;
create policy "Team can update announcement notes" on public.announcement_notes
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

drop policy if exists "Team can delete announcement notes" on public.announcement_notes;
create policy "Team can delete announcement notes" on public.announcement_notes
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('team', 'admin'))
  );

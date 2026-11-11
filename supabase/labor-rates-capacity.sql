-- Type, weekly capacity, and role for the Team page.
-- Safe to run more than once.
-- Copies type, weekly hours, role, birthday, start date, and announce out of the __tp__: notes,
-- then deletes those notes. Hourly costs stay as they are.

alter table public.labor_rates
  add column if not exists worker_type text not null default 'employee';

alter table public.labor_rates
  add column if not exists weekly_capacity numeric(6, 2);

alter table public.labor_rates
  add column if not exists role text;

alter table public.labor_rates drop constraint if exists labor_rates_worker_type_check;
alter table public.labor_rates
  add constraint labor_rates_worker_type_check
  check (worker_type in ('employee', 'contractor'));

create or replace function public.labor_rates_url_decode(input text)
returns text
language plpgsql
immutable
as $$
declare
  i int := 1;
  len int := char_length(input);
  bytes bytea := ''::bytea;
  hex text;
  ch text;
begin
  if input is null then
    return null;
  end if;
  while i <= len loop
    ch := substring(input from i for 1);
    if ch = '%' and i + 2 <= len then
      hex := substring(input from i + 1 for 2);
      bytes := bytes || decode(hex, 'hex');
      i := i + 3;
    elsif ch = '+' then
      bytes := bytes || convert_to(' ', 'utf8');
      i := i + 1;
    else
      bytes := bytes || convert_to(ch, 'utf8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(bytes, 'utf8');
end;
$$;

with notes as (
  select (public.labor_rates_url_decode(substring(name from 8)))::jsonb as data
  from public.labor_rates
  where left(name, 7) = '__tp__:'
)
update public.labor_rates as person
set
  worker_type = case when notes.data->>'workerType' = 'contractor' then 'contractor' else 'employee' end,
  weekly_capacity = case
    when notes.data->>'workerType' = 'contractor' then null
    when nullif(notes.data->>'weeklyCapacity', '') is null then person.weekly_capacity
    else (notes.data->>'weeklyCapacity')::numeric
  end,
  role = nullif(notes.data->>'role', ''),
  birthday = coalesce(person.birthday, nullif(notes.data->>'birthday', '')::date),
  start_date = coalesce(person.start_date, nullif(notes.data->>'startDate', '')::date),
  show_on_announcements = case
    when notes.data ? 'showOnAnnouncements' then (notes.data->>'showOnAnnouncements')::boolean
    else person.show_on_announcements
  end
from notes
where left(person.name, 7) <> '__tp__:'
  and person.name = notes.data->>'name';

delete from public.labor_rates
where left(name, 7) = '__tp__:';

update public.labor_rates
set weekly_capacity = 40
where worker_type = 'employee' and weekly_capacity is null;

drop function if exists public.labor_rates_url_decode(text);

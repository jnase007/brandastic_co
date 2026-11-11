-- Recurring company holidays. Safe to run more than once.
-- One-time closures keep start_date. Yearly holidays use repeat_rule instead of a new row each year.

alter table public.company_holidays
  add column if not exists repeat_rule text not null default 'none',
  add column if not exists month int,
  add column if not exists day int,
  add column if not exists weekday int,
  add column if not exists nth int,
  add column if not exists length_days int not null default 1;

alter table public.company_holidays
  alter column start_date drop not null;

alter table public.company_holidays drop constraint if exists company_holidays_repeat_rule_check;
alter table public.company_holidays
  add constraint company_holidays_repeat_rule_check
  check (repeat_rule in ('none', 'fixed', 'nth_weekday', 'last_weekday'));

alter table public.company_holidays drop constraint if exists company_holidays_month_check;
alter table public.company_holidays
  add constraint company_holidays_month_check
  check (month is null or month between 1 and 12);

alter table public.company_holidays drop constraint if exists company_holidays_day_check;
alter table public.company_holidays
  add constraint company_holidays_day_check
  check (day is null or day between 1 and 31);

alter table public.company_holidays drop constraint if exists company_holidays_weekday_check;
alter table public.company_holidays
  add constraint company_holidays_weekday_check
  check (weekday is null or weekday between 0 and 6);

alter table public.company_holidays drop constraint if exists company_holidays_nth_check;
alter table public.company_holidays
  add constraint company_holidays_nth_check
  check (nth is null or nth between 1 and 4);

alter table public.company_holidays drop constraint if exists company_holidays_length_check;
alter table public.company_holidays
  add constraint company_holidays_length_check
  check (length_days >= 1);

alter table public.company_holidays drop constraint if exists company_holidays_rule_fields_check;
alter table public.company_holidays
  add constraint company_holidays_rule_fields_check
  check (
    (repeat_rule = 'none' and start_date is not null)
    or (repeat_rule = 'fixed' and month between 1 and 12 and day between 1 and 31)
    or (repeat_rule = 'nth_weekday' and month between 1 and 12 and weekday between 0 and 6 and nth between 1 and 4)
    or (repeat_rule = 'last_weekday' and month between 1 and 12 and weekday between 0 and 6)
  );

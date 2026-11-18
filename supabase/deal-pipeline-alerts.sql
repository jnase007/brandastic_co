-- Additive columns for /deals lost reasons and the Deal Won checklist.
-- Run once in the Supabase SQL editor. Existing rows stay untouched.

alter table public.sales_leads add column if not exists lost_reason text;
alter table public.sales_leads add column if not exists lost_note text;
alter table public.sales_leads add column if not exists follow_up_recommendation text;
alter table public.sales_leads add column if not exists won_checklist jsonb;

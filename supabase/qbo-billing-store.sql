-- Private QuickBooks store for on-demand receivables refresh.
-- Additive only: new tables, no changes to existing tables or rows.
--
-- The browser roles cannot read these tables. RLS is on, no policies are
-- granted, and anon/authenticated grants are revoked. The server uses
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. Tokens and snapshots are
-- encrypted by the server before they are written.

create table if not exists public.qbo_billing_store (
  slot text primary key check (slot in ('production', 'sandbox')),
  token_ciphertext text,
  snapshot_ciphertext text,
  refreshed_at timestamptz,
  connected_at timestamptz,
  status text not null default 'disconnected' check (status in ('connected', 'expired', 'disconnected', 'unavailable')),
  updated_at timestamptz not null default now()
);

create table if not exists public.qbo_oauth_state (
  state text primary key,
  slot text not null check (slot in ('production', 'sandbox')),
  email_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.qbo_billing_store enable row level security;
alter table public.qbo_billing_store force row level security;
alter table public.qbo_oauth_state enable row level security;
alter table public.qbo_oauth_state force row level security;

revoke all on table public.qbo_billing_store from public, anon, authenticated;
revoke all on table public.qbo_oauth_state from public, anon, authenticated;

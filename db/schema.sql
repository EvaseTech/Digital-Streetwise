-- Run this once in the Supabase dashboard's SQL Editor before using the
-- login / purchase-lookup features.

create table if not exists purchases (
  email text primary key,
  stripe_customer_id text,
  session_id text,
  paid_at timestamptz default now()
);

alter table purchases enable row level security;

-- A logged-in user (verified via magic link) can see only their own row —
-- this is what the frontend uses right after a successful login to decide
-- whether to unlock the game.
create policy "select own purchase"
  on purchases for select
  using (email = auth.jwt() ->> 'email');

-- No INSERT/UPDATE/DELETE policies are defined, so only the service_role
-- key (used server-side in api/webhook.js, which bypasses RLS) can write
-- to this table. That's intentional — nothing client-side should ever be
-- able to mark itself as "purchased".

-- Lets the login form check "has this email purchased" BEFORE the user is
-- logged in, so the magic-link email only gets sent to addresses that
-- actually paid — without exposing the purchases table itself to anonymous
-- requests. security definer runs this with elevated privileges internally,
-- but it only ever returns true/false, never any row data.
create or replace function public.email_has_purchased(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from purchases where email = lower(check_email)
  );
$$;

grant execute on function public.email_has_purchased(text) to anon, authenticated;

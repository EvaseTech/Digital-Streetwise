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

-- ===========================================================================
-- Cross-device progress sync — lets a customer's scores, boss-level plan,
-- and level completion carry over when they log back in on a different
-- device. Keyed by the Supabase Auth user id (not email), since that's what
-- RLS can check directly via auth.uid() for both reads and writes.
create table if not exists game_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  results jsonb not null default '{}'::jsonb,
  boss_name text default '',
  boss_done boolean default false,
  pledges jsonb default '[true,true,true,true]'::jsonb,
  updated_at timestamptz default now()
);

alter table game_progress enable row level security;

-- A logged-in user can only ever read or write their own progress row —
-- never anyone else's. No service_role / server-side writes needed here;
-- this is written directly from the browser once the user is signed in.
create policy "select own progress"
  on game_progress for select
  using (auth.uid() = user_id);

create policy "insert own progress"
  on game_progress for insert
  with check (auth.uid() = user_id);

create policy "update own progress"
  on game_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

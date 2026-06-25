-- ============================================================
-- PREMIUM: profiles columns + financial_plans table
-- ============================================================

alter table profiles
  add column if not exists is_premium boolean not null default false,
  add column if not exists stripe_customer_id text;

-- ============================================================
-- FINANCIAL PLANS
-- ============================================================

create type plan_status as enum ('generating', 'ready', 'failed');

create table financial_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  title text not null,
  summary text not null,
  health_score integer not null check (health_score between 0 and 100),
  content jsonb not null,
  status plan_status not null default 'ready',
  created_at timestamptz not null default now()
);

alter table financial_plans enable row level security;
create policy "Users manage own plans" on financial_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_plans_user_created on financial_plans (user_id, created_at desc);

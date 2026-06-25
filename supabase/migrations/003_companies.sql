-- ============================================================
-- MULTI-COMPANY SUPPORT
-- ============================================================

create table companies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  business_name text,
  business_type business_type,
  industry text,
  employee_count integer not null default 0,
  is_salary_payer boolean not null default false,
  tyel_registered boolean not null default false,
  yel_registered boolean not null default false,
  vat_registered boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table companies enable row level security;
create policy "Users manage own companies" on companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Track which company is currently active for each user
alter table profiles add column if not exists active_company_id uuid references companies;

-- Add company_id to all business data tables
alter table financial_snapshots     add column if not exists company_id uuid references companies on delete cascade;
alter table expense_logs            add column if not exists company_id uuid references companies on delete cascade;
alter table compliance_obligations  add column if not exists company_id uuid references companies on delete cascade;
alter table financial_plans         add column if not exists company_id uuid references companies on delete cascade;
alter table reports                 add column if not exists company_id uuid references companies on delete cascade;
alter table ai_conversations        add column if not exists company_id uuid references companies on delete cascade;
alter table checklist_progress      add column if not exists company_id uuid references companies on delete cascade;

-- Migrate existing profile data into a default company per user
insert into companies (user_id, business_name, business_type, industry, employee_count, is_salary_payer, tyel_registered, yel_registered, vat_registered, onboarding_completed)
select id, business_name, business_type, industry, coalesce(employee_count, 0), is_salary_payer, tyel_registered, yel_registered, vat_registered, onboarding_completed
from profiles;

-- Set active_company_id to the newly created company
update profiles p set active_company_id = (
  select id from companies c where c.user_id = p.id order by c.created_at limit 1
);

-- Backfill company_id on existing data using each user's active company
update financial_snapshots    set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;
update expense_logs           set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;
update compliance_obligations set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;
update financial_plans        set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;
update reports                set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;
update ai_conversations       set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;
update checklist_progress     set company_id = (select active_company_id from profiles where id = user_id) where company_id is null;

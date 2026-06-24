-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type business_type as enum ('sole_trader', 'oy', 'ky', 'toiminimi');
create type expense_category as enum ('vehicle', 'equipment', 'travel', 'software', 'personnel', 'other');
create type checklist_module as enum ('balance_sheet', 'pnl', 'debt', 'bookkeeping', 'compliance');
create type compliance_obligation_type as enum ('tyel', 'yel', 'vat_filing', 'tax_prepayment', 'salary_payer_reg', 'annual_accounts');
create type obligation_status as enum ('upcoming', 'due_soon', 'overdue', 'completed');
create type checklist_status as enum ('pending', 'in_progress', 'completed', 'skipped');
create type report_type as enum ('balance_sheet', 'pnl', 'cash_flow', 'custom');
create type ai_role as enum ('user', 'assistant');
create type consultation_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type intake_session_status as enum ('in_progress', 'completed');
create type report_generated_by as enum ('system', 'ai_bot', 'user');

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  business_name text,
  business_type business_type,
  industry text,
  founding_date date,
  employee_count integer default 0,
  is_salary_payer boolean not null default false,
  tyel_registered boolean not null default false,
  yel_registered boolean not null default false,
  vat_registered boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- INTAKE
-- ============================================================

create table intake_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  status intake_session_status not null default 'in_progress',
  current_step integer not null default 0,
  completed_at timestamptz
);

alter table intake_sessions enable row level security;
create policy "Users manage own intake sessions" on intake_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table intake_responses (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references intake_sessions on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  question_key text not null,
  response_value jsonb not null,
  answered_at timestamptz not null default now()
);

alter table intake_responses enable row level security;
create policy "Users manage own intake responses" on intake_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- FINANCIAL SNAPSHOTS
-- ============================================================

create table financial_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  snapshot_date date not null default current_date,
  bank_balance numeric(15,2) not null default 0,
  monthly_revenue numeric(15,2) not null default 0,
  monthly_costs numeric(15,2) not null default 0,
  accounts_receivable numeric(15,2) not null default 0,
  accounts_payable numeric(15,2) not null default 0,
  cash_runway_months numeric(5,2) not null default 0,
  net_profit_margin numeric(5,2) not null default 0,
  raw_data jsonb not null default '{}'
);

alter table financial_snapshots enable row level security;
create policy "Users manage own snapshots" on financial_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_snapshots_user_date on financial_snapshots (user_id, snapshot_date desc);

-- ============================================================
-- EXPENSE TEMPLATES
-- ============================================================

create table expense_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles on delete cascade,
  name text not null,
  category expense_category not null default 'other',
  default_amount numeric(15,2),
  vat_rate numeric(4,1) not null default 25.5,
  description_template text,
  is_system boolean not null default false
);

alter table expense_templates enable row level security;
create policy "Users read system templates and own templates" on expense_templates
  for select using (is_system = true or auth.uid() = user_id);
create policy "Users manage own templates" on expense_templates
  for insert with check (auth.uid() = user_id);
create policy "Users update own templates" on expense_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own templates" on expense_templates
  for delete using (auth.uid() = user_id);

-- ============================================================
-- EXPENSE LOGS
-- ============================================================

create table expense_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  template_id uuid references expense_templates,
  amount numeric(15,2) not null,
  vat_amount numeric(15,2) not null default 0,
  category expense_category not null default 'other',
  description text not null,
  date date not null default current_date,
  receipt_url text,
  created_at timestamptz not null default now()
);

alter table expense_logs enable row level security;
create policy "Users manage own expenses" on expense_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_expenses_user_date on expense_logs (user_id, date desc);
create index idx_expenses_user_category on expense_logs (user_id, category);

-- ============================================================
-- CHECKLISTS
-- ============================================================

create table checklist_definitions (
  id uuid primary key default uuid_generate_v4(),
  module checklist_module not null,
  title text not null,
  description text not null default '',
  applicable_business_types business_type[] not null default '{}',
  requires_salary_payer boolean not null default false,
  sort_order integer not null default 0
);

create table checklist_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  checklist_id uuid not null references checklist_definitions on delete cascade,
  status checklist_status not null default 'pending',
  notes text,
  completed_at timestamptz,
  unique (user_id, checklist_id)
);

alter table checklist_definitions enable row level security;
create policy "Anyone can read checklist definitions" on checklist_definitions
  for select using (true);

alter table checklist_progress enable row level security;
create policy "Users manage own checklist progress" on checklist_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- COMPLIANCE OBLIGATIONS
-- ============================================================

create table compliance_obligations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  obligation_type compliance_obligation_type not null,
  due_date date not null,
  status obligation_status not null default 'upcoming',
  notified_at timestamptz,
  notes text
);

alter table compliance_obligations enable row level security;
create policy "Users manage own obligations" on compliance_obligations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_obligations_user_due on compliance_obligations (user_id, due_date asc);

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================

create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

alter table ai_conversations enable row level security;
create policy "Users manage own conversations" on ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table ai_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references ai_conversations on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  role ai_role not null,
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

alter table ai_messages enable row level security;
create policy "Users manage own messages" on ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_messages_conversation on ai_messages (conversation_id, created_at asc);

-- ============================================================
-- REPORTS
-- ============================================================

create table reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  report_type report_type not null,
  period_start date not null,
  period_end date not null,
  file_url text,
  generated_by report_generated_by not null default 'system',
  created_at timestamptz not null default now()
);

alter table reports enable row level security;
create policy "Users manage own reports" on reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- CONSULTATION REQUESTS
-- ============================================================

create table consultation_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  topic text not null,
  preferred_date timestamptz,
  status consultation_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

alter table consultation_requests enable row level security;
create policy "Users manage own consultation requests" on consultation_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

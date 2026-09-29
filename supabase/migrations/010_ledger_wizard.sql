-- ============================================================
-- "GET MY TASE READY" WIZARD: setup responses + follow-up tasks
-- ============================================================

create type setup_response_status as enum ('unanswered', 'answered', 'unknown');
create type follow_up_task_status as enum ('open', 'resolved');

alter table companies
  add column if not exists fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  add column if not exists vat_period text check (vat_period in ('monthly', 'quarterly', 'annually'));

create table setup_responses (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null references companies on delete cascade,
  question_key text not null,
  group_key text not null,
  answer_value jsonb,
  status setup_response_status not null default 'unanswered',
  answered_at timestamptz,
  unique (company_id, question_key)
);

alter table setup_responses enable row level security;
create policy "Users manage own company setup responses" on setup_responses
  for all using (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  );

create index idx_setup_responses_company on setup_responses (company_id, group_key);

create table follow_up_tasks (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null references companies on delete cascade,
  source text not null,
  source_id uuid,
  title text not null,
  link_href text,
  status follow_up_task_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table follow_up_tasks enable row level security;
create policy "Users manage own company follow-up tasks" on follow_up_tasks
  for all using (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  );

create index idx_follow_up_tasks_company on follow_up_tasks (company_id, status);

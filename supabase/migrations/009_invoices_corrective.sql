-- ============================================================
-- INVOICES — corrective migration
-- ============================================================
-- The `invoices` table has been live in production since the invoices
-- feature shipped, but no migration for it was ever committed (schema
-- drift). This migration is written to be a no-op against the existing
-- live table: `create table if not exists` will simply skip if it's
-- already there, and every column addition is `if not exists`. Nothing
-- here alters or drops an existing column, so it is safe to run against
-- production regardless of the live table's exact current shape.

create table if not exists invoices (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references profiles on delete cascade,
  company_id uuid references companies on delete cascade,
  type text not null check (type in ('sent', 'received')),
  invoice_number text,
  counterparty text not null,
  description text,
  amount numeric(15,2) not null default 0,
  vat_amount numeric(15,2) not null default 0,
  issue_date date not null,
  due_date date,
  paid_date date,
  status text not null default 'unpaid' check (status in ('paid', 'unpaid')),
  file_url text,
  created_at timestamptz not null default now()
);

alter table invoices add column if not exists user_id uuid references profiles on delete cascade;
alter table invoices add column if not exists company_id uuid references companies on delete cascade;
alter table invoices add column if not exists type text;
alter table invoices add column if not exists invoice_number text;
alter table invoices add column if not exists counterparty text;
alter table invoices add column if not exists description text;
alter table invoices add column if not exists amount numeric(15,2) default 0;
alter table invoices add column if not exists vat_amount numeric(15,2) default 0;
alter table invoices add column if not exists issue_date date;
alter table invoices add column if not exists due_date date;
alter table invoices add column if not exists paid_date date;
alter table invoices add column if not exists status text default 'unpaid';
alter table invoices add column if not exists file_url text;
alter table invoices add column if not exists created_at timestamptz not null default now();

alter table invoices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'invoices' and policyname = 'Users manage own invoices') then
    create policy "Users manage own invoices" on invoices
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end;
$$;

create index if not exists idx_invoices_user on invoices (user_id, issue_date desc);
create index if not exists idx_invoices_company on invoices (company_id, issue_date desc);

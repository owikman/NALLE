-- ============================================================
-- LEDGER CORE: chart of accounts, journal entries, journal lines
-- ============================================================
--
-- Immutability convention: rows in journal_entries/journal_lines are
-- INSERT-only once created (enforced by trigger below). A correction is
-- never an UPDATE — it is a new entry with source_type = 'reversal' whose
-- lines exactly mirror the original entry's debit/credit, so summing all
-- lines nets the reversed entry to zero automatically. journal_entries.status
-- is reserved for this relationship but is never mutated after insert;
-- 'reversed' is set only on entries inserted specifically to record that a
-- prior entry no longer holds (via reverses_entry_id), not by editing the
-- original row.

create type ledger_account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type journal_source_type as enum ('invoice', 'expense', 'manual', 'opening_balance', 'reversal');
create type journal_entry_status as enum ('posted', 'reversed');

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================

create table chart_of_accounts (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null references companies on delete cascade,
  code text not null,
  name text not null,
  type ledger_account_type not null,
  subtype text,
  is_system boolean not null default true,
  expense_category expense_category,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

alter table chart_of_accounts enable row level security;
create policy "Users manage own company accounts" on chart_of_accounts
  for all using (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  );

create index idx_coa_company on chart_of_accounts (company_id, sort_order);

-- ============================================================
-- JOURNAL ENTRIES
-- ============================================================

create table journal_entries (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null references companies on delete cascade,
  entry_date date not null,
  description text not null,
  source_type journal_source_type not null,
  source_id uuid,
  status journal_entry_status not null default 'posted',
  reverses_entry_id uuid references journal_entries (id),
  created_by uuid not null references profiles on delete restrict,
  created_at timestamptz not null default now()
);

alter table journal_entries enable row level security;
create policy "Users manage own company journal entries" on journal_entries
  for all using (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  );

create index idx_journal_entries_company_date on journal_entries (company_id, entry_date);
create index idx_journal_entries_source on journal_entries (source_type, source_id);

-- ============================================================
-- JOURNAL LINES
-- ============================================================

create table journal_lines (
  id uuid primary key default extensions.uuid_generate_v4(),
  entry_id uuid not null references journal_entries on delete cascade,
  account_id uuid not null references chart_of_accounts on delete restrict,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

alter table journal_lines enable row level security;
create policy "Users manage own company journal lines" on journal_lines
  for all using (
    exists (
      select 1 from journal_entries je
      join companies c on c.id = je.company_id
      where je.id = entry_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from journal_entries je
      join companies c on c.id = je.company_id
      where je.id = entry_id and c.user_id = auth.uid()
    )
  );

create index idx_journal_lines_entry on journal_lines (entry_id);
create index idx_journal_lines_account on journal_lines (account_id);

-- ============================================================
-- IMMUTABILITY TRIGGERS (defense in depth — the app never issues
-- UPDATE/DELETE against these tables either; this blocks it at the DB
-- layer too, matching this codebase's existing RLS-as-defense-in-depth
-- convention rather than being the only enforcement).
-- ============================================================

create or replace function reject_journal_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'journal_entries and journal_lines are append-only; insert a reversal instead of updating or deleting row %', old.id;
end;
$$;

create trigger no_update_journal_entries
  before update or delete on journal_entries
  for each row execute function reject_journal_mutation();

create trigger no_update_journal_lines
  before update or delete on journal_lines
  for each row execute function reject_journal_mutation();

-- ============================================================
-- DEFAULT CHART OF ACCOUNTS SEEDING
-- ============================================================

create or replace function seed_default_chart_of_accounts(p_company_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_of_accounts (company_id, code, name, type, subtype, sort_order) values
    (p_company_id, '1910', 'Pankkitili (Bank)', 'asset', 'current_asset', 10),
    (p_company_id, '1700', 'Myyntisaamiset (Accounts receivable)', 'asset', 'current_asset', 20),
    (p_company_id, '1763', 'Arvonlisäverosaaminen (VAT receivable)', 'asset', 'current_asset', 30),
    (p_company_id, '1100', 'Käyttöomaisuus (Fixed assets)', 'asset', 'fixed_asset', 40),
    (p_company_id, '2870', 'Ostovelat (Accounts payable)', 'liability', 'current_liability', 50),
    (p_company_id, '2939', 'Arvonlisäverovelka (VAT payable)', 'liability', 'current_liability', 60),
    (p_company_id, '2620', 'Lainat (Loans payable)', 'liability', 'current_liability', 70),
    (p_company_id, '2650', 'Osakaslaina (Owner current account)', 'liability', 'current_liability', 80),
    (p_company_id, '2001', 'Osakepääoma (Share capital)', 'equity', 'equity', 90),
    (p_company_id, '2061', 'Edellisten tilikausien voitto (Retained earnings)', 'equity', 'equity', 100),
    (p_company_id, '3000', 'Myynti (Revenue)', 'revenue', 'operating_revenue', 110),
    (p_company_id, '4000', 'Palkat (Salary expense)', 'expense', 'operating_expense', 120)
  on conflict (company_id, code) do nothing;

  insert into chart_of_accounts (company_id, code, name, type, subtype, expense_category, sort_order)
  select p_company_id, code, name, 'expense', 'operating_expense', category::expense_category, sort_order
  from (values
    ('4100', 'Ajoneuvokulut (Vehicle)', 'vehicle', 130),
    ('4200', 'Kalusto (Equipment)', 'equipment', 140),
    ('4300', 'Matkakulut (Travel)', 'travel', 150),
    ('4400', 'Ohjelmistot (Software)', 'software', 160),
    ('4500', 'Henkilöstökulut (Personnel)', 'personnel', 170),
    ('4900', 'Muut kulut (Other)', 'other', 180)
  ) as t(code, name, category, sort_order)
  on conflict (company_id, code) do nothing;
end;
$$;

-- Backfill: seed the default chart of accounts for every company that
-- already exists, so this migration is safe to run against production data.
do $$
declare
  co record;
begin
  for co in select id from companies loop
    perform seed_default_chart_of_accounts(co.id);
  end loop;
end;
$$;

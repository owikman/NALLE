-- ============================================================
-- EXPENSE PAID STATUS
-- ============================================================
-- Distinguishes "the company paid this from its own bank" (the only case
-- expense_logs could represent before) from "the owner paid personally and
-- is owed reimbursement" — needed so the ledger posts the right side
-- (Bank vs. Owner Current Account) and so a claim can be tracked to actual
-- payment. Default keeps every historical row's implied meaning unchanged.

create type expense_paid_status as enum ('paid_by_company', 'pending_reimbursement', 'reimbursed');

alter table expense_logs
  add column if not exists paid_status expense_paid_status not null default 'paid_by_company',
  add column if not exists reimbursed_date date;

-- Mileage claims are definitionally an owner-paid expense (use of a
-- personal vehicle), so existing mileage rows are corrected to reflect
-- that instead of the "paid_by_company" default.
update expense_logs
set paid_status = 'pending_reimbursement'
where mileage_km is not null and paid_status = 'paid_by_company';

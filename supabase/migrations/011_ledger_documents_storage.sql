-- ============================================================
-- EVIDENCE DOCUMENTS: generalized upload/extract/confirm, beyond
-- invoices and receipts (loan statements, VAT returns, payroll reports,
-- opening-balance bank statements, etc.)
-- ============================================================

create type document_type as enum (
  'opening_balance_statement', 'loan_statement', 'vat_return', 'payroll_report', 'travel_claim', 'other'
);
create type document_status as enum ('pending_review', 'confirmed', 'duplicate_flagged');

create table documents (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null references companies on delete cascade,
  document_type document_type not null,
  storage_path text not null,
  file_hash text not null,
  extracted_data jsonb,
  confirmed_data jsonb,
  confirmed_by uuid references profiles on delete set null,
  confirmed_at timestamptz,
  status document_status not null default 'pending_review',
  duplicate_of_id uuid references documents (id),
  created_at timestamptz not null default now()
);

alter table documents enable row level security;
create policy "Users manage own company documents" on documents
  for all using (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid())
  );

create index idx_documents_company on documents (company_id, document_type);
create index idx_documents_hash on documents (company_id, file_hash);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict do nothing;

create policy "Users upload own company documents" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own company documents" on storage.objects
  for select using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

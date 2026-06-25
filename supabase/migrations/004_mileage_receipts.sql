-- Mileage fields on expense_logs
alter table expense_logs add column if not exists mileage_km   numeric(8,1);
alter table expense_logs add column if not exists mileage_from text;
alter table expense_logs add column if not exists mileage_to   text;

-- Storage bucket for receipts
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict do nothing;

create policy "Users upload own receipts" on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own receipts" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

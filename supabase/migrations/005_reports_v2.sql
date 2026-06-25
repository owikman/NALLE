-- Add structured content and title to reports so they can be viewed in-app
alter table reports add column if not exists title      text;
alter table reports add column if not exists content    jsonb;
alter table reports add column if not exists company_id uuid references companies on delete cascade;

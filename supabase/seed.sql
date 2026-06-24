-- System expense templates (available to all users)
insert into expense_templates (name, category, default_amount, vat_rate, description_template, is_system, user_id) values
  ('Vehicle — Business Trip', 'vehicle', null, 25.5, 'Business trip: from [origin] to [destination]', true, null),
  ('Vehicle — Fuel', 'vehicle', null, 25.5, 'Fuel purchase', true, null),
  ('Vehicle — Parking', 'vehicle', null, 25.5, 'Parking fee', true, null),
  ('Software Subscription', 'software', null, 25.5, '[Software name] subscription', true, null),
  ('Phone Bill', 'software', null, 25.5, 'Monthly phone bill', true, null),
  ('Office Supplies', 'equipment', null, 25.5, 'Office supplies', true, null),
  ('Travel — Flight', 'travel', null, 0, 'Flight: [route]', true, null),
  ('Travel — Hotel', 'travel', null, 14, 'Hotel: [location]', true, null),
  ('Meal — Client', 'travel', null, 14, 'Client meal at [location]', true, null),
  ('Contractor / Freelancer', 'personnel', null, 25.5, 'Payment to [name] for [service]', true, null);

-- Checklist definitions
insert into checklist_definitions (module, title, description, applicable_business_types, requires_salary_payer, sort_order) values
  -- Balance Sheet
  ('balance_sheet', 'List all business bank accounts', 'Record current balances for each account you use for business.', '{"sole_trader","oy","ky","toiminimi"}', false, 1),
  ('balance_sheet', 'Record accounts receivable', 'List all outstanding invoices you are waiting to be paid.', '{"sole_trader","oy","ky","toiminimi"}', false, 2),
  ('balance_sheet', 'Record accounts payable', 'List all invoices and bills you owe to others.', '{"sole_trader","oy","ky","toiminimi"}', false, 3),
  ('balance_sheet', 'List business assets', 'Document equipment, vehicles, and other business assets.', '{"sole_trader","oy","ky","toiminimi"}', false, 4),
  ('balance_sheet', 'List outstanding loans', 'Record all business loans with remaining balances and interest rates.', '{"sole_trader","oy","ky","toiminimi"}', false, 5),

  -- P&L
  ('pnl', 'Categorize all revenue sources', 'Separate income by product, service, or client type.', '{"sole_trader","oy","ky","toiminimi"}', false, 1),
  ('pnl', 'Reconcile all expense categories', 'Match expenses to bank statements for the period.', '{"sole_trader","oy","ky","toiminimi"}', false, 2),
  ('pnl', 'Calculate gross profit', 'Revenue minus direct cost of goods/services.', '{"sole_trader","oy","ky","toiminimi"}', false, 3),
  ('pnl', 'Review owner salary / withdrawals', 'Ensure your own compensation is recorded correctly.', '{"oy","ky"}', false, 4),

  -- Debt
  ('debt', 'List all loans with terms', 'Document lender, amount, interest rate, and monthly payment.', '{"sole_trader","oy","ky","toiminimi"}', false, 1),
  ('debt', 'Check for overdue payments', 'Identify any missed loan or invoice payments.', '{"sole_trader","oy","ky","toiminimi"}', false, 2),
  ('debt', 'Review credit card balances', 'Record any business credit card debt and due dates.', '{"sole_trader","oy","ky","toiminimi"}', false, 3),

  -- Bookkeeping
  ('bookkeeping', 'Reconcile bank statements', 'Match all transactions in your accounting software to bank statements.', '{"sole_trader","oy","ky","toiminimi"}', false, 1),
  ('bookkeeping', 'File all receipts', 'Upload or scan receipts for all business expenses.', '{"sole_trader","oy","ky","toiminimi"}', false, 2),
  ('bookkeeping', 'Invoice all completed work', 'Ensure no completed work is un-invoiced.', '{"sole_trader","oy","ky","toiminimi"}', false, 3),
  ('bookkeeping', 'Review VAT records', 'Verify all VAT-liable transactions are recorded correctly.', '{"sole_trader","oy","ky","toiminimi"}', false, 4),

  -- Compliance
  ('compliance', 'Register as salary payer (Vero)', 'Required before paying any employee salaries.', '{"sole_trader","oy","ky","toiminimi"}', true, 1),
  ('compliance', 'Register TyEL pension insurance', 'Mandatory for employers paying salaries over the threshold.', '{"sole_trader","oy","ky","toiminimi"}', true, 2),
  ('compliance', 'Register YEL entrepreneur insurance', 'Required for entrepreneurs earning above the YEL threshold.', '{"sole_trader","oy","ky","toiminimi"}', false, 3),
  ('compliance', 'Register for VAT (Vero)', 'Required when annual turnover exceeds €15,000.', '{"sole_trader","oy","ky","toiminimi"}', false, 4),
  ('compliance', 'File annual accounts (OY)', 'Annual accounts must be filed within 4 months of fiscal year end.', '{"oy"}', false, 5);

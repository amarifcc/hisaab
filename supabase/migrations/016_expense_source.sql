-- Expense source discriminator: 'supervisor' (default, existing behavior) or 'owner'.
-- Owner-direct expenses are stamped 'owner' so they can be isolated from the
-- supervisor workspace (which filters source='supervisor') and merged in the
-- combined report.

alter table public.expenses
  add column if not exists source text not null default 'supervisor'
  check (source in ('supervisor', 'owner'));

-- Existing rows backfill to 'supervisor' via the default; explicit for clarity.
update public.expenses set source = 'supervisor' where source is null;

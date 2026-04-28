-- ─── Migration 006: Extend person_type ───────────────────────────────────────
-- Adds 'employee' (hired staff) and 'supplier' (material vendors) types.

alter table public.people drop constraint people_person_type_check;
alter table public.people add constraint people_person_type_check
  check (person_type in ('owner', 'employee', 'contractor', 'supplier'));

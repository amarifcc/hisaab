-- ─── Migration 004: People type ──────────────────────────────────────────────
-- Adds person_type column to people table: 'owner' (fund providers) or
-- 'contractor' (workers, vendors). Defaults to 'contractor'.

alter table public.people
  add column person_type text not null default 'contractor'
  check (person_type in ('owner', 'contractor'));

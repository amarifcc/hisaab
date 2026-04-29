-- Migration 009: Add is_group flag to categories
-- Distinguishes parent groups from leaf categories without relying on having children
alter table public.categories
  add column is_group boolean not null default false;

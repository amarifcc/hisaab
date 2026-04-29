-- Migration 008: Add parent_id to categories for two-level hierarchy
-- Parent categories = groups (parent_id IS NULL, has children)
-- Sub-categories = leaves (parent_id IS NOT NULL)
-- Root categories with no children remain selectable as ungrouped leaves (backward compatible)
-- Deleting a parent sets children's parent_id to NULL (they become ungrouped)

alter table public.categories
  add column parent_id uuid references public.categories(id) on delete set null;

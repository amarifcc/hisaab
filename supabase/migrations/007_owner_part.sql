-- Link owners to their project part
alter table public.people
  add column part_id uuid references public.project_parts(id) on delete set null;

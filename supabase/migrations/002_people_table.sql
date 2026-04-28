-- ─── Migration 002: People table ─────────────────────────────────────────────
-- Contacts list for transfer from_person and expense paid_to fields

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.people enable row level security;

create policy "people_select" on public.people for select using (true);
create policy "people_insert" on public.people for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "people_update" on public.people for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "people_delete" on public.people for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

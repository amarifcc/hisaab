-- ─── Migration 005: Deals table ──────────────────────────────────────────────
-- Tracks agreed contracts with contractors.
-- Independent from expenses — person_name is the soft link to expenses.paid_to.

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  person_name text,
  part_id uuid not null references public.project_parts(id),
  agreed_amount numeric(12,2) not null check (agreed_amount > 0),
  date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;

create policy "deals_select" on public.deals for select using (true);
create policy "deals_insert" on public.deals for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "deals_update" on public.deals for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "deals_delete" on public.deals for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Extend activity_logs entity_type to include 'deal'
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in ('transfer', 'expense', 'category', 'project_part', 'deal'));

-- ─── Migration 011: Deal revisions ──────────────────────────────────────────
-- Additive only. Existing deals and expenses are preserved.
-- Existing deal agreed_amount values are copied into revision #1 for each deal.

create table public.deal_revisions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  revision_number int not null check (revision_number > 0),
  scope_description text not null,
  amount_delta numeric(12,2) not null check (amount_delta <> 0),
  date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, revision_number)
);

alter table public.deal_revisions enable row level security;

create policy "deal_revisions_select" on public.deal_revisions for select using (true);
create policy "deal_revisions_insert" on public.deal_revisions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "deal_revisions_update" on public.deal_revisions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "deal_revisions_delete" on public.deal_revisions for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

insert into public.deal_revisions (
  deal_id,
  revision_number,
  scope_description,
  amount_delta,
  date,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  d.id,
  1,
  d.name,
  d.agreed_amount,
  d.date,
  d.notes,
  d.created_by,
  d.created_at,
  d.updated_at
from public.deals d
where not exists (
  select 1 from public.deal_revisions r where r.deal_id = d.id
);

alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in ('transfer', 'expense', 'category', 'project_part', 'deal', 'deal_revision'));

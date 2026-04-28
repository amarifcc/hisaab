-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Project Parts (GF, UF, or custom) ───────────────────────────────────────
-- Supervisor defines these. Not linked 1:1 to users.
create table public.project_parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,          -- e.g. "Ground Floor"
  short_name text not null,    -- e.g. "GF"
  color text not null default '#6366f1',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─── People (contacts for transfers / expenses) ───────────────────────────────
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null check (role in ('supervisor', 'viewer')),
  created_at timestamptz not null default now()
);

-- Auto-create a viewer profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'viewer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Categories ───────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);
insert into public.categories (name, color) values
  ('Labor',        '#f59e0b'),
  ('Material',     '#3b82f6'),
  ('Transport',    '#10b981'),
  ('Tools',        '#8b5cf6'),
  ('Miscellaneous','#6b7280');

-- ─── Transfers (funds received by supervisor from a project part) ──────────────
-- from_person is optional free text (which resident/person within that part paid)
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.project_parts(id),
  from_person text,            -- optional: name of person who handed over funds
  amount numeric(12,2) not null check (amount > 0),
  date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Expenses ─────────────────────────────────────────────────────────────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  paid_to text,
  category_id uuid references public.categories(id),
  date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Expense Allocations (how each expense is split across parts) ─────────────
-- Sum of allocations must equal expense.total_amount (enforced in app layer)
create table public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  part_id uuid not null references public.project_parts(id),
  amount numeric(12,2) not null check (amount > 0),
  unique (expense_id, part_id)
);

-- ─── Activity Log ─────────────────────────────────────────────────────────────
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('CREATE', 'UPDATE', 'DELETE')),
  entity_type text not null check (entity_type in ('transfer', 'expense', 'category', 'project_part')),
  entity_id uuid,
  summary text not null,
  changes jsonb,
  performed_by uuid references public.profiles(id),
  performed_at timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.people              enable row level security;
alter table public.project_parts      enable row level security;
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.transfers           enable row level security;
alter table public.expenses            enable row level security;
alter table public.expense_allocations enable row level security;
alter table public.activity_logs       enable row level security;

-- People: all read, supervisor write
create policy "people_select" on public.people for select using (true);
create policy "people_insert" on public.people for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "people_update" on public.people for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "people_delete" on public.people for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid());

-- Project parts: all read, supervisor write
create policy "parts_select" on public.project_parts for select using (true);
create policy "parts_insert" on public.project_parts for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "parts_update" on public.project_parts for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "parts_delete" on public.project_parts for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Categories: all read, supervisor write
create policy "categories_select" on public.categories for select using (true);
create policy "categories_insert" on public.categories for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "categories_update" on public.categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "categories_delete" on public.categories for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Transfers: all read, supervisor write
create policy "transfers_select" on public.transfers for select using (true);
create policy "transfers_insert" on public.transfers for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "transfers_update" on public.transfers for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "transfers_delete" on public.transfers for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Expenses: all read, supervisor write
create policy "expenses_select" on public.expenses for select using (true);
create policy "expenses_insert" on public.expenses for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "expenses_update" on public.expenses for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "expenses_delete" on public.expenses for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Expense allocations: cascade from expenses RLS
create policy "allocations_select" on public.expense_allocations for select using (true);
create policy "allocations_insert" on public.expense_allocations for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "allocations_update" on public.expense_allocations for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));
create policy "allocations_delete" on public.expense_allocations for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

-- Activity logs: all read, supervisor insert
create policy "logs_select" on public.activity_logs for select using (true);
create policy "logs_insert" on public.activity_logs for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor'));

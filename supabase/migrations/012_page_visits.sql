-- Track authenticated page visits separately from write/audit activity.

create table if not exists public.page_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  query text,
  referrer text,
  user_agent text,
  visited_at timestamptz not null default now()
);

create index if not exists page_visits_visited_at_idx on public.page_visits (visited_at desc);
create index if not exists page_visits_user_visited_at_idx on public.page_visits (user_id, visited_at desc);
create index if not exists page_visits_path_visited_at_idx on public.page_visits (path, visited_at desc);

alter table public.page_visits enable row level security;

drop policy if exists "page_visits_select" on public.page_visits;
create policy "page_visits_select" on public.page_visits for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor')
  );

drop policy if exists "page_visits_insert" on public.page_visits;
create policy "page_visits_insert" on public.page_visits for insert
  with check (user_id = auth.uid());

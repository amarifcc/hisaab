-- Owner RLS: owners may write only their own owner-source expenses, pinned to
-- their assigned part. Supervisor write policies are rewritten to use helper
-- functions (no behavior change). SELECT stays open (using(true)) as before;
-- owner view scoping is done in the app layer.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER bypasses profiles RLS recursion cleanly)
-- ---------------------------------------------------------------------------
create or replace function public.is_supervisor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'supervisor'
  );
$$;

-- Returns the owner's part_id, or NULL for non-owners → owner predicates fail closed.
create or replace function public.owner_part_id()
returns uuid language sql stable security definer set search_path = public as $$
  select part_id from public.profiles where id = auth.uid() and role = 'owner';
$$;

-- ---------------------------------------------------------------------------
-- Expenses: rewrite supervisor policies to use helper, add owner policies
-- ---------------------------------------------------------------------------
drop policy if exists "expenses_insert" on public.expenses;
drop policy if exists "expenses_update" on public.expenses;
drop policy if exists "expenses_delete" on public.expenses;

create policy "expenses_insert" on public.expenses for insert
  with check (public.is_supervisor());
create policy "expenses_update" on public.expenses for update
  using (public.is_supervisor());
create policy "expenses_delete" on public.expenses for delete
  using (public.is_supervisor());

-- Owner: create only owner-source rows authored by self, and only if they have a part.
create policy "expenses_owner_insert" on public.expenses for insert
  with check (
    source = 'owner'
    and created_by = auth.uid()
    and public.owner_part_id() is not null
  );

-- Owner: edit only own owner-source rows; with check blocks flipping source/created_by.
create policy "expenses_owner_update" on public.expenses for update
  using (source = 'owner' and created_by = auth.uid())
  with check (source = 'owner' and created_by = auth.uid());

create policy "expenses_owner_delete" on public.expenses for delete
  using (source = 'owner' and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Expense allocations: rewrite supervisor policies, add owner policies.
-- Owner allocations must point at the owner's part AND belong to an owner-source
-- expense authored by the owner (the source/created_by live on the parent row).
-- ---------------------------------------------------------------------------
drop policy if exists "allocations_insert" on public.expense_allocations;
drop policy if exists "allocations_update" on public.expense_allocations;
drop policy if exists "allocations_delete" on public.expense_allocations;

create policy "allocations_insert" on public.expense_allocations for insert
  with check (public.is_supervisor());
create policy "allocations_update" on public.expense_allocations for update
  using (public.is_supervisor());
create policy "allocations_delete" on public.expense_allocations for delete
  using (public.is_supervisor());

create policy "allocations_owner_insert" on public.expense_allocations for insert
  with check (
    part_id = public.owner_part_id()
    and exists (
      select 1 from public.expenses e
      where e.id = expense_allocations.expense_id
        and e.source = 'owner'
        and e.created_by = auth.uid()
    )
  );

create policy "allocations_owner_update" on public.expense_allocations for update
  using (
    part_id = public.owner_part_id()
    and exists (
      select 1 from public.expenses e
      where e.id = expense_allocations.expense_id
        and e.source = 'owner'
        and e.created_by = auth.uid()
    )
  )
  with check (
    part_id = public.owner_part_id()
    and exists (
      select 1 from public.expenses e
      where e.id = expense_allocations.expense_id
        and e.source = 'owner'
        and e.created_by = auth.uid()
    )
  );

create policy "allocations_owner_delete" on public.expense_allocations for delete
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_allocations.expense_id
        and e.source = 'owner'
        and e.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Profiles: allow supervisors to update any profile (needed to promote a
-- viewer to owner + assign a part). Existing self-update policy stays.
-- ---------------------------------------------------------------------------
create policy "profiles_supervisor_update" on public.profiles for update
  using (public.is_supervisor()) with check (public.is_supervisor());

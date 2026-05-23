-- Owner role + owner→part link on profiles
-- Owners are app users (auth accounts) who track expenses they paid directly,
-- scoped to a single project part. Supervisor remains the all-access superset.

-- 1. Widen the role check to allow 'owner'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('supervisor', 'owner', 'viewer'));

-- 2. Link an owner profile to their project part.
--    on delete restrict: a part bound to an owner cannot be deleted out from under them.
alter table public.profiles
  add column if not exists part_id uuid references public.project_parts(id) on delete restrict;

-- 3. Integrity: an owner MUST have a part; everyone else MUST NOT.
--    This lets RLS trust profiles.part_id is non-null for owners.
alter table public.profiles drop constraint if exists profiles_owner_part_chk;
alter table public.profiles
  add constraint profiles_owner_part_chk check (
    (role = 'owner' and part_id is not null)
    or (role <> 'owner' and part_id is null)
  );

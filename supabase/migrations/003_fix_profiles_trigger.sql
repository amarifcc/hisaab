-- ─── Migration 003: Auto-profile trigger ─────────────────────────────────────
-- Adds trigger to auto-create a viewer profile when a new auth user is created.
-- Also manually backfills any existing auth users who have no profile row.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing auth users who have no profile yet
insert into public.profiles (id, name, role)
select id, email, 'viewer'
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

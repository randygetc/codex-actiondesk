-- Identity lifecycle only: application request paths never use the service role.
create schema if not exists private;
create function private.is_profile_timezone(value text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select (value = 'UTC' or (value like '%/%' and value not like 'posix/%' and value not like 'right/%'))
    and exists (select 1 from pg_catalog.pg_timezone_names where name = value);
$$;
revoke all on function private.is_profile_timezone(text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_profile_timezone(text) to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  timezone text not null default 'America/Los_Angeles' check (private.is_profile_timezone(timezone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, timezone) on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function private.touch_profile()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin
  new.updated_at := now();
  return new;
end; $$;
revoke all on function private.touch_profile() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.touch_profile();

create function private.create_auth_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'ActionDesk user'), 120));
  return new;
end; $$;
revoke all on function private.create_auth_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.create_auth_profile();
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'name'), ''), 'ActionDesk user'), 120)
from auth.users on conflict (id) do nothing;

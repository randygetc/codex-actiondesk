create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Structural key for the task/project ownership FK introduced in step 1.7.
  unique (id, user_id)
);
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;
grant select, delete on public.projects to authenticated;
grant insert (user_id, name, description) on public.projects to authenticated;
grant update (name, description, archived_at) on public.projects to authenticated;
grant all on public.projects to service_role;

create policy projects_select_own on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.projects for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy projects_delete_own on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

create function private.touch_project()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin
  new.updated_at := now();
  return new;
end; $$;
revoke all on function private.touch_project() from public, anon, authenticated;
create trigger projects_updated_at before update on public.projects
  for each row execute function private.touch_project();

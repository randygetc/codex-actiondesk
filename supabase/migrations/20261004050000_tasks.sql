create function private.is_task_rule(value text) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare parts text[]; part text; keys text[] := '{}'; fields jsonb := '{}'; key text; v text; freq text;
begin
 if value is null then return true; end if;
 if char_length(value)>300 or value='' then return false; end if;
 parts := string_to_array(value,';');
 foreach part in array parts loop
  if part !~ '^[A-Z]+=[A-Z0-9,+-]+$' then return false; end if;
  key := split_part(part,'=',1); v := split_part(part,'=',2);
  if key=any(keys) or key not in ('FREQ','INTERVAL','BYDAY','BYMONTHDAY','COUNT','UNTIL') then return false; end if;
  keys:=array_append(keys,key); fields:=fields || jsonb_build_object(key,v);
 end loop;
 freq:=fields->>'FREQ';
 if freq is null or freq not in ('DAILY','WEEKLY','MONTHLY') or (fields ? 'COUNT' and fields ? 'UNTIL') then return false; end if;
 foreach key in array array['INTERVAL','COUNT'] loop
  v:=fields->>key;
  if v is not null and (v !~ '^[1-9][0-9]*$' or char_length(v)>4) then return false; end if;
  if v is not null and v::integer > (case when key='COUNT' then 1000 else 365 end) then return false; end if;
 end loop;
 v:=fields->>'BYMONTHDAY';
 if v is not null and (freq<>'MONTHLY' or fields ? 'BYDAY' or v !~ '^([1-9]|[12][0-9]|3[01])$') then return false; end if;
 v:=fields->>'BYDAY';
 if v is not null then
  if freq='DAILY' then return false; end if;
  if freq='MONTHLY' and v !~ '^([1-4]|-1)(MO|TU|WE|TH|FR|SA|SU)$' then return false; end if;
  if freq='WEEKLY' and v !~ '^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$' then return false; end if;
 end if;
 v:=fields->>'UNTIL';
 if v is not null then
  if v !~ '^[0-9]{8}T[0-9]{6}Z$' then return false; end if;
  perform (substring(v,1,4)||'-'||substring(v,5,2)||'-'||substring(v,7,2)||'T'||substring(v,10,2)||':'||substring(v,12,2)||':'||substring(v,14,2)||'Z')::timestamptz;
 end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return false;
end; $$;
revoke all on function private.is_task_rule(text) from public, anon;
grant execute on function private.is_task_rule(text) to authenticated, service_role;

create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 project_id uuid,
 title text not null check (title = btrim(title) and char_length(title) between 1 and 200),
 notes text not null default '' check (char_length(notes) <= 10000),
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 status text not null default 'todo' check (status in ('todo','doing','done')),
 due_at timestamptz check (due_at is null or isfinite(due_at)),
 recurrence text check (private.is_task_rule(recurrence)),
 recurrence_timezone text check (recurrence_timezone is null or private.is_profile_timezone(recurrence_timezone)),
 recurrence_anchor timestamp check (recurrence_anchor is null or isfinite(recurrence_anchor)),
 occurrence integer not null default 1 check (occurrence >= 1),
 predecessor_id uuid unique,
 completed_at timestamptz,
 revision bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id,user_id),
 foreign key (project_id,user_id) references public.projects(id,user_id) on delete restrict,
 foreign key (predecessor_id,user_id) references public.tasks(id,user_id) on delete restrict,
 check ((status = 'done') = (completed_at is not null)),
 check ((recurrence is null and recurrence_timezone is null and recurrence_anchor is null) or
        (recurrence is not null and recurrence_timezone is not null and recurrence_anchor is not null and due_at is not null))
);
alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant select, delete on public.tasks to authenticated;
grant insert (user_id,project_id,title,notes,priority,due_at,recurrence,recurrence_timezone,recurrence_anchor,occurrence,predecessor_id) on public.tasks to authenticated;
grant update (project_id,title,notes,priority,status,due_at,recurrence,recurrence_timezone,recurrence_anchor,occurrence,completed_at) on public.tasks to authenticated;
grant all on public.tasks to service_role;
create policy tasks_select_own on public.tasks for select to authenticated using ((select auth.uid())=user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy tasks_update_own on public.tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy tasks_delete_own on public.tasks for delete to authenticated using ((select auth.uid())=user_id);

create function private.guard_task() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op = 'UPDATE' then
  if (new.due_at,new.recurrence,new.recurrence_timezone,new.recurrence_anchor,new.occurrence)
     is distinct from (old.due_at,old.recurrence,old.recurrence_timezone,old.recurrence_anchor,old.occurrence)
     and exists(select 1 from public.tasks where predecessor_id=old.id) then
   raise exception 'A task with a successor cannot change schedule' using errcode='23514';
  end if;
  new.revision := old.revision+1; new.updated_at := now();
 end if;
 if new.project_id is not null and ((tg_op='INSERT' and new.predecessor_id is null) or (tg_op='UPDATE' and new.project_id is distinct from old.project_id)) then
  if not exists(select 1 from public.projects where id=new.project_id and user_id=new.user_id and archived_at is null) then
   raise exception 'Project unavailable or archived' using errcode='23514';
  end if;
 end if;
 return new;
end; $$;
revoke all on function private.guard_task() from public, anon, authenticated;
create trigger tasks_guard before insert or update on public.tasks for each row execute function private.guard_task();

-- Invoker permissions and RLS apply to every statement. Never accepts ownership or child metadata.
create function public.complete_task(p_id uuid, p_revision bigint, p_next timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare t public.tasks; child uuid; limit_count integer; limit_until text;
begin
 select * into t from public.tasks where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Task unavailable' using errcode='42501'; end if;
 select id into child from public.tasks where predecessor_id=t.id;
 if t.status='done' then return child; end if;
 if t.revision<>p_revision then raise exception 'Task changed; retry' using errcode='40001'; end if;
 if p_next is not null and (t.recurrence is null or p_next<=t.due_at) then
  raise exception 'Invalid successor date' using errcode='23514';
 end if;
 if p_next is not null then
  limit_count := substring(t.recurrence from '(?:^|;)COUNT=([0-9]+)')::integer;
  limit_until := substring(t.recurrence from '(?:^|;)UNTIL=([0-9]{8}T[0-9]{6}Z)');
  if limit_count is not null and t.occurrence>=limit_count then
   raise exception 'Recurrence count exhausted' using errcode='23514';
  end if;
  if limit_until is not null and p_next > (substring(limit_until,1,4)||'-'||substring(limit_until,5,2)||'-'||substring(limit_until,7,2)||'T'||substring(limit_until,10,2)||':'||substring(limit_until,12,2)||':'||substring(limit_until,14,2)||'Z')::timestamptz then
   raise exception 'Recurrence end exceeded' using errcode='23514';
  end if;
 end if;
 update public.tasks set status='done',completed_at=now() where id=t.id;
 if child is null and p_next is not null then
  insert into public.tasks (user_id,project_id,title,notes,priority,due_at,recurrence,recurrence_timezone,recurrence_anchor,occurrence,predecessor_id)
  values(t.user_id,t.project_id,t.title,t.notes,t.priority,p_next,t.recurrence,t.recurrence_timezone,t.recurrence_anchor,t.occurrence+1,t.id)
  returning id into child;
 end if;
 return child;
end; $$;
revoke all on function public.complete_task(uuid,bigint,timestamptz) from public, anon;
grant execute on function public.complete_task(uuid,bigint,timestamptz) to authenticated;

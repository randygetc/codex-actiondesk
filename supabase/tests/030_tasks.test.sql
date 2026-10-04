begin;
select no_plan();
insert into auth.users(id,email) values ('30000000-0000-4000-8000-000000000001','task-owner@example.test'),('30000000-0000-4000-8000-000000000002','task-other@example.test');
insert into public.projects(id,user_id,name) values ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Task project'),('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Foreign project');
insert into public.tasks(id,user_id,title) values ('32000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Foreign task');
insert into public.tasks(id,user_id,title,project_id,due_at,recurrence,recurrence_timezone,recurrence_anchor) values ('32000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Recurring','31000000-0000-4000-8000-000000000001','2026-10-01 09:00Z','FREQ=DAILY;COUNT=2','UTC','2026-10-01 09:00');

-- Rollback-only failure injection proves child insertion and completion share a transaction.
create function private.fail_task_child_fixture() returns trigger language plpgsql as $$
begin if new.predecessor_id is not null and new.notes='fail-child-fixture' then
 raise exception 'Injected successor failure' using errcode='23514'; end if; return new; end; $$;
create trigger task_child_failure_fixture before insert on public.tasks for each row execute function private.fail_task_child_fixture();
insert into public.tasks(id,user_id,title,notes,due_at,recurrence,recurrence_timezone,recurrence_anchor)
values('32000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','Failure fixture','fail-child-fixture','2026-10-01 09:00Z','FREQ=DAILY','UTC','2026-10-01 09:00');

set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.complete_task('32000000-0000-4000-8000-000000000003',1,'2026-10-02 09:00Z')$$,'23514',null,'Child insertion failure propagates');
select ok((select status='todo' and completed_at is null and revision=1 from public.tasks where id='32000000-0000-4000-8000-000000000003'),'Failed child insertion rolls back parent completion');
select is((select count(*) from public.tasks where predecessor_id='32000000-0000-4000-8000-000000000003'),0::bigint,'Failed insertion leaves no child');
select lives_ok($$insert into public.tasks(title) values('One-off')$$,'Owner creates an undated task');
select is((select count(*) from public.tasks),3::bigint,'Owner only sees own tasks');
select throws_ok($$insert into public.tasks(title,user_id) values('Forged','30000000-0000-4000-8000-000000000002')$$,'42501',null,'Cannot forge owner');
select throws_ok($$insert into public.tasks(title,project_id) values('Foreign project','31000000-0000-4000-8000-000000000002')$$,'23514',null,'Cannot assign foreign project');
select throws_ok($$insert into public.tasks(title) values(' ')$$,'23514',null,'Whitespace title rejected');
select throws_ok($$insert into public.tasks(title,due_at,recurrence,recurrence_timezone,recurrence_anchor) values('Bad rule','2026-10-01 09:00Z','FREQ=HOURLY','UTC','2026-10-01 09:00')$$,'23514',null,'Unsupported RRULE rejected in database');
select throws_ok($$insert into public.tasks(title,due_at,recurrence,recurrence_timezone,recurrence_anchor) values('Bad UNTIL','2026-10-01 09:00Z','FREQ=DAILY;UNTIL=20260230T090000Z','UTC','2026-10-01 09:00')$$,'23514',null,'Invalid calendar UNTIL rejected in database');
select throws_ok($$insert into public.tasks(title,priority) values('Bad','invalid')$$,'23514',null,'Priority rejected');
select throws_ok($$update public.tasks set user_id='30000000-0000-4000-8000-000000000002'$$,'42501',null,'Owner immutable');
select results_eq($$update public.tasks set title='Foreign edit' where id='32000000-0000-4000-8000-000000000002' returning id$$,$$select null::uuid where false$$,'Foreign update denied');
select results_eq($$delete from public.tasks where id='32000000-0000-4000-8000-000000000002' returning id$$,$$select null::uuid where false$$,'Foreign delete denied');
select throws_ok($$select public.complete_task('32000000-0000-4000-8000-000000000002',1,null)$$,'42501',null,'Foreign completion denied');
select throws_ok($$select public.complete_task('32000000-0000-4000-8000-000000000001',99,'2026-10-02 09:00Z')$$,'40001',null,'Stale schedule rejected');
select throws_ok($$select public.complete_task('32000000-0000-4000-8000-000000000001',1,'2026-09-30 09:00Z')$$,'23514',null,'Nonadvancing successor rejected');
select is((select status from public.tasks where id='32000000-0000-4000-8000-000000000001'),'todo','Failed completion leaves original unchanged');
select lives_ok($$select public.complete_task('32000000-0000-4000-8000-000000000001',1,'2026-10-02 09:00Z')$$,'Completion succeeds');
select is((select count(*) from public.tasks where predecessor_id='32000000-0000-4000-8000-000000000001'),1::bigint,'Exactly one successor');
select ok((select status='todo' and title='Recurring' and occurrence=2 and project_id='31000000-0000-4000-8000-000000000001' from public.tasks where predecessor_id='32000000-0000-4000-8000-000000000001'),'Successor inherits metadata and ordinal');
select lives_ok($$select public.complete_task('32000000-0000-4000-8000-000000000001',1,'2026-10-02 09:00Z')$$,'Retry succeeds');
update public.tasks set status='todo',completed_at=null where id='32000000-0000-4000-8000-000000000001';
select lives_ok($$select public.complete_task('32000000-0000-4000-8000-000000000001',3,'2026-10-02 09:00Z')$$,'Recompletion succeeds');
select is((select count(*) from public.tasks where predecessor_id='32000000-0000-4000-8000-000000000001'),1::bigint,'Recompletion does not duplicate');
select throws_ok($$delete from public.tasks where id='32000000-0000-4000-8000-000000000001'$$,'23503',null,'Predecessor history protected');
select throws_ok($$update public.tasks set due_at='2026-10-03 09:00Z' where id='32000000-0000-4000-8000-000000000001'$$,'23514',null,'Predecessor schedule protected');
select throws_ok($$delete from public.projects where id='31000000-0000-4000-8000-000000000001'$$,'23503',null,'Referenced project cannot be deleted');
update public.projects set archived_at=now() where id='31000000-0000-4000-8000-000000000001';
select throws_ok($$insert into public.tasks(title,project_id) values('Archived','31000000-0000-4000-8000-000000000001')$$,'23514',null,'New assignments to archived project denied');
select lives_ok($$update public.tasks set title='Edited' where predecessor_id='32000000-0000-4000-8000-000000000001'$$,'Existing archived reference can be edited');
select throws_ok($$select public.complete_task(id,revision,'2026-10-03 09:00Z') from public.tasks where predecessor_id='32000000-0000-4000-8000-000000000001'$$,'23514',null,'Direct RPC cannot exceed COUNT');
select lives_ok($$select public.complete_task(id,revision,null) from public.tasks where predecessor_id='32000000-0000-4000-8000-000000000001'$$,'Finite final occurrence completes without child');
select is((select count(*) from public.tasks where recurrence='FREQ=DAILY;COUNT=2'),2::bigint,'Finite series has two rows');
select lives_ok($$select public.complete_task(id,revision,null) from public.tasks where title='One-off'$$,'One-off completes');
select ok((select completed_at is not null from public.tasks where title='One-off'),'Completion timestamp stored');
select lives_ok($$delete from public.tasks where title='One-off'$$,'Unreferenced one-off can be deleted');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select * from public.tasks$$,'42501',null,'Anonymous select denied');
select throws_ok($$insert into public.tasks(title) values('Anon')$$,'42501',null,'Anonymous insert denied');
select throws_ok($$update public.tasks set title='Anon'$$,'42501',null,'Anonymous update denied');
select throws_ok($$delete from public.tasks$$,'42501',null,'Anonymous delete denied');
select throws_ok($$select public.complete_task('32000000-0000-4000-8000-000000000001',1,null)$$,'42501',null,'Anonymous completion denied');
select * from finish();rollback;

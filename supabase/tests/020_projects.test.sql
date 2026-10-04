begin;
select no_plan();
insert into auth.users (id, email) values
 ('20000000-0000-4000-8000-000000000001', 'project-owner@example.test'),
 ('20000000-0000-4000-8000-000000000002', 'project-other@example.test');
insert into public.projects (id, user_id, name) values
 ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Owner project'),
 ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Other project');

-- Future task FK contract exercised without introducing a production tasks table.
create table private.project_reference_fixture (
 project_id uuid, user_id uuid,
 foreign key (project_id, user_id) references public.projects(id, user_id) on delete restrict
);
insert into private.project_reference_fixture values ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
select throws_ok($$insert into private.project_reference_fixture values ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$,
 '23503', null, 'Composite project reference prevents mismatched ownership');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.projects), 1::bigint, 'Owner sees only their project');
select is((select count(*) from public.projects where id = '21000000-0000-4000-8000-000000000002'), 0::bigint, 'Foreign project cannot be read');
select lives_ok($$insert into public.projects (name, description) values ('New project', 'Optional description')$$, 'Owner can insert using their Auth identity default');
select throws_ok($$insert into public.projects (user_id, name) values ('20000000-0000-4000-8000-000000000002', 'Forged owner')$$,
 '42501', null, 'Forged ownership rejected by insert policy');
select throws_ok($$insert into public.projects (name) values ('')$$, '23514', null, 'Empty name rejected');
select throws_ok($$insert into public.projects (name) values ('   ')$$, '23514', null, 'Whitespace-only name rejected');
select throws_ok($$insert into public.projects (name) values (repeat('x', 121))$$, '23514', null, 'Long name rejected');
select throws_ok($$insert into public.projects (name, description) values ('Long description', repeat('x', 2001))$$,
 '23514', null, 'Long description rejected');
select lives_ok($$update public.projects set name = 'Edited project', description = 'Edited description'
 where id = '21000000-0000-4000-8000-000000000001'$$, 'Owner can edit project');
select is((select name from public.projects where id = '21000000-0000-4000-8000-000000000001'), 'Edited project', 'Edits persist');
select throws_ok($$update public.projects set user_id = '20000000-0000-4000-8000-000000000002'$$,
 '42501', null, 'Ownership cannot be reassigned');
select throws_ok($$update public.projects set id = '21000000-0000-4000-8000-000000000003'$$,
 '42501', null, 'Project identity cannot be changed');
select throws_ok($$update public.projects set created_at = now()$$, '42501', null, 'Creation timestamp cannot be forged');
select results_eq($$update public.projects set name = 'Foreign edit' where id = '21000000-0000-4000-8000-000000000002' returning id$$,
 $$select null::uuid where false$$, 'Foreign update affects zero rows');
select results_eq($$delete from public.projects where id = '21000000-0000-4000-8000-000000000002' returning id$$,
 $$select null::uuid where false$$, 'Foreign delete affects zero rows');
select lives_ok($$update public.projects set archived_at = now() where id = '21000000-0000-4000-8000-000000000001'$$,
 'Owner can archive a referenced project');
select ok((select archived_at is not null from public.projects where id = '21000000-0000-4000-8000-000000000001'), 'Archive persists');
select is((select count(*) from public.projects where id = '21000000-0000-4000-8000-000000000001'), 1::bigint, 'Archived project stays readable');
select throws_ok($$delete from public.projects where id = '21000000-0000-4000-8000-000000000001'$$,
 '23503', null, 'Restricting FK prevents deletion of a referenced project');
select lives_ok($$update public.projects set archived_at = null where id = '21000000-0000-4000-8000-000000000001'$$, 'Owner can restore project');
reset role;
delete from private.project_reference_fixture;
set local role authenticated;
select lives_ok($$delete from public.projects where id = '21000000-0000-4000-8000-000000000001'$$, 'Owner can delete unreferenced project');
select is((select count(*) from public.projects where id = '21000000-0000-4000-8000-000000000001'), 0::bigint, 'Deleted project is gone');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select name from public.projects), 'Other project', 'Foreign project survived all other-user mutations');
select lives_ok($$update public.projects set name = 'Second owner edit'$$, 'Second owner can edit their own project');
select lives_ok($$delete from public.projects$$, 'Second owner can delete their own empty project');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.projects$$, '42501', null, 'Anonymous read denied');
select throws_ok($$insert into public.projects (name) values ('Anonymous')$$, '42501', null, 'Anonymous insert denied');
select throws_ok($$update public.projects set name = 'Anonymous'$$, '42501', null, 'Anonymous update denied');
select throws_ok($$delete from public.projects$$, '42501', null, 'Anonymous delete denied');
select * from finish();
rollback;

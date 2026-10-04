begin;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', 'profile-owner@example.test', '{"full_name":"Profile Owner","timezone":"Invalid/Zone"}'),
 ('10000000-0000-4000-8000-000000000002', 'profile-other@example.test', '{}');
select is((select count(*) from public.profiles where id in (
 '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')), 2::bigint, 'Auth inserts provision profiles');
select is((select timezone from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
 'America/Los_Angeles', 'Pacific default ignores untrusted metadata timezone');
select is((select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
 'Profile Owner', 'Auth display name provisioned');
select is((select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000002'),
 'ActionDesk user', 'Missing metadata has safe fallback');
update auth.users set raw_user_meta_data = '{"full_name":"Changed"}' where id = '10000000-0000-4000-8000-000000000001';
select is((select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
 'Profile Owner', 'Auth updates do not recreate or overwrite profiles');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.profiles), 1::bigint, 'Owner can read only their profile');
select is((select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000002'),
 0::bigint, 'Other profile is invisible');
select lives_ok($$update public.profiles set timezone = 'Asia/Manila' where id = '10000000-0000-4000-8000-000000000001'$$,
 'Owner can update timezone');
select is((select timezone from public.profiles), 'Asia/Manila', 'Timezone update persists');
select is((select updated_at from public.profiles), now(), 'Update timestamp is server-controlled');
select results_eq($$update public.profiles set timezone = 'UTC' where id = '10000000-0000-4000-8000-000000000002' returning id$$,
 $$select null::uuid where false$$, 'Cross-user update affects no rows');
select throws_ok($$update public.profiles set timezone = 'Invalid/Zone'$$, '23514', null, 'Invalid timezone rejected by database');
select throws_ok($$update public.profiles set timezone = 'PST'$$, '23514', null, 'Timezone abbreviation rejected');
select throws_ok($$update public.profiles set display_name = ''$$, '23514', null, 'Empty display name rejected');
select throws_ok($$update public.profiles set id = '10000000-0000-4000-8000-000000000002'$$,
 '42501', null, 'Owner identity cannot be changed');
select throws_ok($$update public.profiles set created_at = now()$$, '42501', null, 'Creation time cannot be changed');
select throws_ok($$insert into public.profiles (id, display_name) values ('10000000-0000-4000-8000-000000000003', 'Forged')$$,
 '42501', null, 'Authenticated user cannot insert a profile');
select throws_ok($$delete from public.profiles$$, '42501', null, 'Authenticated user cannot delete a profile');
select ok(not has_function_privilege('authenticated', 'private.create_auth_profile()', 'EXECUTE'),
 'Provisioning function is not directly executable by users');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select timezone from public.profiles), 'America/Los_Angeles', 'Other-user update did not modify target');
select lives_ok($$update public.profiles set timezone = 'UTC'$$, 'Second user can update own profile');
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.profiles$$, '42501', null, 'Anonymous read denied');
select throws_ok($$update public.profiles set timezone = 'UTC'$$, '42501', null, 'Anonymous update denied');
select throws_ok($$insert into public.profiles (id, display_name) values ('10000000-0000-4000-8000-000000000003', 'Anon')$$,
 '42501', null, 'Anonymous insert denied');
select throws_ok($$delete from public.profiles$$, '42501', null, 'Anonymous delete denied');

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(40);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'student@test.local', '', now(), now(), now(), '{}', '{"full_name":"Aluno"}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'other@test.local', '', now(), now(), now(), '{}', '{"full_name":"Outro aluno"}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'teacher@test.local', '', now(), now(), now(), '{}', '{"full_name":"Professor"}');

update public.profiles
set role = 'teacher'
where id = '33333333-3333-3333-3333-333333333333';

insert into public.courses (id, slug, title, price_cents, is_published) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'rls-guitarra', 'RLS Guitarra', 10000, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'rls-baixo', 'RLS Baixo', 10000, false);

insert into public.modules (id, course_id, position, title, is_published) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 1, 'Aula da guitarra', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 1, 'Aula do baixo', true);

insert into public.enrollments (id, user_id, course_id, status) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'active'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'active');

insert into public.bookings (id, student_name, student_phone, instrument, starts_at) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'Reserva inicial', '5511999999999', 'Guitarra', '2099-03-03 12:00:00+00');

insert into storage.objects (bucket_id, name) values
  ('course-videos', 'rls-guitarra/lesson-1.mp4'),
  ('course-videos', 'rls-baixo/lesson-1.mp4');

-- Anonymous visitor: public catalog and booking RPC only.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(auth.uid(), null, 'anonymous visitor has no user id');
select is((select count(*)::integer from public.courses where slug like 'rls-%'), 1, 'anonymous visitor sees only published courses');
select throws_ok('select * from public.profiles', '42501', null, 'anonymous visitor cannot read profiles');
select throws_ok('select * from public.enrollments', '42501', null, 'anonymous visitor cannot read enrollments');
select throws_ok('select * from public.modules', '42501', null, 'anonymous visitor cannot read modules');
select throws_ok('select * from public.bookings', '42501', null, 'anonymous visitor cannot read bookings');
select is((select count(*)::integer from storage.objects), 0, 'anonymous visitor cannot read storage metadata');
select throws_ok(
  $$insert into public.bookings (student_name, student_phone, instrument, starts_at) values ('Direto', '5511000000000', 'Guitarra', '2099-03-01 12:00:00+00')$$,
  '42501', null, 'anonymous visitor cannot bypass the booking RPC'
);
select lives_ok(
  $$select public.create_booking('Visitante', '5511000000000', 'Guitarra', '2099-03-01 12:00:00+00')$$,
  'anonymous visitor can create a validated booking'
);
select throws_ok(
  $$select public.create_booking('Duplicado', '5511000000001', 'Violão', '2099-03-01 12:00:00+00')$$,
  'P0001', 'BOOKING_SLOT_UNAVAILABLE', 'duplicate booking returns the stable conflict error'
);
reset role;

select is((select count(*)::integer from public.bookings where student_name = 'Visitante'), 1, 'anonymous booking was persisted once');

-- Student: own profile/enrollment and published modules for active courses.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(auth.uid(), '11111111-1111-1111-1111-111111111111'::uuid, 'student identity is active');
select is((select count(*)::integer from public.profiles), 1, 'student sees only their own profile');
select lives_ok(
  $$update public.profiles set full_name = 'Aluno atualizado' where id = '11111111-1111-1111-1111-111111111111'$$,
  'student can update their own display name'
);
select throws_ok(
  $$update public.profiles set role = 'teacher' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'student cannot promote themselves'
);
select is((select count(*)::integer from public.modules), 1, 'student sees modules only for their active enrollment');
select is((select count(*)::integer from public.enrollments), 1, 'student sees only their own enrollment');
select throws_ok(
  $$insert into public.enrollments (user_id, course_id, status) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'active')$$,
  '42501', null, 'student cannot activate their own enrollment'
);
select lives_ok(
  $$insert into public.enrollments (user_id, course_id, status) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'pending')$$,
  'student can start their own pending enrollment'
);
select throws_ok(
  $$insert into public.enrollments (user_id, course_id, status) values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'pending')$$,
  '42501', null, 'student cannot create an enrollment for another user'
);
select is((select count(*)::integer from public.bookings), 0, 'student cannot read bookings');
select lives_ok(
  $$select public.create_booking('Aluno', '5511888888888', 'Baixo', '2099-03-02 12:00:00+00')$$,
  'student can create a validated booking'
);
select is((select count(*)::integer from storage.objects), 1, 'student sees videos only for their active enrollment');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('course-videos', 'rls-guitarra/student-upload.mp4')$$,
  '42501', null, 'student cannot upload course videos'
);
select is(
  (with changed as (
    update public.bookings set status = 'confirmed' returning 1
  ) select count(*)::integer from changed),
  0, 'student cannot update bookings'
);
reset role;

-- Teacher: administration access, but no payment/enrollment escalation.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select ok(public.is_teacher(), 'teacher role is recognized');
select is((select count(*)::integer from public.profiles), 3, 'teacher sees all profiles');
select is((select count(*)::integer from public.modules where course_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2')), 2, 'teacher sees all course modules');
select lives_ok(
  $$insert into public.modules (course_id, position, title, is_published) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 2, 'Nova aula', false)$$,
  'teacher can create a module'
);
select lives_ok(
  $$update public.modules set is_published = true where title = 'Nova aula'$$,
  'teacher can publish a module'
);
select is((select count(*)::integer from public.enrollments), 3, 'teacher sees all enrollments');
select throws_ok(
  $$update public.enrollments set status = 'active' where status = 'pending'$$,
  '42501', null, 'teacher cannot bypass the payment flow by activating enrollments'
);
select is((select count(*)::integer from public.bookings), 3, 'teacher sees all bookings');
select lives_ok(
  $$update public.bookings set status = 'confirmed' where student_name = 'Visitante'$$,
  'teacher can confirm a booking'
);
select is((select count(*)::integer from storage.objects), 2, 'teacher sees every course video');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('course-videos', 'rls-baixo/teacher-upload.mp4')$$,
  'teacher can upload a course video'
);
select lives_ok(
  $$update storage.objects set name = 'rls-baixo/teacher-renamed.mp4' where name = 'rls-baixo/teacher-upload.mp4'$$,
  'teacher can update course video metadata'
);
select lives_ok(
  $$delete from storage.objects where name = 'rls-baixo/teacher-renamed.mp4'$$,
  'teacher can delete a course video'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'outside-scope.mp4')$$,
  '42501', null, 'teacher storage access is limited to course-videos'
);
select is(
  (with changed as (
    update public.profiles set full_name = 'Alterado pelo professor'
    where id = '11111111-1111-1111-1111-111111111111'
    returning 1
  ) select count(*)::integer from changed),
  0, 'teacher cannot edit another user profile'
);

reset role;

select * from finish();
rollback;

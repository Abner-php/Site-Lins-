begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.bookings'::regclass), 'bookings has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.enrollments'::regclass), 'enrollments has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.modules'::regclass), 'modules has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), 'storage.objects has RLS enabled');
select is((select public from storage.buckets where id = 'course-videos'), false, 'course-videos is private');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon has no profile access');
select ok(not has_table_privilege('anon', 'public.enrollments', 'select'), 'anon has no enrollment access');
select ok(not has_table_privilege('anon', 'public.modules', 'select'), 'anon has no module access');
select ok(not has_table_privilege('anon', 'storage.objects', 'select'), 'anon has no storage metadata access');
select ok(has_function_privilege('anon', 'public.create_booking(text,text,text,timestamptz)', 'execute'), 'anon can call the validated booking RPC');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'), 'clients cannot update the profile role column');

select * from finish();
rollback;

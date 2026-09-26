-- LINS-8: explicit privileges and RLS policies for every client-facing table.
-- Policies are permissive by default in Postgres, so privileges are revoked
-- first and only the operations used by the application are granted back.

insert into storage.buckets (id, name, public)
values ('course-videos', 'course-videos', false)
on conflict (id) do update set public = false;

alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.enrollments enable row level security;
alter table public.modules enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.enrollments from anon, authenticated;
revoke all on table public.modules from anon, authenticated;
revoke all on table public.courses from anon, authenticated;

grant select on table public.courses to anon, authenticated;
grant insert, update, delete on table public.courses to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.modules to authenticated;
grant select, insert on table public.enrollments to authenticated;
grant select, update, delete on table public.bookings to authenticated;

alter function public.is_teacher() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.booking_unavailable_slots(timestamptz, timestamptz) set search_path = '';

-- Public booking creation uses this narrow, validated entry point. SECURITY
-- DEFINER is intentional: clients have no direct INSERT privilege on bookings.
create or replace function public.create_booking(
  p_student_name text,
  p_student_phone text,
  p_instrument text,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_id uuid;
begin
  if nullif(btrim(p_student_name), '') is null
     or nullif(btrim(p_student_phone), '') is null then
    raise exception using errcode = 'P0001', message = 'BOOKING_CONTACT_REQUIRED';
  end if;

  if p_instrument not in ('Guitarra', 'Violão', 'Baixo') then
    raise exception using errcode = 'P0001', message = 'BOOKING_INSTRUMENT_INVALID';
  end if;

  if p_starts_at is null or p_starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_TIME_INVALID';
  end if;

  insert into public.bookings (student_name, student_phone, instrument, starts_at)
  values (btrim(p_student_name), btrim(p_student_phone), p_instrument, p_starts_at)
  returning id into booking_id;

  return booking_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_UNAVAILABLE';
end;
$$;

revoke all on function public.is_teacher() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.booking_unavailable_slots(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.create_booking(text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.is_teacher() to authenticated;
grant execute on function public.booking_unavailable_slots(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.create_booking(text, text, text, timestamptz) to anon, authenticated;

drop policy if exists "profiles: owner or teacher reads" on public.profiles;
drop policy if exists "profiles: owner updates" on public.profiles;
create policy "profiles: owner or teacher reads"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_teacher()));
create policy "profiles: owner updates"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "courses: published list" on public.courses;
drop policy if exists "courses: teacher manages" on public.courses;
create policy "courses: published list"
on public.courses for select to anon, authenticated
using (is_published);
create policy "courses: teacher manages"
on public.courses for all to authenticated
using ((select public.is_teacher()))
with check ((select public.is_teacher()));

drop policy if exists "modules: enrolled students read" on public.modules;
drop policy if exists "modules: teacher manages" on public.modules;
create policy "modules: enrolled students read"
on public.modules for select to authenticated
using (
  (select public.is_teacher())
  or (
    is_published
    and exists (
      select 1
      from public.enrollments e
      where e.course_id = modules.course_id
        and e.user_id = (select auth.uid())
        and e.status = 'active'
    )
  )
);
create policy "modules: teacher manages"
on public.modules for all to authenticated
using ((select public.is_teacher()))
with check ((select public.is_teacher()));

drop policy if exists "enrollments: owner or teacher reads" on public.enrollments;
drop policy if exists "enrollments: student starts checkout" on public.enrollments;
create policy "enrollments: owner or teacher reads"
on public.enrollments for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_teacher()));
create policy "enrollments: student starts checkout"
on public.enrollments for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

drop policy if exists "bookings: public creates" on public.bookings;
drop policy if exists "bookings: teacher manages" on public.bookings;
create policy "bookings: teacher reads"
on public.bookings for select to authenticated
using ((select public.is_teacher()));
create policy "bookings: teacher updates"
on public.bookings for update to authenticated
using ((select public.is_teacher()))
with check ((select public.is_teacher()));
create policy "bookings: teacher deletes"
on public.bookings for delete to authenticated
using ((select public.is_teacher()));

drop policy if exists "course videos: enrolled students read" on storage.objects;
drop policy if exists "course videos: teacher inserts" on storage.objects;
drop policy if exists "course videos: teacher updates" on storage.objects;
drop policy if exists "course videos: teacher deletes" on storage.objects;
create policy "course videos: enrolled students read"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-videos'
  and (
    (select public.is_teacher())
    or exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.user_id = (select auth.uid())
        and e.status = 'active'
        and c.slug = (storage.foldername(name))[1]
    )
  )
);
create policy "course videos: teacher inserts"
on storage.objects for insert to authenticated
with check (bucket_id = 'course-videos' and (select public.is_teacher()));
create policy "course videos: teacher updates"
on storage.objects for update to authenticated
using (bucket_id = 'course-videos' and (select public.is_teacher()))
with check (bucket_id = 'course-videos' and (select public.is_teacher()));
create policy "course videos: teacher deletes"
on storage.objects for delete to authenticated
using (bucket_id = 'course-videos' and (select public.is_teacher()));

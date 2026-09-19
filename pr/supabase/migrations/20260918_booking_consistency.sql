-- Keep the schedule consistent even when two visitors submit the same slot
-- concurrently. Cancelled bookings release the slot for a new reservation.
create unique index if not exists bookings_one_active_per_start
on public.bookings (starts_at)
where status in ('pending', 'confirmed');

-- Expose only occupied timestamps, never student contact information, so the
-- public calendar can hide unavailable slots without broad SELECT access.
create or replace function public.booking_unavailable_slots(
  p_from timestamptz,
  p_to timestamptz
)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.starts_at
  from public.bookings b
  where b.status in ('pending', 'confirmed')
    and b.starts_at >= p_from
    and b.starts_at < p_to
    and p_to > p_from
    and p_to <= p_from + interval '2 days';
$$;

revoke all on function public.booking_unavailable_slots(timestamptz, timestamptz) from public;
grant execute on function public.booking_unavailable_slots(timestamptz, timestamptz) to anon, authenticated;

-- Use one database entry point for validation and persistence. The unique
-- index remains the final concurrency guard and this function returns a stable
-- error identifier that the frontend can translate into a friendly message.
create or replace function public.create_booking(
  p_student_name text,
  p_student_phone text,
  p_instrument text,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = public
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

revoke all on function public.create_booking(text, text, text, timestamptz) from public;
grant execute on function public.create_booking(text, text, text, timestamptz) to anon, authenticated;

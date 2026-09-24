create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  payment_id text not null,
  request_id text not null,
  processed_at timestamptz not null default now(),
  unique (provider, payment_id),
  unique (provider, request_id)
);

alter table public.payment_webhook_events enable row level security;

create or replace function public.process_approved_payment(
  p_provider text,
  p_payment_id text,
  p_request_id text,
  p_user_id uuid,
  p_course_id uuid,
  p_payment_reference text,
  p_paid_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event_id uuid;
begin
  if nullif(trim(p_provider), '') is null
     or nullif(trim(p_payment_id), '') is null
     or nullif(trim(p_request_id), '') is null then
    raise exception 'Webhook identifiers are required';
  end if;

  insert into public.payment_webhook_events (provider, payment_id, request_id)
  values (p_provider, p_payment_id, p_request_id)
  on conflict do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return false;
  end if;

  insert into public.enrollments (
    user_id,
    course_id,
    status,
    payment_provider,
    payment_reference,
    paid_at
  ) values (
    p_user_id,
    p_course_id,
    'active',
    p_provider,
    p_payment_reference,
    coalesce(p_paid_at, now())
  )
  on conflict (user_id, course_id) do update set
    status = 'active',
    payment_provider = excluded.payment_provider,
    payment_reference = excluded.payment_reference,
    paid_at = excluded.paid_at;

  return true;
end;
$$;

revoke all on function public.process_approved_payment(text, text, text, uuid, uuid, text, timestamptz) from public;
revoke all on function public.process_approved_payment(text, text, text, uuid, uuid, text, timestamptz) from anon;
revoke all on function public.process_approved_payment(text, text, text, uuid, uuid, text, timestamptz) from authenticated;
grant execute on function public.process_approved_payment(text, text, text, uuid, uuid, text, timestamptz) to service_role;

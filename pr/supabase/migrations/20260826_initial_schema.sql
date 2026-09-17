-- Jonas Lins: banco, login e acesso pago aos cursos.
create extension if not exists "pgcrypto";

create type public.user_role as enum ('student', 'teacher');
create type public.enrollment_status as enum ('pending', 'active', 'cancelled', 'refunded');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  description text,
  video_url text,
  is_published boolean not null default false,
  unique(course_id, position)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status public.enrollment_status not null default 'pending',
  payment_provider text,
  payment_reference text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, course_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_phone text,
  instrument text not null check (instrument in ('Guitarra', 'Violão', 'Baixo')),
  starts_at timestamptz not null,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.enrollments enable row level security;
alter table public.bookings enable row level security;

create policy "profiles: owner or teacher reads" on public.profiles for select using (id = auth.uid() or public.is_teacher());
create policy "profiles: owner updates" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "courses: published list" on public.courses for select using (is_published or public.is_teacher());
create policy "courses: teacher manages" on public.courses for all using (public.is_teacher()) with check (public.is_teacher());
create policy "modules: enrolled students read" on public.modules for select using (
  public.is_teacher() or (is_published and exists (select 1 from public.enrollments e where e.course_id = modules.course_id and e.user_id = auth.uid() and e.status = 'active'))
);
create policy "modules: teacher manages" on public.modules for all using (public.is_teacher()) with check (public.is_teacher());
create policy "enrollments: owner or teacher reads" on public.enrollments for select using (user_id = auth.uid() or public.is_teacher());
create policy "enrollments: student starts checkout" on public.enrollments for insert with check (user_id = auth.uid() and status = 'pending');
create policy "bookings: public creates" on public.bookings for insert with check (true);
create policy "bookings: teacher manages" on public.bookings for all using (public.is_teacher()) with check (public.is_teacher());

insert into public.courses (slug, title, description, price_cents, is_published)
values ('guitarra-essencial', 'Guitarra Essencial', 'Do zero ao seu som.', 29700, true)
on conflict (slug) do nothing;

insert into public.modules (course_id, position, title, description, is_published)
select c.id, seed.position, seed.title, seed.description, true
from public.courses c
cross join (values
  (1, 'Primeiros sons', 'Conheça a guitarra, afinação e postura.'),
  (2, 'Acordes essenciais', 'Os acordes que abrem um universo de músicas.'),
  (3, 'Ritmo e levadas', 'Faça os acordes soarem como música.'),
  (4, 'Seu primeiro repertório', 'Aprenda canções do começo ao fim.'),
  (5, 'Escalas sem mistério', 'Encontre notas e comece a improvisar.'),
  (6, 'Técnica que funciona', 'Palhetada, digitação e independência.'),
  (7, 'Harmonia prática', 'Entenda por que as músicas soam bem.'),
  (8, 'Riffs e solos', 'Construa frases que têm a sua cara.'),
  (9, 'Tocando com outros', 'Tempo, dinâmica e presença musical.'),
  (10, 'Seu próximo capítulo', 'Monte sua rotina e continue evoluindo.')
) as seed(position, title, description)
where c.slug = 'guitarra-essencial'
on conflict (course_id, position) do nothing;

-- Depois que Jonas criar o primeiro usuário em Auth, execute UMA vez substituindo o e-mail:
-- update public.profiles p set role = 'teacher'
-- from auth.users u where p.id = u.id and u.email = 'jonas.guita.jazz@gmail.com';

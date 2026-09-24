create table storage_deletion_jobs (
  id uuid primary key,
  storage_key varchar(500) not null unique,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

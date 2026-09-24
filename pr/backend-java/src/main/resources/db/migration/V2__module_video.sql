alter table modules
  add column if not exists video_storage_key varchar(500),
  add column if not exists video_original_name varchar(255),
  add column if not exists video_content_type varchar(100),
  add column if not exists video_size_bytes bigint,
  add column if not exists video_upload_status varchar(20) not null default 'NONE',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table modules
  add constraint modules_video_upload_status_check
  check (video_upload_status in ('NONE', 'UPLOADING', 'READY', 'FAILED'));

alter table modules
  add constraint modules_published_video_check
  check (
    not published
    or video_url is not null
    or (video_upload_status = 'READY' and video_storage_key is not null)
  );

create index if not exists modules_course_position_idx
  on modules (course_id, position);

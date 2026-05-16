-- QR보안점검표 관리자 Supabase setup
-- Run this file in the Supabase SQL Editor for each school's own project.
-- Do not paste or store a service_role key in the desktop app or submit page.

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists qr_security;

create or replace function qr_security.hash_secret(p_secret text, p_salt text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(coalesce(p_salt, '') || ':' || btrim(coalesce(p_secret, '')), 'sha256'), 'hex')
$$;

create or replace function qr_security.json_bool(p_value jsonb, p_default boolean default true)
returns boolean
language sql
immutable
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then p_default
    when lower(trim(both '"' from p_value::text)) in ('true', '1', 'yes', 'y', '사용', 'active') then true
    when lower(trim(both '"' from p_value::text)) in ('false', '0', 'no', 'n', '미사용', 'inactive') then false
    else p_default
  end
$$;

create table if not exists public.schema_version (
  version integer primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_code text not null unique,
  school_name text not null default '',
  desktop_sync_key_hash text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id text not null,
  room_name text not null,
  room_order integer not null default 100,
  submit_token_hash text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, room_id)
);

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  token_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_id text not null,
  name text not null,
  room_id text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, person_id)
);

create table if not exists public.duty_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_id text not null,
  name text not null,
  room_id text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, person_id)
);

create table if not exists public.check_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id text not null,
  item_key text not null,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, item_id),
  unique (organization_id, item_key)
);

create table if not exists public.check_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_id text not null,
  room_id text not null,
  room_name text not null,
  checker_id text not null default '',
  checker_name text not null default '',
  duty_id text not null default '',
  duty_name text not null default '',
  submitted_at timestamptz not null default now(),
  inspection_date date not null default (now() at time zone 'Asia/Seoul')::date,
  status text not null default 'normal',
  status_json jsonb not null default '{}'::jsonb,
  note text not null default '',
  client_info jsonb not null default '{}'::jsonb,
  source text not null default 'mobile',
  admin_verified boolean not null default false,
  admin_verified_by text not null default '',
  admin_verified_at timestamptz,
  admin_memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, record_id)
);

create table if not exists public.check_record_items (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.check_records(id) on delete cascade,
  item_id text not null default '',
  item_label text not null default '',
  result text not null default '이상 무',
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.check_records(id) on delete cascade,
  attachment_id text not null,
  item_key text not null default '',
  file_name text not null default '',
  mime_type text not null default '',
  file_size integer not null default 0,
  storage_path text not null default '',
  public_url text not null default '',
  created_at timestamptz not null default now(),
  unique (record_id, attachment_id),
  constraint no_public_attachment_url check (public_url = '')
);

create table if not exists public.admin_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_id uuid not null references public.check_records(id) on delete cascade,
  admin_email text not null default '',
  admin_memo text not null default '',
  verified_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor text not null default '',
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  detail_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rooms_org_room_id on public.rooms(organization_id, room_id);
create index if not exists idx_staff_org_person_id on public.staff_members(organization_id, person_id);
create index if not exists idx_duty_org_person_id on public.duty_members(organization_id, person_id);
create index if not exists idx_records_org_date on public.check_records(organization_id, inspection_date);
create index if not exists idx_records_org_updated on public.check_records(organization_id, updated_at);
create index if not exists idx_records_flags on public.check_records(organization_id, status, admin_verified);
create index if not exists idx_attachments_record on public.attachments(record_id);
create index if not exists idx_audit_org_created on public.audit_logs(organization_id, created_at);

insert into public.schema_version(version, applied_at)
values (1, now())
on conflict (version) do update set applied_at = excluded.applied_at;

alter table public.schema_version enable row level security;
alter table public.organizations enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.rooms enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.staff_members enable row level security;
alter table public.duty_members enable row level security;
alter table public.check_items enable row level security;
alter table public.check_records enable row level security;
alter table public.check_record_items enable row level security;
alter table public.attachments enable row level security;
alter table public.admin_verifications enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.organizations, public.app_settings, public.admin_users, public.rooms, public.qr_tokens,
  public.staff_members, public.duty_members, public.check_items, public.check_records,
  public.check_record_items, public.attachments, public.admin_verifications, public.audit_logs
from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.schema_version to anon, authenticated;

drop policy if exists schema_version_read on public.schema_version;
create policy schema_version_read
on public.schema_version
for select
to anon, authenticated
using (true);

create or replace function qr_security.require_org(p_organization_code text)
returns public.organizations
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
begin
  select * into v_org
  from public.organizations
  where organization_code = p_organization_code and active = true;

  if not found then
    raise exception '학교 코드를 찾을 수 없습니다.' using errcode = '28000';
  end if;

  return v_org;
end;
$$;

create or replace function qr_security.require_desktop(p_organization_code text, p_desktop_sync_key text)
returns public.organizations
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
begin
  v_org := qr_security.require_org(p_organization_code);
  if coalesce(v_org.desktop_sync_key_hash, '') = '' then
    raise exception 'Desktop Sync Key hash가 설정되지 않았습니다.' using errcode = '28000';
  end if;
  if qr_security.hash_secret(p_desktop_sync_key, 'desktop') <> v_org.desktop_sync_key_hash then
    insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
    values (v_org.id, 'desktop', 'desktop_auth_failed', 'sync', '', '{}'::jsonb);
    raise exception 'Desktop Sync Key가 올바르지 않습니다.' using errcode = '28000';
  end if;
  return v_org;
end;
$$;

create or replace function qr_security.require_room_token(p_org_id uuid, p_room_id text, p_submit_token text)
returns public.rooms
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_room public.rooms;
begin
  select * into v_room
  from public.rooms
  where organization_id = p_org_id and room_id = p_room_id and active = true;

  if not found or coalesce(v_room.submit_token_hash, '') = ''
     or qr_security.hash_secret(p_submit_token, v_room.room_id) <> v_room.submit_token_hash then
    insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
    values (p_org_id, 'anonymous', 'submit_token_failed', 'room', coalesce(p_room_id, ''), '{}'::jsonb);
    raise exception '유효하지 않은 QR 코드입니다.' using errcode = '28000';
  end if;

  return v_room;
end;
$$;

create or replace function public.desktop_health(p_organization_code text, p_desktop_sync_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_version integer;
begin
  v_org := qr_security.require_desktop(p_organization_code, p_desktop_sync_key);
  select max(version) into v_version from public.schema_version;
  return jsonb_build_object(
    'ok', true,
    'organization_code', v_org.organization_code,
    'school_name', v_org.school_name,
    'schema_version', v_version
  );
end;
$$;

create or replace function public.get_submit_bootstrap(p_organization_code text, p_room_id text, p_submit_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_room public.rooms;
begin
  v_org := qr_security.require_org(p_organization_code);
  v_room := qr_security.require_room_token(v_org.id, p_room_id, p_submit_token);

  return jsonb_build_object(
    'school', jsonb_build_object('school_name', v_org.school_name, 'organization_code', v_org.organization_code),
    'room', jsonb_build_object('room_id', v_room.room_id, 'room_name', v_room.room_name, 'room_order', v_room.room_order),
    'people', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.role_type, p.sort_order, p.person_name), '[]'::jsonb)
      from (
        select person_id, name as person_name, 'responsible'::text as role_type, room_id, sort_order
        from public.staff_members
        where organization_id = v_org.id and active = true and (room_id = '' or room_id = v_room.room_id)
        union all
        select person_id, name as person_name, 'duty'::text as role_type, room_id, sort_order
        from public.duty_members
        where organization_id = v_org.id and active = true and (room_id = '' or room_id = v_room.room_id)
      ) p
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'item_id', item_id,
        'item_key', item_key,
        'item_name', label,
        'sort_order', sort_order
      ) order by sort_order, label), '[]'::jsonb)
      from public.check_items
      where organization_id = v_org.id and active = true
    )
  );
end;
$$;

create or replace function public.submit_check_record(p_organization_code text, p_room_id text, p_submit_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_room public.rooms;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_record_id text;
  v_record_uuid uuid;
  v_person_id text;
  v_role_type text;
  v_person_name text := '';
  v_status_json jsonb := '{}'::jsonb;
  v_status_out jsonb := '{}'::jsonb;
  v_item record;
  v_result text;
  v_abnormal boolean := false;
  v_attachment jsonb;
  v_attachment_id text;
  v_file_name text;
  v_storage_path text;
  v_uploads jsonb := '[]'::jsonb;
begin
  v_org := qr_security.require_org(p_organization_code);
  v_room := qr_security.require_room_token(v_org.id, p_room_id, p_submit_token);
  v_record_id := coalesce(nullif(v_payload->>'record_id', ''), 'rec_' || replace(gen_random_uuid()::text, '-', ''));
  v_person_id := coalesce(nullif(v_payload->>'person_id', ''), nullif(v_payload->>'personId', ''));
  v_role_type := coalesce(nullif(v_payload->>'role_type', ''), nullif(v_payload->>'roleType', ''), 'responsible');

  if v_role_type = 'duty' then
    select name into v_person_name
    from public.duty_members
    where organization_id = v_org.id and person_id = v_person_id and active = true
      and (room_id = '' or room_id = v_room.room_id);
  else
    select name into v_person_name
    from public.staff_members
    where organization_id = v_org.id and person_id = v_person_id and active = true
      and (room_id = '' or room_id = v_room.room_id);
  end if;

  if coalesce(v_person_name, '') = '' then
    raise exception '담당자 또는 당직자 정보를 확인할 수 없습니다.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_payload->'status_json') = 'object' then
    v_status_json := v_payload->'status_json';
  elsif jsonb_typeof(v_payload->'status') = 'object' then
    v_status_json := v_payload->'status';
  end if;

  for v_item in
    select item_id, item_key, label
    from public.check_items
    where organization_id = v_org.id and active = true
    order by sort_order, label
  loop
    v_result := coalesce(v_status_json->>v_item.item_key, '이상 무');
    if lower(v_result) in ('abnormal', 'bad', 'fail') or v_result in ('이상 유', '이상 있음') then
      v_result := '이상 유';
      v_abnormal := true;
    else
      v_result := '이상 무';
    end if;
    v_status_out := v_status_out || jsonb_build_object(v_item.item_key, v_result);
  end loop;

  insert into public.check_records(
    organization_id, record_id, room_id, room_name, checker_id, checker_name,
    duty_id, duty_name, submitted_at, inspection_date, status, status_json,
    note, client_info, source, created_at, updated_at
  )
  values (
    v_org.id,
    v_record_id,
    v_room.room_id,
    v_room.room_name,
    case when v_role_type = 'duty' then '' else v_person_id end,
    case when v_role_type = 'duty' then '' else v_person_name end,
    case when v_role_type = 'duty' then v_person_id else '' end,
    case when v_role_type = 'duty' then v_person_name else '' end,
    now(),
    (now() at time zone 'Asia/Seoul')::date,
    case when v_abnormal then 'abnormal' else 'normal' end,
    v_status_out,
    left(coalesce(v_payload->>'remarks', v_payload->>'note', ''), 1000),
    case when jsonb_typeof(v_payload->'client_info') = 'object' then v_payload->'client_info' else '{}'::jsonb end,
    'mobile',
    now(),
    now()
  )
  on conflict (organization_id, record_id) do nothing
  returning id into v_record_uuid;

  if v_record_uuid is null then
    select id into v_record_uuid from public.check_records where organization_id = v_org.id and record_id = v_record_id;
    return jsonb_build_object('record_id', v_record_id, 'duplicate', true, 'attachments', '[]'::jsonb);
  end if;

  for v_item in
    select item_id, item_key, label
    from public.check_items
    where organization_id = v_org.id and active = true
    order by sort_order, label
  loop
    insert into public.check_record_items(record_id, item_id, item_label, result, memo)
    values (v_record_uuid, v_item.item_id, v_item.label, v_status_out->>v_item.item_key, '');
  end loop;

  if jsonb_typeof(v_payload->'attachments') = 'array' then
    for v_attachment in select value from jsonb_array_elements(v_payload->'attachments')
    loop
      v_attachment_id := 'att_' || replace(gen_random_uuid()::text, '-', '');
      v_file_name := left(coalesce(v_attachment->>'file_name', v_attachment->>'name', 'file'), 180);
      v_storage_path := v_org.organization_code || '/' || v_record_id || '/' || v_attachment_id || '_' ||
        regexp_replace(v_file_name, '[^0-9A-Za-z가-힣_.-]+', '_', 'g');
      insert into public.attachments(record_id, attachment_id, item_key, file_name, mime_type, file_size, storage_path)
      values (
        v_record_uuid,
        v_attachment_id,
        left(coalesce(v_attachment->>'item_key', ''), 120),
        v_file_name,
        left(coalesce(v_attachment->>'mime_type', v_attachment->>'type', ''), 120),
        greatest(coalesce(nullif(v_attachment->>'file_size', '')::integer, coalesce(nullif(v_attachment->>'size', '')::integer, 0)), 0),
        v_storage_path
      );
      v_uploads := v_uploads || jsonb_build_array(jsonb_build_object(
        'attachment_id', v_attachment_id,
        'file_name', v_file_name,
        'storage_path', v_storage_path
      ));
    end loop;
  end if;

  insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
  values (v_org.id, coalesce(v_person_name, 'anonymous'), 'submit_create', 'submission', v_record_id, jsonb_build_object('room_id', v_room.room_id, 'abnormal', v_abnormal));

  return jsonb_build_object('record_id', v_record_id, 'duplicate', false, 'abnormal', v_abnormal, 'attachments', v_uploads);
end;
$$;

create or replace function public.desktop_pull(p_organization_code text, p_desktop_sync_key text, p_since text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_since timestamptz;
begin
  v_org := qr_security.require_desktop(p_organization_code, p_desktop_sync_key);
  v_since := nullif(p_since, '')::timestamptz;

  insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
  values (v_org.id, 'desktop', 'desktop_sync_pull', 'sync', coalesce(p_since, 'full'), '{}'::jsonb);

  return jsonb_build_object(
    'next_since', (now() - interval '30 seconds')::text,
    'settings_school', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.key), '[]'::jsonb)
      from (
        select 'school_name'::text as key, v_org.school_name::text as value, v_org.updated_at
        union all
        select key, value, updated_at from public.app_settings where organization_id = v_org.id
      ) s
      where v_since is null or s.updated_at > v_since
    ),
    'settings_admins', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'admin_id', id::text, 'email', email, 'name', display_name, 'role', role,
        'active', active, 'created_at', created_at::text, 'updated_at', updated_at::text
      ) order by email), '[]'::jsonb)
      from public.admin_users
      where organization_id = v_org.id and (v_since is null or updated_at > v_since)
    ),
    'settings_rooms', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'room_id', room_id, 'room_name', room_name, 'room_order', room_order,
        'submit_token_hash', submit_token_hash, 'active', active,
        'created_at', created_at::text, 'updated_at', updated_at::text
      ) order by room_order, room_name), '[]'::jsonb)
      from public.rooms
      where organization_id = v_org.id and (v_since is null or updated_at > v_since)
    ),
    'settings_people', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.role_type, p.sort_order, p.person_name), '[]'::jsonb)
      from (
        select person_id, name as person_name, 'responsible'::text as role_type, room_id, active, sort_order, created_at::text, updated_at::text
        from public.staff_members
        where organization_id = v_org.id and (v_since is null or updated_at > v_since)
        union all
        select person_id, name as person_name, 'duty'::text as role_type, room_id, active, sort_order, created_at::text, updated_at::text
        from public.duty_members
        where organization_id = v_org.id and (v_since is null or updated_at > v_since)
      ) p
    ),
    'settings_check_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'item_id', item_id, 'item_key', item_key, 'item_name', label,
        'sort_order', sort_order, 'active', active,
        'created_at', created_at::text, 'updated_at', updated_at::text
      ) order by sort_order, label), '[]'::jsonb)
      from public.check_items
      where organization_id = v_org.id and (v_since is null or updated_at > v_since)
    ),
    'submissions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'record_id', record_id,
        'submitted_at', submitted_at::text,
        'inspection_date', inspection_date::text,
        'room_id', room_id,
        'room_name', room_name,
        'person_id', coalesce(nullif(checker_id, ''), duty_id),
        'person_name', coalesce(nullif(checker_name, ''), duty_name),
        'role_type', case when duty_id <> '' then 'duty' else 'responsible' end,
        'status_json', status_json,
        'abnormal', status = 'abnormal',
        'remarks', note,
        'client_info', client_info::text,
        'source', source,
        'admin_verified', admin_verified,
        'admin_verified_by', admin_verified_by,
        'admin_verified_at', coalesce(admin_verified_at::text, ''),
        'admin_memo', admin_memo,
        'created_at', created_at::text,
        'updated_at', updated_at::text
      ) order by submitted_at), '[]'::jsonb)
      from public.check_records
      where organization_id = v_org.id and (v_since is null or updated_at > v_since)
    ),
    'attachments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'attachment_id', a.attachment_id,
        'record_id', r.record_id,
        'item_key', a.item_key,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'file_size', a.file_size,
        'drive_file_id', '',
        'drive_url', '',
        'storage_path', a.storage_path,
        'created_at', a.created_at::text
      ) order by a.created_at), '[]'::jsonb)
      from public.attachments a
      join public.check_records r on r.id = a.record_id
      where r.organization_id = v_org.id and (v_since is null or a.created_at > v_since)
    )
  );
end;
$$;

create or replace function public.desktop_push_settings(
  p_organization_code text,
  p_desktop_sync_key text,
  p_rooms jsonb default '[]'::jsonb,
  p_people jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_base_since text default '',
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_row jsonb;
  v_role text;
begin
  v_org := qr_security.require_desktop(p_organization_code, p_desktop_sync_key);

  for v_row in select value from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb))
  loop
    insert into public.rooms(organization_id, room_id, room_name, room_order, submit_token_hash, active, created_at, updated_at)
    values (
      v_org.id,
      v_row->>'room_id',
      coalesce(v_row->>'room_name', ''),
      coalesce(nullif(v_row->>'room_order', '')::integer, 100),
      coalesce(v_row->>'submit_token_hash', ''),
      qr_security.json_bool(v_row->'active', true),
      coalesce(nullif(v_row->>'created_at', '')::timestamptz, now()),
      now()
    )
    on conflict (organization_id, room_id) do update set
      room_name = excluded.room_name,
      room_order = excluded.room_order,
      submit_token_hash = excluded.submit_token_hash,
      active = excluded.active,
      updated_at = now();
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_people, '[]'::jsonb))
  loop
    v_role := coalesce(v_row->>'role_type', 'responsible');
    if v_role = 'duty' then
      insert into public.duty_members(organization_id, person_id, name, room_id, active, sort_order, created_at, updated_at)
      values (v_org.id, v_row->>'person_id', coalesce(v_row->>'person_name', ''), coalesce(v_row->>'room_id', ''),
        qr_security.json_bool(v_row->'active', true), coalesce(nullif(v_row->>'sort_order', '')::integer, 100),
        coalesce(nullif(v_row->>'created_at', '')::timestamptz, now()), now())
      on conflict (organization_id, person_id) do update set
        name = excluded.name, room_id = excluded.room_id, active = excluded.active, sort_order = excluded.sort_order, updated_at = now();
    else
      insert into public.staff_members(organization_id, person_id, name, room_id, active, sort_order, created_at, updated_at)
      values (v_org.id, v_row->>'person_id', coalesce(v_row->>'person_name', ''), coalesce(v_row->>'room_id', ''),
        qr_security.json_bool(v_row->'active', true), coalesce(nullif(v_row->>'sort_order', '')::integer, 100),
        coalesce(nullif(v_row->>'created_at', '')::timestamptz, now()), now())
      on conflict (organization_id, person_id) do update set
        name = excluded.name, room_id = excluded.room_id, active = excluded.active, sort_order = excluded.sort_order, updated_at = now();
    end if;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.check_items(organization_id, item_id, item_key, label, sort_order, active, created_at, updated_at)
    values (
      v_org.id,
      v_row->>'item_id',
      coalesce(v_row->>'item_key', v_row->>'item_id'),
      coalesce(v_row->>'item_name', v_row->>'label', ''),
      coalesce(nullif(v_row->>'sort_order', '')::integer, 100),
      qr_security.json_bool(v_row->'active', true),
      coalesce(nullif(v_row->>'created_at', '')::timestamptz, now()),
      now()
    )
    on conflict (organization_id, item_id) do update set
      item_key = excluded.item_key,
      label = excluded.label,
      sort_order = excluded.sort_order,
      active = excluded.active,
      updated_at = now();
  end loop;

  insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
  values (v_org.id, 'desktop', 'desktop_push_settings', 'sync', 'settings', jsonb_build_object('force', p_force));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.desktop_verify_record(
  p_organization_code text,
  p_desktop_sync_key text,
  p_record_id text,
  p_admin_email text default 'desktop',
  p_admin_memo text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_record public.check_records;
begin
  v_org := qr_security.require_desktop(p_organization_code, p_desktop_sync_key);
  select * into v_record from public.check_records where organization_id = v_org.id and record_id = p_record_id;
  if not found then
    raise exception '기록을 찾을 수 없습니다.' using errcode = '22023';
  end if;

  update public.check_records
  set admin_verified = true,
      admin_verified_by = coalesce(nullif(p_admin_email, ''), 'desktop'),
      admin_verified_at = now(),
      admin_memo = coalesce(p_admin_memo, ''),
      updated_at = now()
  where id = v_record.id;

  insert into public.admin_verifications(organization_id, record_id, admin_email, admin_memo)
  values (v_org.id, v_record.id, coalesce(nullif(p_admin_email, ''), 'desktop'), coalesce(p_admin_memo, ''));

  insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
  values (v_org.id, coalesce(nullif(p_admin_email, ''), 'desktop'), 'desktop_verify_record', 'submission', p_record_id, '{}'::jsonb);

  return jsonb_build_object('record_id', p_record_id, 'admin_verified', true);
end;
$$;

create or replace function public.desktop_bulk_verify_normal(
  p_organization_code text,
  p_desktop_sync_key text,
  p_start_date text,
  p_end_date text,
  p_room_id text default '',
  p_admin_email text default 'desktop'
)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
  v_count integer;
begin
  v_org := qr_security.require_desktop(p_organization_code, p_desktop_sync_key);

  update public.check_records
  set admin_verified = true,
      admin_verified_by = coalesce(nullif(p_admin_email, ''), 'desktop'),
      admin_verified_at = now(),
      updated_at = now()
  where organization_id = v_org.id
    and inspection_date between p_start_date::date and p_end_date::date
    and (coalesce(p_room_id, '') = '' or room_id = p_room_id)
    and status = 'normal'
    and admin_verified = false;

  get diagnostics v_count = row_count;

  insert into public.audit_logs(organization_id, actor, action, target_type, target_id, detail_json)
  values (v_org.id, coalesce(nullif(p_admin_email, ''), 'desktop'), 'desktop_bulk_verify_normal', 'submission', p_start_date || ':' || p_end_date, jsonb_build_object('count', v_count));

  return jsonb_build_object('count', v_count);
end;
$$;

create or replace function public.desktop_backup(p_organization_code text, p_desktop_sync_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, qr_security, extensions
as $$
declare
  v_org public.organizations;
begin
  v_org := qr_security.require_desktop(p_organization_code, p_desktop_sync_key);
  return (public.desktop_pull(p_organization_code, p_desktop_sync_key, '')::jsonb)
    || jsonb_build_object(
      'check_record_items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'record_id', r.record_id,
          'item_id', i.item_id,
          'item_label', i.item_label,
          'result', i.result,
          'memo', i.memo,
          'created_at', i.created_at::text
        ) order by r.submitted_at, i.item_label), '[]'::jsonb)
        from public.check_record_items i
        join public.check_records r on r.id = i.record_id
        where r.organization_id = v_org.id
      ),
      'admin_verifications', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'record_id', r.record_id,
          'admin_email', v.admin_email,
          'admin_memo', v.admin_memo,
          'verified_at', v.verified_at::text
        ) order by v.verified_at), '[]'::jsonb)
        from public.admin_verifications v
        join public.check_records r on r.id = v.record_id
        where v.organization_id = v_org.id
      ),
      'audit_logs', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', id::text,
          'actor', actor,
          'action', action,
          'target_type', target_type,
          'target_id', target_id,
          'detail_json', detail_json,
          'created_at', created_at::text
        ) order by created_at), '[]'::jsonb)
        from public.audit_logs
        where organization_id = v_org.id
      )
    );
end;
$$;

grant execute on function public.desktop_health(text, text) to anon, authenticated;
grant execute on function public.get_submit_bootstrap(text, text, text) to anon, authenticated;
grant execute on function public.submit_check_record(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.desktop_pull(text, text, text) to anon, authenticated;
grant execute on function public.desktop_push_settings(text, text, jsonb, jsonb, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.desktop_verify_record(text, text, text, text, text) to anon, authenticated;
grant execute on function public.desktop_bulk_verify_normal(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.desktop_backup(text, text) to anon, authenticated;

insert into storage.buckets(id, name, public)
values ('check-attachments', 'check-attachments', false)
on conflict (id) do nothing;

drop policy if exists "qr attachment anon insert" on storage.objects;
create policy "qr attachment anon insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'check-attachments'
  and exists (
    select 1
    from public.attachments a
    where a.storage_path = storage.objects.name
  )
);

commit;

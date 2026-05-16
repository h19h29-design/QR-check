-- Optional sample data for a new Supabase project.
-- Change the organization code, school name, and desktop key before using this
-- in a real school. The desktop key below is: change-me-desktop-key

begin;

insert into public.organizations(organization_code, school_name, desktop_sync_key_hash)
values (
  'school-2026',
  '샘플학교',
  qr_security.hash_secret('change-me-desktop-key', 'desktop')
)
on conflict (organization_code) do update set
  school_name = excluded.school_name,
  desktop_sync_key_hash = excluded.desktop_sync_key_hash,
  updated_at = now();

with org as (
  select id from public.organizations where organization_code = 'school-2026'
)
insert into public.check_items(organization_id, item_id, item_key, label, sort_order)
select org.id, item_id, item_key, label, sort_order
from org
cross join (
  values
    ('item_document', 'document', '서류보관상태', 10),
    ('item_cleaning', 'cleaning', '청소상태', 20),
    ('item_lighting', 'lighting', '소등상태', 30),
    ('item_fire', 'fire', '화기단속상태', 40),
    ('item_door', 'door', '문단속상태', 50)
) as v(item_id, item_key, label, sort_order)
on conflict (organization_id, item_id) do update set
  item_key = excluded.item_key,
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

with org as (
  select id from public.organizations where organization_code = 'school-2026'
)
insert into public.rooms(organization_id, room_id, room_name, room_order, submit_token_hash)
select org.id, 'room_sample_1', '샘플 교무실', 10, qr_security.hash_secret('sample-submit-token', 'room_sample_1')
from org
on conflict (organization_id, room_id) do update set
  room_name = excluded.room_name,
  room_order = excluded.room_order,
  submit_token_hash = excluded.submit_token_hash,
  active = true,
  updated_at = now();

with org as (
  select id from public.organizations where organization_code = 'school-2026'
)
insert into public.staff_members(organization_id, person_id, name, room_id, sort_order)
select org.id, 'person_sample_staff', '샘플 담당자', '', 10
from org
on conflict (organization_id, person_id) do update set
  name = excluded.name,
  room_id = excluded.room_id,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

with org as (
  select id from public.organizations where organization_code = 'school-2026'
)
insert into public.duty_members(organization_id, person_id, name, room_id, sort_order)
select org.id, 'person_sample_duty', '샘플 당직자', '', 20
from org
on conflict (organization_id, person_id) do update set
  name = excluded.name,
  room_id = excluded.room_id,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

commit;

-- RLS policy reference for QR보안점검표 관리자 Supabase mode.
-- setup_supabase.sql already includes these policies. This file is provided
-- so school administrators can review the access model separately.

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

drop policy if exists schema_version_read on public.schema_version;
create policy schema_version_read
on public.schema_version
for select
to anon, authenticated
using (true);

-- All other application tables intentionally have no broad anon SELECT/INSERT/
-- UPDATE/DELETE policies. Public submit and desktop admin access go through
-- SECURITY DEFINER RPC functions that validate room submit tokens or Desktop
-- Sync Key hashes before reading or writing rows.

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

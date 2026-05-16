-- Development reset helper. Do not run this on a real school project unless
-- you intentionally want to delete the selected organization's QR data.

begin;

-- Change this value before running.
do $$
declare
  v_org_code text := 'school-2026';
  v_org_id uuid;
begin
  select id into v_org_id from public.organizations where organization_code = v_org_code;
  if v_org_id is null then
    raise notice 'organization % not found', v_org_code;
    return;
  end if;

  delete from public.audit_logs where organization_id = v_org_id;
  delete from public.admin_verifications where organization_id = v_org_id;
  delete from public.check_records where organization_id = v_org_id;
  delete from public.check_items where organization_id = v_org_id;
  delete from public.staff_members where organization_id = v_org_id;
  delete from public.duty_members where organization_id = v_org_id;
  delete from public.qr_tokens where organization_id = v_org_id;
  delete from public.rooms where organization_id = v_org_id;
  delete from public.admin_users where organization_id = v_org_id;
  delete from public.app_settings where organization_id = v_org_id;
  delete from public.organizations where id = v_org_id;
end $$;

commit;

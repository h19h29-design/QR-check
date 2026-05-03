function desktopSyncPull_(payload) {
  verifyDesktop_(payload || {});
  const nextSince = nowIso_();
  const since = payload.since || '';
  function changed(row) {
    return !since || String(row.updated_at || row.created_at || '') > since;
  }
  const data = {
    next_since: nextSince,
    settings_school: readTable_('settings_school'),
    settings_admins: readTable_('settings_admins').filter(changed),
    settings_rooms: readTable_('settings_rooms').filter(changed),
    settings_people: readTable_('settings_people').filter(changed),
    settings_check_items: readTable_('settings_check_items').filter(changed),
    submissions: readTable_('submissions').filter(changed),
    attachments: readTable_('attachments')
  };
  logAudit_('desktop', 'desktop_sync_pull', 'sync', since || 'full', {
    submissions: data.submissions.length
  });
  return data;
}

function desktopPushSettings_(payload) {
  verifyDesktop_(payload || {});
  const now = nowIso_();
  (payload.rooms || []).forEach(function(room) {
    room.updated_at = now;
    upsertObject_('settings_rooms', room, 'room_id');
  });
  (payload.people || []).forEach(function(person) {
    person.updated_at = now;
    upsertObject_('settings_people', person, 'person_id');
  });
  (payload.items || []).forEach(function(item) {
    item.updated_at = now;
    upsertObject_('settings_check_items', item, 'item_id');
  });
  logAudit_('desktop', 'desktop_push_settings', 'sync', 'settings', {});
  return { ok: true };
}

function desktopVerifyRecord_(payload) {
  verifyDesktop_(payload || {});
  const record = findBy_('submissions', 'record_id', payload.record_id);
  if (!record) throw new Error('기록을 찾을 수 없습니다.');
  record.admin_verified = true;
  record.admin_verified_by = 'desktop';
  record.admin_verified_at = nowIso_();
  record.admin_memo = payload.admin_memo || payload.adminMemo || '';
  record.updated_at = nowIso_();
  upsertObject_('submissions', record, 'record_id');
  logAudit_('desktop', 'desktop_verify_record', 'submission', record.record_id, { abnormal: record.abnormal });
  return { record_id: record.record_id, admin_verified: true };
}

function desktopBulkVerifyNormal_(payload) {
  verifyDesktop_(payload || {});
  const rows = filterAdminSubmissions_(readTable_('submissions'), Object.assign({}, payload || {}, { state: '' }));
  let count = 0;
  rows.forEach(function(row) {
    if (!truthy_(row.abnormal) && !truthy_(row.admin_verified)) {
      row.admin_verified = true;
      row.admin_verified_by = 'desktop';
      row.admin_verified_at = nowIso_();
      row.updated_at = nowIso_();
      upsertObject_('submissions', row, 'record_id');
      count++;
    }
  });
  logAudit_('desktop', 'desktop_bulk_verify_normal', 'submission', filterLabel_(payload || {}), { count: count });
  return { count: count };
}

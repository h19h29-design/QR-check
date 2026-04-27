function adminBootstrap(payload) {
  const auth = verifyAdmin_(payload || {});
  return Object.assign(bootstrapForClient_(), { auth: auth });
}

function adminListSubmissions_(payload) {
  verifyAdmin_(payload || {});
  const rows = filterAdminSubmissions_(readTable_('submissions'), payload || {})
    .sort(function(a, b) { return String(b.submitted_at).localeCompare(String(a.submitted_at)); });
  return {
    submissions: rows,
    attachments: readTable_('attachments'),
    rooms: readTable_('settings_rooms').filter(activeRow_)
  };
}

function adminGetDetail_(payload) {
  verifyAdmin_(payload || {});
  const record = findBy_('submissions', 'record_id', payload.record_id);
  if (!record) throw new Error('기록을 찾을 수 없습니다.');
  const attachments = readTable_('attachments').filter(function(row) { return row.record_id === payload.record_id; });
  return { record: record, attachments: attachments };
}

function adminVerifyRecord_(payload) {
  const auth = verifyAdmin_(payload || {});
  const record = findBy_('submissions', 'record_id', payload.record_id);
  if (!record) throw new Error('기록을 찾을 수 없습니다.');
  record.admin_verified = true;
  record.admin_verified_by = auth.actor;
  record.admin_verified_at = nowIso_();
  record.admin_memo = payload.admin_memo || payload.adminMemo || '';
  record.updated_at = nowIso_();
  upsertObject_('submissions', record, 'record_id');
  logAudit_(auth.actor, 'admin_verify_record', 'submission', record.record_id, { abnormal: record.abnormal });
  return { record_id: record.record_id, admin_verified: true };
}

function adminBulkVerifyNormal_(payload) {
  const auth = verifyAdmin_(payload || {});
  const rows = filterAdminSubmissions_(readTable_('submissions'), Object.assign({}, payload || {}, { state: '' }));
  let count = 0;
  rows.forEach(function(row) {
    if (!truthy_(row.abnormal) && !truthy_(row.admin_verified)) {
      row.admin_verified = true;
      row.admin_verified_by = auth.actor;
      row.admin_verified_at = nowIso_();
      row.updated_at = nowIso_();
      upsertObject_('submissions', row, 'record_id');
      count++;
    }
  });
  logAudit_(auth.actor, 'admin_bulk_verify_normal', 'submission', filterLabel_(payload || {}), { count: count });
  return { count: count };
}

function saveRoomFromAdmin(payload) {
  const auth = verifyAdmin_(payload || {});
  const now = nowIso_();
  const roomId = payload.room_id || uuid_('room');
  const token = payload.submitToken || Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const row = {
    room_id: roomId,
    room_name: payload.room_name,
    room_order: payload.room_order || 100,
    submit_token_hash: hashToken_(token, roomId),
    active: payload.active !== false,
    created_at: payload.created_at || now,
    updated_at: now
  };
  upsertObject_('settings_rooms', row, 'room_id');
  logAudit_(auth.actor, 'admin_save_room', 'room', roomId, {});
  return { room: row, submitToken: token };
}

function exportCsv_(params) {
  verifyAdmin_(params || {});
  const rows = filterAdminSubmissions_(readTable_('submissions'), params || {});
  const headers = SHEET_SCHEMAS.submissions;
  const csv = '\ufeff' + [headers.join(',')].concat(rows.map(function(row) {
    return headers.map(function(h) {
      const value = String(row[h] == null ? '' : row[h]).replace(/"/g, '""');
      return '"' + value + '"';
    }).join(',');
  })).join('\r\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

function filterAdminSubmissions_(rows, payload) {
  const singleDate = payload.inspection_date || payload.date || '';
  const startDate = payload.start_date || payload.startDate || singleDate || today_();
  const endDate = payload.end_date || payload.endDate || singleDate || startDate;
  const roomId = payload.room_id || payload.roomId || '';
  const state = payload.state || payload.status || '';
  return rows.filter(function(row) {
    const rowDate = dateText_(row.inspection_date);
    if (startDate && rowDate < startDate) return false;
    if (endDate && rowDate > endDate) return false;
    if (roomId && String(row.room_id) !== String(roomId)) return false;
    if (state === 'abnormal' || state === '이상 있음') return truthy_(row.abnormal);
    if (state === 'normal' || state === '이상 없음') return !truthy_(row.abnormal);
    if (state === 'unverified' || state === '미확인') return !truthy_(row.admin_verified);
    if (state === 'verified' || state === '확인 완료') return truthy_(row.admin_verified);
    return true;
  });
}

function dateText_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function truthy_(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function filterLabel_(payload) {
  const singleDate = payload.inspection_date || payload.date || '';
  const startDate = payload.start_date || payload.startDate || singleDate || today_();
  const endDate = payload.end_date || payload.endDate || singleDate || startDate;
  const roomId = payload.room_id || payload.roomId || 'all_rooms';
  return startDate + '~' + endDate + ':' + roomId;
}

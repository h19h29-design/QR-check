function adminBootstrap_(payload) {
  const auth = verifyAdmin_(payload || {});
  return Object.assign(bootstrapForClient_(), { auth: auth });
}

function adminListSubmissions_(payload) {
  verifyAdmin_(payload || {});
  const rows = filterAdminSubmissions_(readTable_('submissions'), payload || {})
    .sort(function(a, b) { return String(b.submitted_at).localeCompare(String(a.submitted_at)); });
  const recordIds = rows.reduce(function(acc, row) {
    acc[String(row.record_id)] = true;
    return acc;
  }, {});
  return {
    server_date: today_(),
    submissions: rows,
    attachments: readTable_('attachments').filter(function(row) { return recordIds[String(row.record_id)]; }),
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

function saveRoomFromAdmin_(payload) {
  const auth = verifyAdmin_(payload || {});
  const now = nowIso_();
  const roomId = payload.room_id || uuid_('room');
  const existing = payload.room_id ? findBy_('settings_rooms', 'room_id', payload.room_id) : null;
  // 실 이름·순서·활성 수정은 기존 QR 토큰을 유지한다. 토큰 교체는 reissueRoomTokenFromAdmin_ 전용.
  let tokenHash = existing ? String(existing.submit_token_hash || '') : '';
  let plainToken = '';
  if (!existing || !tokenHash) {
    plainToken = payload.submitToken
      || Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    tokenHash = hashToken_(plainToken, roomId);
  }
  const row = {
    room_id: roomId,
    room_name: payload.room_name,
    room_order: payload.room_order || (existing ? existing.room_order : 100),
    submit_token_hash: tokenHash,
    active: payload.active !== false,
    created_at: (existing && existing.created_at) || payload.created_at || now,
    updated_at: now,
    token_version: existing ? tokenVersion_(existing) : 1
  };
  upsertObject_('settings_rooms', row, 'room_id');
  logAudit_(auth.actor, 'admin_save_room', 'room', roomId, { token_kept: !plainToken });
  const result = { room: row, token_kept: !plainToken };
  if (plainToken) result.submitToken = plainToken;
  return result;
}

/** QR 토큰 명시적 재발급. 이전 토큰은 즉시 무효가 되며 이름을 바꿔도 호출되지 않는다. */
function reissueRoomTokenFromAdmin_(payload) {
  const auth = verifyAdmin_(payload || {});
  const roomId = payload && (payload.room_id || payload.roomId);
  if (!roomId) throw new Error('재발급할 실을 지정하세요.');
  const existing = findBy_('settings_rooms', 'room_id', roomId);
  if (!existing) throw new Error('실을 찾을 수 없습니다.');
  const plainToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  existing.submit_token_hash = hashToken_(plainToken, roomId);
  existing.token_version = tokenVersion_(existing) + 1;
  existing.updated_at = nowIso_();
  upsertObject_('settings_rooms', existing, 'room_id');
  logAudit_(auth.actor, 'admin_reissue_room_token', 'room', roomId, { token_version: existing.token_version });
  return { room_id: roomId, token_version: existing.token_version, submitToken: plainToken };
}

/** 저장 미완료(PARTIAL/DISCARDED 제외·COMMITTED 제외) 기록 목록. */
function adminListPartials_(payload) {
  verifyAdmin_(payload || {});
  const rows = readTable_('submissions')
    .filter(function(row) { return saveState_(row) === 'PARTIAL'; })
    .sort(function(a, b) { return String(b.submitted_at).localeCompare(String(a.submitted_at)); });
  return { server_date: today_(), partials: rows };
}

/**
 * PARTIAL 복구 확인. 관리자가 첨부·내용을 눈으로 확인한 뒤 확정 상태로 되돌린다.
 * 파일을 다시 만들지 않으며, 기존 확정 자료를 지우지 않는다.
 */
function adminReconcileRecord_(payload) {
  const auth = verifyAdmin_(payload || {});
  const recordId = payload && (payload.record_id || payload.recordId);
  const record = findBy_('submissions', 'record_id', recordId);
  if (!record) throw new Error('기록을 찾을 수 없습니다.');
  if (saveState_(record) === 'COMMITTED') {
    return { record_id: record.record_id, save_state: 'COMMITTED', changed: false };
  }
  if (saveState_(record) === 'DISCARDED') throw new Error('이미 정리된 기록입니다.');
  const attachments = readTable_('attachments').filter(function(row) { return String(row.record_id) === String(recordId); });
  record.save_state = 'COMMITTED';
  record.admin_memo = (record.admin_memo ? String(record.admin_memo) + '\n' : '') +
    '[복구확인 ' + nowIso_() + '] 첨부 ' + attachments.length + '건 확인';
  record.updated_at = nowIso_();
  upsertObject_('submissions', record, 'record_id');
  logAudit_(auth.actor, 'admin_reconcile_partial', 'submission', record.record_id, { attachments: attachments.length });
  return { record_id: record.record_id, save_state: 'COMMITTED', changed: true, attachments: attachments.length };
}

/**
 * PARTIAL 정리. 명시적 confirm 없이는 동작하지 않으며 행을 삭제하지 않고 DISCARDED로 표시한다.
 * 일반 조회·엑셀에서 제외되지만 감사 추적용으로 남는다.
 */
function adminDiscardPartial_(payload) {
  const auth = verifyAdmin_(payload || {});
  if (!payload || payload.confirm !== true) throw new Error('정리하려면 확인 표시(confirm)가 필요합니다.');
  const recordId = payload.record_id || payload.recordId;
  const record = findBy_('submissions', 'record_id', recordId);
  if (!record) throw new Error('기록을 찾을 수 없습니다.');
  if (saveState_(record) === 'COMMITTED') throw new Error('확정된 기록은 정리할 수 없습니다.');
  record.save_state = 'DISCARDED';
  record.updated_at = nowIso_();
  upsertObject_('submissions', record, 'record_id');
  logAudit_(auth.actor, 'admin_discard_partial', 'submission', record.record_id, {});
  return { record_id: record.record_id, save_state: 'DISCARDED' };
}

function exportCsv_(params) {
  verifyAdmin_(params || {});
  const csv = buildAdminCsv_(params || {});
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

function adminCsvForUi(payload) {
  verifyAdmin_(payload || {});
  return {
    file_name: 'qr_security_submissions_' + today_().replace(/-/g, '') + '.csv',
    csv: buildAdminCsv_(payload || {})
  };
}

function buildAdminCsv_(params) {
  const rows = filterAdminSubmissions_(readTable_('submissions'), params || {});
  const headers = SHEET_SCHEMAS.submissions;
  const csv = '\ufeff' + [headers.join(',')].concat(rows.map(function(row) {
    return headers.map(function(h) { return csvCell_(row[h]); }).join(',');
  })).join('\r\n');
  return csv;
}

function csvCell_(value) {
  let text = String(value == null ? '' : value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function filterAdminSubmissions_(rows, payload) {
  const singleDate = payload.inspection_date || payload.date || '';
  const startDate = payload.start_date || payload.startDate || singleDate || today_();
  const endDate = payload.end_date || payload.endDate || singleDate || startDate;
  const roomId = payload.room_id || payload.roomId || '';
  const state = payload.state || payload.status || '';
  return rows.filter(function(row) {
    if (saveState_(row) === 'DISCARDED') return false;
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

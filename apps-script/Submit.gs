function getSubmitBootstrap_(payload) {
  const roomId = payload.roomId || payload.room_id;
  const submitToken = payload.submitToken || payload.submit_token;
  const room = validateRoomToken_(roomId, submitToken);
  const bootstrap = bootstrapForClient_();
  const people = bootstrap.people.filter(function(p) { return !p.room_id || p.room_id === room.room_id; });
  return { school: bootstrap.school, room: room, people: people, items: bootstrap.items };
}

function validateRoomToken_(roomId, submitToken) {
  const room = findBy_('settings_rooms', 'room_id', roomId);
  if (!room || !activeRow_(room)) throw new Error('유효하지 않은 QR 코드입니다.');
  const expected = String(room.submit_token_hash || '');
  if (!submitToken || hashToken_(submitToken, room.room_id) !== expected) {
    logAudit_('anonymous', 'submit_token_failed', 'room', roomId, {});
    throw new Error('유효하지 않은 QR 코드입니다.');
  }
  return room;
}

function submitInspection_(payload) {
  const room = validateRoomToken_(payload.room_id || payload.roomId, payload.submit_token || payload.submitToken);
  const recordId = payload.record_id || uuid_('rec');
  if (findBy_('submissions', 'record_id', recordId)) {
    return { record_id: recordId, duplicate: true };
  }
  const now = nowIso_();
  const status = payload.status_json || payload.status || {};
  const abnormal = Object.keys(status).some(function(key) { return status[key] === '이상 유'; });
  const personId = payload.person_id || '';
  const personName = payload.person_name || '';
  const roleType = payload.role_type || '';
  const row = {
    record_id: recordId,
    submitted_at: now,
    inspection_date: payload.inspection_date || today_(),
    room_id: room.room_id,
    room_name: room.room_name,
    person_id: personId,
    person_name: personName,
    role_type: roleType,
    status_json: JSON.stringify(status),
    abnormal: abnormal,
    remarks: payload.remarks || '',
    client_info: JSON.stringify(payload.client_info || {}),
    source: 'mobile',
    admin_verified: false,
    admin_verified_by: '',
    admin_verified_at: '',
    admin_memo: '',
    desktop_synced: false,
    desktop_synced_at: '',
    created_at: now,
    updated_at: now
  };
  appendObject_('submissions', row);
  const attachments = [];
  const files = payload.attachments || {};
  Object.keys(files).forEach(function(itemKey) {
    const uploaded = uploadAttachment_(recordId, itemKey, files[itemKey]);
    if (uploaded) attachments.push(uploaded);
  });
  logAudit_(personName || 'anonymous', 'submit_create', 'submission', recordId, { room_id: room.room_id, abnormal: abnormal });
  return { record_id: recordId, duplicate: false, abnormal: abnormal, attachments: attachments };
}


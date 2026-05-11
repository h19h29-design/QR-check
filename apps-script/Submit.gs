const STATUS_NORMAL = '이상 무';
const STATUS_ABNORMAL = '이상 유';
const MAX_REMARKS_LENGTH = 1000;
const MAX_CLIENT_INFO_LENGTH = 1000;
const MAX_ATTACHMENTS_PER_SUBMISSION = 10;

function getSubmitBootstrap_(payload) {
  const roomId = payload.roomId || payload.room_id;
  const submitToken = payload.submitToken || payload.submit_token;
  const room = validateRoomToken_(roomId, submitToken);
  const bootstrap = bootstrapForClient_();
  const people = bootstrap.people.filter(function(p) { return !p.room_id || p.room_id === room.room_id; });
  return {
    school: publicSchoolSettings_(bootstrap.school),
    room: { room_id: room.room_id, room_name: room.room_name, room_order: room.room_order },
    people: people.map(function(p) {
      return { person_id: p.person_id, person_name: p.person_name, role_type: p.role_type, room_id: p.room_id || '', sort_order: p.sort_order || 100 };
    }),
    items: bootstrap.items.map(function(item) {
      return { item_id: item.item_id, item_key: item.item_key, item_name: item.item_name, sort_order: item.sort_order || 100 };
    })
  };
}

function validateRoomToken_(roomId, submitToken) {
  const room = findBy_('settings_rooms', 'room_id', roomId);
  if (!room || !activeRow_(room)) throw new Error('유효하지 않은 QR 코드입니다.');
  const expected = String(room.submit_token_hash || '');
  if (!submitToken || !expected || !constantTimeEquals_(hashToken_(submitToken, room.room_id), expected)) {
    logAudit_('anonymous', 'submit_token_failed', 'room', roomId, {});
    throw new Error('유효하지 않은 QR 코드입니다.');
  }
  return room;
}

function submitInspection_(payload) {
  const prepared = prepareSubmission_(payload || {});
  const lock = LockService.getScriptLock();
  let locked = false;
  lock.waitLock(30000);
  locked = true;
  const attachments = [];
  try {
    if (findBy_('submissions', 'record_id', prepared.recordId)) {
      return { record_id: prepared.recordId, duplicate: true };
    }
    prepared.fileKeys.forEach(function(itemKey) {
      const uploaded = createAttachmentFile_(prepared.recordId, itemKey, prepared.files[itemKey]);
      if (uploaded) attachments.push(uploaded);
    });
    appendObject_('submissions', prepared.row);
    attachments.forEach(function(attachment) {
      appendObject_('attachments', attachment);
    });
    logAudit_(
      prepared.submitter.person_name || 'anonymous',
      'submit_create',
      'submission',
      prepared.recordId,
      { room_id: prepared.room.room_id, abnormal: prepared.abnormal }
    );
    return { record_id: prepared.recordId, duplicate: false, abnormal: prepared.abnormal, attachments: attachments };
  } catch (err) {
    trashDriveFiles_(attachments);
    throw err;
  } finally {
    if (locked) lock.releaseLock();
  }
}

function prepareSubmission_(payload) {
  const room = validateRoomToken_(payload.room_id || payload.roomId, payload.submit_token || payload.submitToken);
  const recordId = payload.record_id || uuid_('rec');
  const now = nowIso_();
  const activeItems = readTable_('settings_check_items').filter(activeRow_);
  const activeItemKeys = activeItems.reduce(function(acc, item) {
    if (item.item_key) acc[String(item.item_key)] = true;
    return acc;
  }, {});
  const status = normalizeStatus_(payload.status_json || payload.status || {}, activeItems);
  const abnormal = Object.keys(status).some(function(key) { return status[key] === STATUS_ABNORMAL; });
  const submitter = resolveSubmitter_(payload, room);
  const remarks = limitedText_(payload.remarks || '', MAX_REMARKS_LENGTH, '특이사항');
  const files = payload.attachments || {};
  const fileKeys = Object.keys(files);
  if (fileKeys.length > MAX_ATTACHMENTS_PER_SUBMISSION) {
    throw new Error('첨부파일은 한 제출당 최대 ' + MAX_ATTACHMENTS_PER_SUBMISSION + '개까지 가능합니다.');
  }
  fileKeys.forEach(function(itemKey) {
    if (!activeItemKeys[itemKey]) throw new Error('알 수 없는 점검항목 첨부입니다: ' + itemKey);
    validateAttachmentPayload_(files[itemKey]);
  });
  const row = {
    record_id: recordId,
    submitted_at: now,
    inspection_date: today_(),
    room_id: room.room_id,
    room_name: room.room_name,
    person_id: submitter.person_id,
    person_name: submitter.person_name,
    role_type: submitter.role_type,
    status_json: JSON.stringify(status),
    abnormal: abnormal,
    remarks: remarks,
    client_info: stringifyLimited_(payload.client_info || {}, MAX_CLIENT_INFO_LENGTH, 'client_info'),
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
  return { room: room, recordId: recordId, row: row, abnormal: abnormal, submitter: submitter, files: files, fileKeys: fileKeys };
}

function normalizeStatus_(input, activeItems) {
  let raw = input || {};
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (err) {
      raw = {};
    }
  }
  if (Object.prototype.toString.call(raw) !== '[object Object]') raw = {};
  const normalized = {};
  activeItems.forEach(function(item) {
    const key = String(item.item_key || '');
    if (!key) return;
    normalized[key] = String(raw[key] || STATUS_NORMAL) === STATUS_ABNORMAL ? STATUS_ABNORMAL : STATUS_NORMAL;
  });
  return normalized;
}

function resolveSubmitter_(payload, room) {
  const personId = String(payload.person_id || payload.personId || '').trim();
  if (!personId) throw new Error('담당자 또는 당직자를 선택하세요.');
  const person = findBy_('settings_people', 'person_id', personId);
  if (!person || !activeRow_(person)) throw new Error('담당자 또는 당직자 정보를 확인할 수 없습니다.');
  if (person.room_id && String(person.room_id) !== String(room.room_id)) {
    throw new Error('해당 실에 등록된 담당자 또는 당직자가 아닙니다.');
  }
  return {
    person_id: String(person.person_id || ''),
    person_name: String(person.person_name || ''),
    role_type: String(person.role_type || payload.role_type || payload.roleType || '')
  };
}

function limitedText_(value, maxLength, label) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > maxLength) throw new Error(label + '은(는) ' + maxLength + '자 이하로 입력하세요.');
  return text;
}

function stringifyLimited_(value, maxLength, label) {
  const text = JSON.stringify(value || {});
  if (text.length > maxLength) return JSON.stringify({ truncated: true });
  return text;
}

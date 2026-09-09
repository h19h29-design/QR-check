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

function submitInspection_(payload) {
  const prepared = prepareSubmission_(payload || {});
  const lock = LockService.getScriptLock();
  let locked = false;
  lock.waitLock(30000);
  locked = true;
  const attachments = [];
  let recordCommitted = false;
  try {
    const existing = findBy_('submissions', 'record_id', prepared.recordId);
    if (existing) {
      if (String(existing.payload_digest || '') === String(prepared.digest)) {
        return {
          record_id: prepared.recordId,
          duplicate: true,
          abnormal: truthy_(existing.abnormal),
          save_state: saveState_(existing)
        };
      }
      throw new Error('[SUBMISSION_REVIEW_REQUIRED] 이미 접수된 요청번호와 내용이 다릅니다(충돌 가능, 구버전 요청일 수 있음). 기존 기록을 그대로 보존했습니다. 다시 제출하지 말고 관리자에게 확인을 요청하세요.');
    }
    prepared.fileKeys.forEach(function(itemKey) {
      const uploaded = createAttachmentFile_(prepared.recordId, itemKey, prepared.files[itemKey]);
      if (uploaded) attachments.push(uploaded);
    });
    appendObject_('submissions', prepared.row);
    recordCommitted = true;
    try {
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
    } catch (postErr) {
      // 기록은 확정됨. 첨부/로그 실패가 확정 자료를 훼손하지 않도록 파일을 지우지 않고
      // save_state=PARTIAL로 표시해 관리자가 누락을 인지·보완할 수 있게 한다.
      try {
        const partial = findBy_('submissions', 'record_id', prepared.recordId);
        if (partial) {
          partial.save_state = 'PARTIAL';
          partial.updated_at = nowIso_();
          upsertObject_('submissions', partial, 'record_id');
        }
        logAudit_('system', 'submit_partial', 'submission', prepared.recordId, {
          message: postErr.message || String(postErr)
        });
      } catch (markErr) {}
      return {
        record_id: prepared.recordId,
        duplicate: false,
        abnormal: prepared.abnormal,
        attachments: attachments,
        partial: true,
        save_state: 'PARTIAL'
      };
    }
    return {
      record_id: prepared.recordId,
      duplicate: false,
      abnormal: prepared.abnormal,
      attachments: attachments,
      save_state: 'COMMITTED'
    };
  } catch (err) {
    if (!recordCommitted) trashDriveFiles_(attachments);
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
  const observedAt = normalizeObservedAt_(payload.observed_at || payload.observedAt || '');
  const inspectionDate = observedAt ? observedAt.slice(0, 10) : today_();
  const clientInfoText = stringifyLimited_(payload.client_info || {}, MAX_CLIENT_INFO_LENGTH, 'client_info');
  const digest = submissionDigest_({
    room_id: room.room_id,
    person_id: submitter.person_id,
    role_type: submitter.role_type,
    status: status,
    remarks: remarks,
    observed_at: observedAt,
    inspection_date: inspectionDate,
    client_info: clientInfoText,
    files: fileKeys.sort().map(function(k) {
      const f = files[k] || {};
      const b64 = String(f.base64 || '');
      return {
        item_key: k,
        mime_type: String(f.mime_type || f.mimeType || '').toLowerCase(),
        file_size: Number(f.file_size || f.fileSize || 0),
        base64_length: b64.length,
        content_sha256: contentSha256Hex_(b64)
      };
    })
  });
  const snapshot = {
    app_version: APP_VERSION,
    schema_version: SCHEMA_VERSION,
    room_name: room.room_name,
    person_name: submitter.person_name,
    role_type: submitter.role_type,
    items: activeItems
      .sort(function(a, b) { return Number(a.sort_order) - Number(b.sort_order); })
      .map(function(item) { return { key: String(item.item_key), name: String(item.item_name) }; })
  };
  const row = {
    record_id: recordId,
    submitted_at: now,
    inspection_date: inspectionDate,
    room_id: room.room_id,
    room_name: room.room_name,
    person_id: submitter.person_id,
    person_name: submitter.person_name,
    role_type: submitter.role_type,
    status_json: JSON.stringify(status),
    abnormal: abnormal,
    remarks: remarks,
    client_info: clientInfoText,
    source: 'mobile',
    admin_verified: false,
    admin_verified_by: '',
    admin_verified_at: '',
    admin_memo: '',
    desktop_synced: false,
    desktop_synced_at: '',
    created_at: now,
    updated_at: now,
    payload_digest: digest,
    observed_at: observedAt,
    submit_snapshot: JSON.stringify(snapshot),
    save_state: 'COMMITTED'
  };
  return { room: room, recordId: recordId, row: row, digest: digest, abnormal: abnormal, submitter: submitter, files: files, fileKeys: fileKeys };
}

/** 관찰시간(KST wall time, yyyy-MM-ddTHH:mm). 빈 값 허용, 형식 오류는 거부한다. */
function normalizeObservedAt_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    throw new Error('관찰시간 형식이 올바르지 않습니다.');
  }
  return text;
}

function normalizeStatus_(input, activeItems) {
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (err) {
      throw new Error('점검 상태값을 해석할 수 없습니다. 다시 선택 후 제출하세요.');
    }
  }
  if (!raw || Object.prototype.toString.call(raw) !== '[object Object]') {
    throw new Error('점검 상태값을 해석할 수 없습니다. 다시 선택 후 제출하세요.');
  }
  const normalized = {};
  const missing = [];
  const unknown = [];
  activeItems.forEach(function(item) {
    const key = String(item.item_key || '');
    if (!key) return;
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      missing.push(String(item.item_name || key));
      return;
    }
    const value = String(raw[key]);
    if (value !== STATUS_NORMAL && value !== STATUS_ABNORMAL) {
      throw new Error('올바르지 않은 점검 상태값입니다: ' + String(item.item_name || key));
    }
    normalized[key] = value;
  });
  Object.keys(raw).forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(normalized, key)) unknown.push(key);
  });
  if (unknown.length) throw new Error('알 수 없는 점검항목이 있습니다: ' + unknown.join(', '));
  if (missing.length) throw new Error('선택하지 않은 항목이 있습니다: ' + missing.join(', '));
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
  const requestedRole = String(payload.role_type || payload.roleType || '');
  const personRole = String(person.role_type || '');
  if (requestedRole && personRole && requestedRole !== personRole) {
    throw new Error('선택한 역할과 등록된 역할이 일치하지 않습니다. 다시 선택하세요.');
  }
  return {
    person_id: String(person.person_id || ''),
    person_name: String(person.person_name || ''),
    role_type: personRole || requestedRole
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

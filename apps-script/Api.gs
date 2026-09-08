function initializeSchoolStorage_(payload) {
  payload = payload || {};
  // API 설치 경로: 바인딩이 없고 설치센터가 학교 Sheet ID를 함께 보낸 경우, 시트 접근 전에 바인딩한다.
  const wantBind = String(payload.spreadsheet_id || payload.spreadsheetId || '');
  if (wantBind) {
    verifyInitialSetupKey_(payload);
    setSchoolProp_('spreadsheet_id', wantBind);
  }
  const lock = LockService.getScriptLock();
  let locked = false;
  lock.waitLock(30000);
  locked = true;
  try {
    const alreadySetup = setupCompletedPeek_();
    const auth = alreadySetup
      ? verifyAdmin_(payload)
      : verifyInitialSetupKey_(payload);
    ensureSheets_();
    seedDefaults_();
    try {
      setSchoolProp_('spreadsheet_id', ss_().getId());
      setSetting_('spreadsheet_id', schoolProp_('spreadsheet_id', ''));
    } catch (bindErr) {}
    validateSetupPayload_(payload, !alreadySetup);

    const now = nowIso_();
    const schoolName = cleanText_(payload.school_name || payload.schoolName || '', 120);
    const adminEmail = cleanText_(payload.admin_email || payload.adminEmail || '', 254).toLowerCase();
    if (schoolName) setSetting_('school_name', schoolName);
    if (adminEmail) {
      upsertObject_('settings_admins', {
        admin_id: 'admin_owner',
        email: adminEmail,
        name: cleanText_(payload.admin_name || payload.adminName || '관리자', 80),
        role: 'owner',
        active: true,
        created_at: now,
        updated_at: now
      }, 'admin_id');
    }
    const folders = ensureDriveFolders_(schoolName || setting_('school_name', '학교'));
    const rotate = payload.rotateTokens === true;
    const adminToken = (!setting_('admin_token_hash', '') || rotate) ? generateAdminTokenForSetup_(payload) : '(기존 관리자 토큰 유지)';
    const syncKey = (!setting_('sync_key_hash', '') || rotate) ? generateSyncKeyForSetup_(payload) : '(기존 Desktop Sync Key 유지)';
    const createdRooms = createInitialRooms_(payload.rooms || payload.initialRooms || []);
    setSetting_('setup_completed', 'true');
    setSetting_('updated_at', now);
    if (!alreadySetup) clearInitialSetupKey_();
    logAudit_(auth ? auth.actor : adminEmail, 'setup_initialize', 'school', schoolName || setting_('school_name', ''), { rotateTokens: rotate });
    return { folders: folders, adminToken: adminToken, syncKey: syncKey, rooms: createdRooms, version: APP_VERSION, setup_completed: true };
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** 시트 생성 없이 설치 완료 여부를 확인한다. 인증 전에 변이를 만들지 않기 위한 읽기 전용 조회다. */
function setupCompletedPeek_() {
  try {
    const sheet = ss_().getSheetByName('settings_school');
    if (!sheet) return false;
    const values = sheet.getDataRange().getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === 'setup_completed' && String(values[i][1]) === 'true') return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/** google.script.run은 Date 객체를 왕복할 수 없으므로 UI 경계에서 재귀적으로 문자열화한다. */
function clientSafeValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  if (Array.isArray(value)) return value.map(clientSafeValue_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function(key) { out[key] = clientSafeValue_(value[key]); });
    return out;
  }
  return value;
}

function setupInitializeForUi(payload) {
  return clientSafeValue_(initializeSchoolStorage_(payload || {}));
}

function getBootstrapForUi(payload) {
  return clientSafeValue_(adminBootstrap_(payload || {}));
}

function getSubmitBootstrapForUi(payload) {
  return clientSafeValue_(getSubmitBootstrap_(payload || {}));
}

function submitInspectionForUi(payload) {
  return clientSafeValue_(submitInspection_(payload || {}));
}

function adminListForUi(payload) {
  return clientSafeValue_(adminListSubmissions_(payload || {}));
}

function adminDetailForUi(payload) {
  return clientSafeValue_(adminGetDetail_(payload || {}));
}

function adminVerifyForUi(payload) {
  return clientSafeValue_(adminVerifyRecord_(payload || {}));
}

function adminBulkVerifyForUi(payload) {
  return clientSafeValue_(adminBulkVerifyNormal_(payload || {}));
}

function reissueRoomTokenForUi(payload) {
  return clientSafeValue_(reissueRoomTokenFromAdmin_(payload || {}));
}

function adminPartialsForUi(payload) {
  return clientSafeValue_(adminListPartials_(payload || {}));
}

function adminReconcileForUi(payload) {
  return clientSafeValue_(adminReconcileRecord_(payload || {}));
}

function adminDiscardPartialForUi(payload) {
  return clientSafeValue_(adminDiscardPartial_(payload || {}));
}

function adminRoomsForUi(payload) {
  return clientSafeValue_(adminListRooms_(payload || {}));
}

function adminSaveRoomForUi(payload) {
  return clientSafeValue_(saveRoomFromAdmin_(payload || {}));
}

function adminBootstrapForUi(payload) {
  return clientSafeValue_(adminBootstrap_(payload || {}));
}

/** 초기 설정 시 기본 장소 생성. 토큰은 이 응답에서만 1회 확인 가능하다. */
function createInitialRooms_(roomsInput) {
  var names = [];
  if (Array.isArray(roomsInput)) names = roomsInput;
  else if (typeof roomsInput === 'string') names = String(roomsInput).split('\n');
  names = names.map(function(n) { return String(n == null ? '' : n).trim(); })
    .filter(function(n) { return n !== ''; })
    .slice(0, 20);
  var created = [];
  var order = 10;
  names.forEach(function(roomName) {
    if (roomName.length > 80) throw new Error('장소 이름은 80자 이하로 입력하세요: ' + roomName);
    var roomId = uuid_('room');
    var row = {
      room_id: roomId,
      room_name: roomName,
      room_order: order,
      submit_token_hash: '',
      active: true,
      created_at: nowIso_(),
      updated_at: nowIso_(),
      token_version: 1
    };
    upsertObject_('settings_rooms', row, 'room_id');
    created.push({ room_id: roomId, room_name: roomName, token_version: 1, submit_token: roomToken_(roomId, 1) });
    order += 10;
  });
  return created;
}

function validateSetupPayload_(payload, requireInitialFields) {
  const schoolName = cleanText_(payload.school_name || payload.schoolName || '', 120);
  const adminEmail = cleanText_(payload.admin_email || payload.adminEmail || '', 254).toLowerCase();
  if (requireInitialFields && !schoolName) throw new Error('초기 설정에는 학교명이 필요합니다.');
  if (requireInitialFields && !adminEmail) throw new Error('초기 설정에는 관리자 Google 이메일이 필요합니다.');
  if (adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    throw new Error('관리자 Google 이메일 형식을 확인하세요.');
  }
}

function cleanText_(value, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > maxLength) throw new Error('입력값이 너무 깁니다.');
  return text;
}

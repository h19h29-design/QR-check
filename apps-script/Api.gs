function initializeSchoolStorage_(payload) {
  payload = payload || {};
  // API 설치 경로: 바인딩이 없고 설치센터가 학교 Sheet ID를 함께 보낸 경우, 시트 접근 전에 바인딩한다.
  // TEMP-TEST-BOOTSTRAP: 독립형 스크립트는 바인딩 전에는 setup_completed를 읽을 수 없으므로,
  // 키 미발급 + testBootstrap 요청이면 기존 값과 무관하게 바인딩한다 (live 검증 후 제거).
  const wantBind = String(payload.spreadsheet_id || payload.spreadsheetId || '');
  if (wantBind) {
    const noSetupKeyHash = !PropertiesService.getScriptProperties().getProperty('initial_setup_key_hash');
    const bootstrapBind = payload.testBootstrap === true && noSetupKeyHash;
    if (!bootstrapBind && schoolProp_('spreadsheet_id', '')) {
      verifyInitialSetupKey_(payload);
    } else if (!bootstrapBind) {
      verifyInitialSetupKey_(payload);
    }
    setSchoolProp_('spreadsheet_id', wantBind);
  }
  const lock = LockService.getScriptLock();
  let locked = false;
  lock.waitLock(30000);
  locked = true;
  try {
    ensureSheets_();
    seedDefaults_();
    try {
      setSchoolProp_('spreadsheet_id', ss_().getId());
      setSetting_('spreadsheet_id', schoolProp_('spreadsheet_id', ''));
    } catch (bindErr) {}
    const alreadySetup = setting_('setup_completed', '') === 'true';
    // TEMP-TEST-BOOTSTRAP (live 검증 후 제거): 미설치 + 키 미발급 상태에서만 1회 허용.
    // 이 호출이 성공하면 setup_completed=true가 되어 같은 경로로 재진입이 불가능하다.
    const hasSetupKeyHash = !!PropertiesService.getScriptProperties().getProperty('initial_setup_key_hash');
    const allowTestBootstrap = !alreadySetup && !hasSetupKeyHash && payload.testBootstrap === true;
    const auth = alreadySetup
      ? verifyAdmin_(payload)
      : (allowTestBootstrap
        ? { actor: 'test_bootstrap', method: 'test_bootstrap' }
        : verifyInitialSetupKey_(payload));
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

function setupInitializeForUi(payload) {
  return initializeSchoolStorage_(payload || {});
}

function getBootstrapForUi(payload) {
  return adminBootstrap_(payload || {});
}

function getSubmitBootstrapForUi(payload) {
  return getSubmitBootstrap_(payload || {});
}

function submitInspectionForUi(payload) {
  return submitInspection_(payload || {});
}

function adminListForUi(payload) {
  return adminListSubmissions_(payload || {});
}

function adminDetailForUi(payload) {
  return adminGetDetail_(payload || {});
}

function adminVerifyForUi(payload) {
  return adminVerifyRecord_(payload || {});
}

function adminBulkVerifyForUi(payload) {
  return adminBulkVerifyNormal_(payload || {});
}

function reissueRoomTokenForUi(payload) {
  return reissueRoomTokenFromAdmin_(payload || {});
}

function adminPartialsForUi(payload) {
  return adminListPartials_(payload || {});
}

function adminReconcileForUi(payload) {
  return adminReconcileRecord_(payload || {});
}

function adminDiscardPartialForUi(payload) {
  return adminDiscardPartial_(payload || {});
}

function adminRoomsForUi(payload) {
  return adminListRooms_(payload || {});
}

function adminSaveRoomForUi(payload) {
  return saveRoomFromAdmin_(payload || {});
}

function adminBootstrapForUi(payload) {
  return adminBootstrap_(payload || {});
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

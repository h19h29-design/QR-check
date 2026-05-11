function initializeSchoolStorage_(payload) {
  payload = payload || {};
  const lock = LockService.getScriptLock();
  let locked = false;
  lock.waitLock(30000);
  locked = true;
  try {
    ensureSheets_();
    seedDefaults_();
    const alreadySetup = setting_('setup_completed', '') === 'true';
    const auth = alreadySetup ? verifyAdmin_(payload) : verifyInitialSetupKey_(payload);
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
    setSetting_('setup_completed', 'true');
    setSetting_('updated_at', now);
    if (!alreadySetup) clearInitialSetupKey_();
    logAudit_(auth ? auth.actor : adminEmail, 'setup_initialize', 'school', schoolName || setting_('school_name', ''), { rotateTokens: rotate });
    return { folders: folders, adminToken: adminToken, syncKey: syncKey, version: APP_VERSION, setup_completed: true };
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

function adminBootstrapForUi(payload) {
  return adminBootstrap_(payload || {});
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

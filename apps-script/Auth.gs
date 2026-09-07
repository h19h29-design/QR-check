function activeEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

function isAdminEmail_(email) {
  if (!email) return false;
  return readTable_('settings_admins').some(function(row) {
    return activeRow_(row) && String(row.email).toLowerCase() === String(email).toLowerCase();
  });
}

function verifyAdmin_(payload) {
  const email = activeEmail_();
  if (email && isAdminEmail_(email)) return { actor: email, method: 'google_email' };
  if (adminAuthMode_() === 'google_only') {
    if (!email) {
      throw new Error('Google 계정을 확인할 수 없습니다. 학교 관리자 Google 계정으로 로그인한 뒤 관리자 주소로 다시 접속하세요.');
    }
    logAudit_(email, 'admin_auth_denied', 'admin', '', { mode: 'google_only' });
    throw new Error('관리자 목록에 없는 계정입니다. 학교 관리자에게 추가를 요청하세요.');
  }
  // DEPRECATED(token_compat): 기존 설치 호환용. 신규 설치는 google_only가 기본이다.
  const adminToken = payload && payload.adminToken;
  const tokenHash = setting_('admin_token_hash', '');
  if (adminToken && tokenHash && constantTimeEquals_(hashToken_(adminToken, 'admin'), tokenHash)) {
    return { actor: 'admin_token', method: 'admin_token' };
  }
  logAudit_(email || 'anonymous', 'admin_auth_failed', 'admin', '', { mode: 'token_compat' });
  throw new Error('관리자 권한이 필요합니다. Google 계정 확인이 되지 않으면 관리자 토큰을 입력하세요.');
}

/**
 * 신규 관리 웹/API 전용 엄격 검사. Google 이메일 + 관리자 허용목록만 인정한다.
 * 클라이언트가 보낸 email/role은 보지 않는다. 빈 신원은 거부한다.
 */
function requireAdmin_(payload) {
  const email = activeEmail_();
  if (email && isAdminEmail_(email)) return { actor: email, method: 'google_email' };
  if (!email) {
    throw new Error('Google 계정을 확인할 수 없습니다. 학교 관리자 Google 계정으로 로그인한 뒤 관리자 주소로 다시 접속하세요.');
  }
  logAudit_(email, 'admin_auth_denied', 'admin', '', { mode: adminAuthMode_() });
  throw new Error('관리자 목록에 없는 계정입니다. 학교 관리자에게 추가를 요청하세요.');
}

/** 관리자 인증 모드. 신규 설치 기본 google_only, 기존 설치 호환 token_compat. */
function adminAuthMode_() {
  const mode = setting_('admin_auth_mode', '');
  if (mode === 'google_only' || mode === 'token_compat') return mode;
  return setting_('setup_completed', '') === 'true' ? 'token_compat' : 'google_only';
}

function verifyDesktop_(payload) {
  const syncKey = payload && (payload.syncKey || payload.sync_key);
  const expected = setting_('sync_key_hash', '');
  if (!expected) throw new Error('Desktop Sync Key가 설정되어 있지 않습니다.');
  if (!syncKey || !constantTimeEquals_(hashToken_(syncKey, 'desktop'), expected)) {
    logAudit_('desktop', 'desktop_auth_failed', 'sync', '', {});
    throw new Error('Desktop Sync Key가 올바르지 않습니다.');
  }
  return { actor: 'desktop', method: 'sync_key' };
}

function createInitialSetupKey() {
  const active = activeEmail_();
  const effective = effectiveEmail_();
  if (!active || !effective || String(active).toLowerCase() !== String(effective).toLowerCase()) {
    throw new Error('Apps Script 편집기에서 스크립트 소유자 계정으로 실행해야 초기 설정 키를 만들 수 있습니다.');
  }
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('initial_setup_key_hash', hashToken_(key, 'setup'));
  return key;
}

function verifyInitialSetupKey_(payload) {
  const expected = PropertiesService.getScriptProperties().getProperty('initial_setup_key_hash') || '';
  if (!expected) {
    throw new Error('초기 설정 키가 없습니다. Apps Script 편집기에서 createInitialSetupKey 함수를 먼저 실행한 뒤 표시된 키를 입력하세요.');
  }
  const setupKey = payload && (payload.setupKey || payload.setup_key);
  if (!setupKey || !constantTimeEquals_(hashToken_(setupKey, 'setup'), expected)) {
    throw new Error('초기 설정 키가 올바르지 않습니다.');
  }
  return { actor: 'setup_key', method: 'initial_setup_key' };
}

function clearInitialSetupKey_() {
  PropertiesService.getScriptProperties().deleteProperty('initial_setup_key_hash');
}

function effectiveEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

function generateAdminTokenForSetup_(payload) {
  const token = payload && payload.newAdminToken ? payload.newAdminToken : Utilities.getUuid() + Utilities.getUuid();
  setSetting_('admin_token_hash', hashToken_(token, 'admin'));
  return token;
}

function generateSyncKeyForSetup_(payload) {
  const key = payload && payload.newSyncKey ? payload.newSyncKey : Utilities.getUuid() + Utilities.getUuid();
  setSetting_('sync_key_hash', hashToken_(key, 'desktop'));
  return key;
}

function constantTimeEquals_(left, right) {
  left = String(left || '');
  right = String(right || '');
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

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
  if (isAdminEmail_(email)) return { actor: email, method: 'google_email' };
  const adminToken = payload && payload.adminToken;
  const tokenHash = setting_('admin_token_hash', '');
  if (adminToken && tokenHash && constantTimeEquals_(hashToken_(adminToken, 'admin'), tokenHash)) {
    return { actor: 'admin_token', method: 'admin_token' };
  }
  logAudit_(email || 'anonymous', 'admin_auth_failed', 'admin', '', {});
  throw new Error('관리자 권한이 필요합니다. Google 계정 확인이 되지 않으면 관리자 토큰을 입력하세요.');
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

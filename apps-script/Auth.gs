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

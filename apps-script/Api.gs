function initializeSchoolStorage_(payload) {
  ensureSheets_();
  seedDefaults_();
  if (setting_('setup_completed', '') === 'true') {
    verifyAdmin_(payload || {});
  }
  const now = nowIso_();
  if (payload.school_name) setSetting_('school_name', payload.school_name);
  if (payload.admin_email) {
    upsertObject_('settings_admins', {
      admin_id: 'admin_owner',
      email: payload.admin_email,
      name: payload.admin_name || '관리자',
      role: 'owner',
      active: true,
      created_at: now,
      updated_at: now
    }, 'admin_id');
  }
  const folders = ensureDriveFolders_(payload.school_name || setting_('school_name', '학교'));
  const rotate = payload.rotateTokens === true;
  const adminToken = (!setting_('admin_token_hash', '') || rotate) ? generateAdminTokenForSetup_(payload) : '(기존 관리자 토큰 유지)';
  const syncKey = (!setting_('sync_key_hash', '') || rotate) ? generateSyncKeyForSetup_(payload) : '(기존 Desktop Sync Key 유지)';
  setSetting_('setup_completed', 'true');
  setSetting_('updated_at', now);
  logAudit_(payload.admin_email || activeEmail_() || 'setup', 'setup_initialize', 'school', payload.school_name || '', {});
  return { folders: folders, adminToken: adminToken, syncKey: syncKey, version: APP_VERSION };
}

function setupInitializeForUi(payload) {
  return initializeSchoolStorage_(payload || {});
}

function getBootstrapForUi(payload) {
  return bootstrapForClient_();
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
  return adminBootstrap(payload || {});
}

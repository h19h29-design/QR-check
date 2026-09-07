const APP_VERSION = '0.1.0';
const TIMEZONE = 'Asia/Seoul';

function doGet(e) {
  const params = (e && e.parameter) || {};
  const page = params.page || params.route || 'submit';
  if (page === 'health') {
    return jsonResponse_({ ok: true, app: 'QR보안점검표', version: APP_VERSION, now: nowIso_() });
  }
  if (page === 'setup') {
    return renderPage_('WebApp', { page: 'setup', title: '초기 설정', params: params });
  }
  if (page === 'admin') {
    return renderPage_('Admin', { page: 'admin', title: '관리자 화면', params: params });
  }
  if (page === 'csv') {
    const safeParams = Object.assign({}, params);
    delete safeParams.adminToken;
    return exportCsv_(safeParams);
  }
  return renderPage_('Submit', { page: 'submit', title: '보안점검표', params: params });
}

function doPost(e) {
  try {
    const request = parsePost_(e);
    const action = request.action || '';
    const payload = request.payload || {};
    let data;
    if (action === 'submit.create') data = submitInspection_(payload);
    else if (action === 'admin.listSubmissions') data = adminListSubmissions_(payload);
    else if (action === 'admin.getDetail') data = adminGetDetail_(payload);
    else if (action === 'admin.verifyRecord') data = adminVerifyRecord_(payload);
    else if (action === 'admin.bulkVerifyNormal') data = adminBulkVerifyNormal_(payload);
    else if (action === 'admin.reissueRoomToken') data = reissueRoomTokenFromAdmin_(payload);
    else if (action === 'admin.listPartials') data = adminListPartials_(payload);
    else if (action === 'admin.reconcileRecord') data = adminReconcileRecord_(payload);
    else if (action === 'admin.discardPartial') data = adminDiscardPartial_(payload);
    else if (action === 'desktop.syncPull') data = desktopSyncPull_(payload);
    else if (action === 'desktop.pushSettings') data = desktopPushSettings_(payload);
    else if (action === 'desktop.verifyRecord') data = desktopVerifyRecord_(payload);
    else if (action === 'desktop.bulkVerifyNormal') data = desktopBulkVerifyNormal_(payload);
    else if (action === 'setup.initialize') data = initializeSchoolStorage_(payload);
    else if (action === 'public.bootstrap') data = getSubmitBootstrap_(payload);
    else throw new Error('지원하지 않는 action입니다: ' + action);
    return jsonResponse_({ ok: true, data: data, error: null, serverTime: nowIso_() });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      data: null,
      error: { code: err.code || 'ERROR', message: err.message || String(err) },
      serverTime: nowIso_()
    });
  }
}

function parsePost_(e) {
  if (!e || !e.postData || !e.postData.contents) return { action: '', payload: {} };
  const text = e.postData.contents;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('JSON 요청 본문을 해석할 수 없습니다.');
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowIso_() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function today_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function isoSecondsAgo_(seconds) {
  return Utilities.formatDate(new Date(Date.now() - Number(seconds || 0) * 1000), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function uuid_(prefix) {
  return (prefix || 'id') + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function sha256_(value) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return raw.map(function(byte) {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function hashToken_(token, salt) {
  return sha256_((salt || '') + ':' + (token || ''));
}

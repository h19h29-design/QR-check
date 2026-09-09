// installer/maker/maker.js — 학교 소유 maker 흐름용 브라우저 컨트롤러.
// - ES 모듈, Node에서 부작용 없음: DOM 부팅은 typeof document/window 가드로만 수행.
// - 메모리 전용: 토큰·학교정보·설치상태를 브라우저 저장소에 쓰지 않는다(자동 보관 없음).
// - 상태 전이는 state-machine/orchestrator를 통해서만 수행. 타이머 자동 전이·가짜 진행률 없음.
import { GOOGLE_OAUTH_CLIENT_ID } from '../src/auth/config.js';
import { createMemoryTokenStore, createGoogleAuth, assertVerifiedAccount } from '../src/auth/google-auth.mjs';
import { createRestClient } from '../src/google/rest.mjs';
import { createResourceClients } from '../src/google/resources.mjs';
import { createInstall, resumeInfo, canComplete, STATES } from '../src/install/state-machine.mjs';
import { runToStorage, runToDeployed, checkSchoolVerified, completeSchoolInstall, ownerSteps } from '../src/install/orchestrator.mjs';
import { createResumeEnvelope, restoreInstallFromSnapshot } from '../src/install/resume.mjs';

export const BLOCKED_NO_CLIENT_ID = '설치센터 Google 연결 정보가 준비되지 않았습니다';
export const BLOCKED_NO_RUNTIME = '게시된 실행 파일이 없어 설치를 시작할 수 없습니다';
export const BLOCKED_GIS_UNAVAILABLE = 'Google 연결 모듈을 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.';

void STATES;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

const REQUIRED_RUNTIME_NAMES = [
  'Code.gs',
  'SchoolConfig.gs',
  'SchemaMigrations.gs',
  'Sheets.gs',
  'Submit.gs',
  'QrTokens.gs',
  'DriveFiles.gs',
  'Templates.gs',
  'Client.js.html',
  'SubmitView.html',
  'Styles.html',
  'appsscript.json',
  'Auth.gs',
  'Admin.gs',
  'Api.gs',
  'DesktopSync.gs',
  'AdminView.html',
  'WebApp.html',
];

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const SOURCE_COMMIT_RE = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isValidSemver(v) {
  return typeof v === 'string' && SEMVER_RE.test(v);
}

function isValidSourceCommit(v) {
  return typeof v === 'string' && SOURCE_COMMIT_RE.test(v);
}

function isValidBuiltAt(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!ISO_DATETIME_RE.test(s)) return false;
  if (Number.isNaN(Date.parse(s))) return false;
  try {
    return new Date(s).toISOString() === s;
  } catch {
    return false;
  }
}

// appsscript.json은 유효한 객체이며 소문자 webapp이 USER_DEPLOYING + ANYONE_ANONYMOUS여야 한다.
function isValidAppsScriptSource(source) {
  let manifest = null;
  try {
    manifest = JSON.parse(source);
  } catch {
    return false;
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return false;
  const webapp = manifest.webapp;
  if (!webapp || typeof webapp !== 'object' || Array.isArray(webapp)) return false;
  return webapp.executeAs === 'USER_DEPLOYING' && webapp.access === 'ANYONE_ANONYMOUS';
}

// 게시 릴리스 게이트: __QR_CHECK_RELEASE__ + __MAKER_RELEASE__ + 런타임 파일 존재 검증.
// Metadata/file presence validation is not cryptographic authenticity or live success.
function validateReleaseGate(qrRelease, makerRelease, runtimeFiles) {
  if (!qrRelease || typeof qrRelease !== 'object' || Array.isArray(qrRelease)) return { ok: false, version: '' };
  if (qrRelease.status !== 'published') return { ok: false, version: '' };
  if (!isValidSemver(qrRelease.app_version)) return { ok: false, version: '' };
  if (!isValidSourceCommit(qrRelease.source_commit)) return { ok: false, version: '' };
  if (!isValidBuiltAt(qrRelease.built_at)) return { ok: false, version: '' };
  if (!Number.isInteger(qrRelease.runtime_file_count) || qrRelease.runtime_file_count <= 0) return { ok: false, version: '' };
  const version = String(qrRelease.app_version);
  const makerTrim = typeof makerRelease === 'string' ? makerRelease.trim() : '';
  if (!makerTrim || makerTrim !== version) return { ok: false, version: '' };
  if (!Array.isArray(runtimeFiles) || runtimeFiles.length === 0) return { ok: false, version: '' };
  if (runtimeFiles.length !== qrRelease.runtime_file_count) return { ok: false, version: '' };
  const allowed = new Set(REQUIRED_RUNTIME_NAMES);
  const seen = new Set();
  for (const f of runtimeFiles) {
    if (!f || typeof f !== 'object') return { ok: false, version: '' };
    if (typeof f.name !== 'string' || !f.name.trim()) return { ok: false, version: '' };
    if (typeof f.source !== 'string' || !f.source.trim()) return { ok: false, version: '' };
    const nm = f.name;
    if (nm !== nm.trim()) return { ok: false, version: '' };
    if (!allowed.has(nm)) return { ok: false, version: '' };
    if (/[\/\\]/.test(nm) || nm.includes('..')) return { ok: false, version: '' };
    if (seen.has(nm)) return { ok: false, version: '' };
    seen.add(nm);
  }
  for (const required of REQUIRED_RUNTIME_NAMES) {
    if (!seen.has(required)) return { ok: false, version: '' };
  }
  const manifestFile = runtimeFiles.find((f) => f.name === 'appsscript.json');
  if (!manifestFile || !isValidAppsScriptSource(manifestFile.source)) return { ok: false, version: '' };
  return { ok: true, version };
}

function currentReleaseGate(win) {
  const qr = win ? win.__QR_CHECK_RELEASE__ : null;
  const maker = win && typeof win.__MAKER_RELEASE__ === 'string' ? win.__MAKER_RELEASE__.trim() : '';
  const files = win ? win.__MAKER_RUNTIME_FILES__ : null;
  return validateReleaseGate(qr, maker, files);
}

// clientId + GIS 가용성만으로 상단 차단 여부와 컨트롤 활성화 기준을 판단한다.
// DOM 없이 단위 테스트 가능하다.
export function makerAvailability(clientId, gisAvailable) {
  const id = typeof clientId === 'string' ? clientId.trim() : (clientId ? String(clientId).trim() : '');
  if (!id) {
    return {
      blocked: true,
      reason: 'NO_CLIENT_ID',
      status: BLOCKED_NO_CLIENT_ID,
      canConnect: false,
      canCreate: false,
      canVerify: false,
      canComplete: false,
    };
  }
  if (!gisAvailable) {
    return {
      blocked: true,
      reason: 'GIS_UNAVAILABLE',
      status: BLOCKED_GIS_UNAVAILABLE,
      canConnect: false,
      canCreate: false,
      canVerify: false,
      canComplete: false,
    };
  }
  return {
    blocked: false,
    reason: 'READY',
    status: 'Google 연결 준비가 되었습니다. 학교 정보를 입력한 뒤 연결하세요.',
    canConnect: true,
    canCreate: true,
    canVerify: true,
    canComplete: false,
  };
}

// 완료 버튼 활성화 여부는 canComplete(install)에만 의존한다. 타이머 완료 없음.
export function completionAvailability(install) {
  let enabled = false;
  try {
    enabled = Boolean(install && canComplete(install));
  } catch {
    enabled = false;
  }
  if (enabled) {
    return { enabled: true, status: '초기 설정 확인이 가능합니다. 초기 설정 확인 완료 버튼을 눌러 마무리하세요.' };
  }
  return { enabled: false, status: '초기 설정 확인이 끝나야 완료할 수 있습니다.' };
}

// resumeInfo 표시/복사 안내용 스냅샷. 자동 저장하지 않으며 DOM 없이 테스트 가능하다.
export function safeResumeSnapshot(install) {
  if (!install || typeof install !== 'object') {
    return { ok: false, message: '표시할 설치 정보가 없습니다.' };
  }
  try {
    const snapshot = resumeInfo(install);
    return { ok: true, snapshot };
  } catch (e) {
    return { ok: false, message: humanError(e) };
  }
}

// 기존 모듈 오류를 차분한 한국어 안내로 변환한다. 무한 자동 재시도 없음.
export function humanError(error) {
  const raw = error && error.message ? String(error.message) : (error ? String(error) : '');
  const kind = error && error.kind ? String(error.kind) : '';

  if (kind === 'SCRIPT_API_DISABLED' || /script.*api|access not configured|api.*not enabled/i.test(raw)) {
    return 'Google에서 프로그램 설치 권한을 한 번 허용해야 합니다. 설정에서 허용한 뒤 다시 확인하세요.';
  }
  if (kind === 'NO_TOKEN' || kind === 'UNAUTHENTICATED' || /401|만료|다시 연결/i.test(raw)) {
    if (/다시 연결/.test(raw) && raw.length < 120) return raw;
    return 'Google 연결이 만료되었습니다. 다시 연결하세요.';
  }
  if (/설치센터 Google 연결 정보가 준비되지 않았습니다/.test(raw)) {
    return BLOCKED_NO_CLIENT_ID;
  }
  if (/게시된 실행 파일이 없어 설치를 시작할 수 없습니다/.test(raw)) {
    return BLOCKED_NO_RUNTIME;
  }
  if (/Google 로그인 모듈을 불러오지 못했습니다/.test(raw)) {
    return BLOCKED_GIS_UNAVAILABLE;
  }
  if (/거부|denied|deny|취소|닫힘|dismissed|popup/i.test(raw)) {
    return 'Google 권한이 거부되었습니다. 설치를 계속하려면 권한을 허용하세요.';
  }
  if (/설치를 시작한 Google 계정과 다릅니다|처음 계정|다른 계정|mismatch/i.test(raw)) {
    return '설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.';
  }
  if (kind === 'RATE_LIMITED' || kind === 'SERVER_ERROR' || kind === 'NETWORK' || /429|5\d\d|잠시 후|네트워크/i.test(raw)) {
    return 'Google 서버가 바쁘거나 연결이 불안정합니다. 잠시 뒤 다시 시도 버튼을 눌러주세요.';
  }
  if (kind === 'FORBIDDEN' || /권한이 부족|승인 범위/i.test(raw)) {
    return '권한이 부족합니다. 학교 계정과 승인 범위를 확인하세요.';
  }
  if (kind === 'NOT_FOUND' || /이어하기|대상이 없습니다/i.test(raw)) {
    return '대상이 없습니다. 이어하기 정보를 확인하세요.';
  }
  if (raw && raw.length < 300) return raw;
  if (raw) return '요청 실패. 입력값을 확인한 뒤 다시 시도하세요.';
  return '요청 실패. 입력값을 확인한 뒤 다시 시도하세요.';
}

// 학교 필수 입력 + 설치 계정이 모두 있어야 설치를 만들 수 있다. DOM 없이 테스트 가능하다.
export function hasRequiredInstallInput({ schoolName, adminEmail, accountEmail } = {}) {
  return isNonEmptyString(schoolName) && isNonEmptyString(adminEmail) && isNonEmptyString(accountEmail);
}

export function missingInstallInputMessage({ schoolName, adminEmail, accountEmail } = {}) {
  if (!isNonEmptyString(schoolName)) return '학교명을 입력하세요.';
  if (!isNonEmptyString(adminEmail)) return '관리자 이메일을 입력하세요.';
  if (!isNonEmptyString(accountEmail)) return '설치용 Google 계정 이메일을 입력하세요.';
  return '';
}

export function isGisAvailable(win) {
  try {
    return Boolean(win && win.google && win.google.accounts && win.google.accounts.oauth2);
  } catch {
    return false;
  }
}

export function resolveVerifiedEmail({ typedEmail, verifiedEmail } = {}) {
  return assertVerifiedAccount({ typedEmail, verifiedEmail });
}

export function releaseNoteText(release) {
  const r = typeof release === 'string' ? release.trim() : '';
  if (r) return '게시된 실행 정보: ' + r;
  return '릴리스 정보는 게시된 실행 정보가 있을 때에만 표시됩니다. 현재 표시할 버전 정보가 없습니다.';
}

export function retryTargetForState(state) {
  if (!state) return 'connect';
  if (state === 'AWAITING_SCHOOL_AUTH') return 'verify';
  if (state === 'VERIFIED' || state === 'COMPLETE') return 'complete';
  if (
    state === 'DRAFT' || state === 'OAUTH_READY' || state === 'API_ACCESS_READY' ||
    state === 'STORAGE_CREATED' || state === 'SCRIPT_CREATED' ||
    state === 'CODE_UPLOADED' || state === 'DEPLOYED'
  ) {
    return 'create';
  }
  return 'connect';
}

// Four display stages are presentation only: derived from the real install
// state, never advancing it. DOM-free and pure for unit testing.
export function displayStageForState(state) {
  if (state === 'AWAITING_SCHOOL_AUTH' || state === 'VERIFIED' || state === 'COMPLETE') return 4;
  if (
    state === 'STORAGE_CREATED' || state === 'SCRIPT_CREATED' ||
    state === 'CODE_UPLOADED' || state === 'DEPLOYED'
  ) {
    return 3;
  }
  if (state === 'OAUTH_READY' || state === 'API_ACCESS_READY') return 2;
  return 1;
}

const DISPLAY_STAGE_LABELS = ['학교 정보', '학교 계정 연결', '학교용 공간 생성', '초기 설정 및 연결 확인'];

function renderDisplayStage(doc, win, install) {
  const stage = displayStageForState(install && install.state ? install.state : '');
  const label = DISPLAY_STAGE_LABELS[stage - 1] || DISPLAY_STAGE_LABELS[0];
  setText(doc, 'wizard-stage-label', '0' + stage + ' / 04 · ' + label);
  try {
    const markers = doc.querySelectorAll('[data-display-stage]');
    markers.forEach((el) => {
      if (String(el.getAttribute('data-display-stage')) === String(stage)) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
  } catch {
    // Indicator-only; real install state stays truthful without markers.
  }
  try {
    if (win && typeof win.dispatchEvent === 'function' && typeof win.CustomEvent === 'function') {
      win.dispatchEvent(new win.CustomEvent('qr-maker-stage', { detail: { stage } }));
    }
  } catch {
    // Indicator-only; ignore dispatch failures.
  }
}

function readInput(doc, id) {
  const el = doc.getElementById(id);
  if (!el) return '';
  return typeof el.value === 'string' ? el.value.trim() : '';
}

function setText(doc, id, text) {
  const el = doc.getElementById(id);
  if (el) el.textContent = text;
}

function setDisabled(doc, id, disabled) {
  const el = doc.getElementById(id);
  if (el) el.disabled = Boolean(disabled);
}

function setLink(doc, id, href, text) {
  const el = doc.getElementById(id);
  if (!el) return;
  if (href) {
    el.textContent = text || href;
    if ('href' in el) el.href = href;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function makeInstallId() {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g && g.crypto && typeof g.crypto.randomUUID === 'function') return 'install-' + g.crypto.randomUUID();
  } catch {
    // 아래 대체값 사용
  }
  return 'install-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

function readRelease(doc, win) {
  void doc;
  // Release source is only __MAKER_RELEASE__ (validated against __QR_CHECK_RELEASE__).
  // User-editable maker-release input is never a release source. No maker-1 fallback.
  const fromWin = win && typeof win.__MAKER_RELEASE__ === 'string' ? win.__MAKER_RELEASE__.trim() : '';
  return fromWin || '';
}

function readRuntimeFiles(win) {
  const files = win ? win.__MAKER_RUNTIME_FILES__ : null;
  if (!Array.isArray(files) || files.length === 0) return null;
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || typeof f.source !== 'string') return null;
    if (!f.name || !f.source) return null;
  }
  return files;
}

function buildPrefix(schoolName, installId) {
  const clean = String(schoolName || '').replace(/\s+/g, '').slice(0, 12) || 'SCHOOL';
  const tail = String(installId || 'noid').replace(/[^A-Za-z0-9]/g, '').slice(-6) || 'noid';
  return 'QR_' + clean + '_' + tail + '_';
}

function adminUrlFromWebAppUrl(webAppUrl) {
  const base = String(webAppUrl || '').split('?')[0];
  if (!base) return '';
  return base + '?page=admin';
}

function boot() {
  const win = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;
  if (!win || !doc) return;

  const clientId = GOOGLE_OAUTH_CLIENT_ID;
  // 메모리 전용 상태. 저장·복원 없음.
  const store = createMemoryTokenStore();
  const auth = createGoogleAuth({
    gis: win.google,
    store,
    clientId,
    onDenied: () => {},
  });
  let install = null;
  let busy = false;
  function hasPendingMarker() {
    try {
      const v = install && install.resources && install.resources.operation_pending;
      return typeof v === 'string' && v.trim().length > 0;
    } catch {
      return false;
    }
  }
  function normEmailLocal(v) {
    return String(v || '').trim().toLowerCase();
  }
  function isResumeImportAllowed() {
    if (!install) return true;
    try {
      if (install.state !== 'DRAFT') return false;
      const r = install.resources;
      if (!r || typeof r !== 'object') return true;
      return Object.keys(r).length === 0;
    } catch {
      return false;
    }
  }
  function updateControlsOnly() {
    const avail = availability();
    const completion = completionAvailability(install);
    const hardBlocked = avail.blocked || installReleaseMismatch();
    const pending = hasPendingMarker();
    const resumeBlocked = hardBlocked || pending || !isResumeImportAllowed();
    if (busy) {
      setDisabled(doc, 'connect-btn', true);
      setDisabled(doc, 'create-btn', true);
      setDisabled(doc, 'verify-btn', true);
      setDisabled(doc, 'complete-btn', true);
      setDisabled(doc, 'retry-btn', true);
      setDisabled(doc, 'school-name', true);
      setDisabled(doc, 'school-admin-email', true);
      setDisabled(doc, 'admin-email', true);
      setDisabled(doc, 'account-email', true);
      setDisabled(doc, 'maker-release', true);
      setDisabled(doc, 'resume-input', true);
      setDisabled(doc, 'resume-btn', true);
    } else if (pending) {
      setDisabled(doc, 'connect-btn', hardBlocked || !avail.canConnect);
      setDisabled(doc, 'create-btn', true);
      setDisabled(doc, 'verify-btn', true);
      setDisabled(doc, 'complete-btn', true);
      setDisabled(doc, 'retry-btn', true);
      setDisabled(doc, 'school-name', false);
      setDisabled(doc, 'school-admin-email', false);
      setDisabled(doc, 'admin-email', false);
      setDisabled(doc, 'account-email', false);
      setDisabled(doc, 'maker-release', false);
      setDisabled(doc, 'resume-input', true);
      setDisabled(doc, 'resume-btn', true);
    } else {
      setDisabled(doc, 'connect-btn', hardBlocked || !avail.canConnect);
      setDisabled(doc, 'create-btn', hardBlocked || !avail.canCreate);
      setDisabled(doc, 'verify-btn', hardBlocked || !avail.canVerify);
      setDisabled(doc, 'complete-btn', hardBlocked || !completion.enabled);
      setDisabled(doc, 'retry-btn', hardBlocked);
      setDisabled(doc, 'school-name', hardBlocked);
      setDisabled(doc, 'school-admin-email', hardBlocked);
      setDisabled(doc, 'admin-email', hardBlocked);
      setDisabled(doc, 'account-email', hardBlocked);
      setDisabled(doc, 'maker-release', hardBlocked);
      setDisabled(doc, 'resume-input', resumeBlocked);
      setDisabled(doc, 'resume-btn', resumeBlocked);
    }
  }
  function renderBusyOn() {
    setDisabled(doc, 'connect-btn', true);
    setDisabled(doc, 'create-btn', true);
    setDisabled(doc, 'verify-btn', true);
    setDisabled(doc, 'complete-btn', true);
    setDisabled(doc, 'retry-btn', true);
    setDisabled(doc, 'school-name', true);
    setDisabled(doc, 'school-admin-email', true);
    setDisabled(doc, 'admin-email', true);
    setDisabled(doc, 'account-email', true);
    setDisabled(doc, 'maker-release', true);
    setDisabled(doc, 'resume-input', true);
    setDisabled(doc, 'resume-btn', true);
  }
  function refreshControlsPreserveStatus() {
    updateControlsOnly();
    try {
      renderDisplayStage(doc, win, install);
    } catch {
      // indicator-only
    }
  }
  const availability = () => {
    const base = makerAvailability(clientId, isGisAvailable(win));
    if (base.blocked) return base;
    const gate = currentReleaseGate(win);
    if (!gate.ok) {
      return {
        blocked: true,
        reason: 'NO_RUNTIME',
        status: BLOCKED_NO_RUNTIME,
        canConnect: false,
        canCreate: false,
        canVerify: false,
        canComplete: false,
      };
    }
    if (install && install.release !== gate.version) {
      return {
        blocked: true,
        reason: 'NO_RUNTIME',
        status: BLOCKED_NO_RUNTIME,
        canConnect: false,
        canCreate: false,
        canVerify: false,
        canComplete: false,
      };
    }
    return base;
  };

  function installReleaseMismatch() {
    if (!install) return false;
    const gate = currentReleaseGate(win);
    return !gate.ok || install.release !== gate.version;
  }

  function renderReleaseNote() {
    const gate = currentReleaseGate(win);
    if (gate.ok) setText(doc, 'maker-release-note', releaseNoteText(gate.version));
    else setText(doc, 'maker-release-note', releaseNoteText(''));
  }

  function render(statusText) {
    const avail = availability();
    renderReleaseNote();
    if (statusText !== undefined) {
      setText(doc, 'maker-status', statusText);
    } else if (avail.blocked) {
      setText(doc, 'maker-status', avail.status);
    }
    updateControlsOnly();
    renderDisplayStage(doc, win, install);
  }

  function renderResumeGuidance() {
    if (!install) {
      setText(doc, 'resume-info', '');
      return;
    }
    try {
      const commit = win && win.__QR_CHECK_RELEASE__ ? win.__QR_CHECK_RELEASE__.source_commit : '';
      const envelope = createResumeEnvelope(install, commit);
      setText(doc, 'resume-info', JSON.stringify(envelope, null, 2));
    } catch {
      setText(doc, 'resume-info', '이어하기 정보를 표시할 수 없습니다. 복사한 JSON과 원래 계정·릴리스를 확인하세요.');
    }
  }

  function buildClients() {
    const rest = createRestClient({ fetchImpl: win.fetch.bind(win), getToken: () => auth.getToken() });
    const res = createResourceClients({ fetchImpl: win.fetch.bind(win), getToken: () => auth.getToken() });
    void rest;
    return res;
  }

  function ensureInstall(schoolName, adminEmail, verifiedEmail) {
    const missing = missingInstallInputMessage({ schoolName, adminEmail, accountEmail: verifiedEmail });
    if (missing) throw new Error(missing);
    const norm = String(verifiedEmail).trim().toLowerCase();
    if (!install) {
      install = createInstall({
        installId: makeInstallId(),
        accountEmail: norm,
        release: readRelease(doc, win),
      });
    } else if (install.account_email !== norm) {
      throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
    }
    return install;
  }

  async function ensureVerifiedEmail(typedEmail) {
    const token = auth.getToken();
    if (!token) {
      throw new Error('Google 연결이 만료되었습니다. 다시 연결하세요.');
    }
    const res = buildClients();
    const verifiedEmail = await res.getVerifiedEmail();
    return resolveVerifiedEmail({ typedEmail, verifiedEmail });
  }

  async function handleConnect() {
    const avail = availability();
    if (avail.blocked) {
      render(avail.status);
      return;
    }
    if (installReleaseMismatch()) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    const typedEmail = readInput(doc, 'account-email');
    try {
      await auth.requestAccess(typedEmail ? { accountEmail: typedEmail } : {});
      const verified = await ensureVerifiedEmail(typedEmail);
      if (!install) {
        install = createInstall({
          installId: makeInstallId(),
          accountEmail: verified,
          release: readRelease(doc, win),
        });
      } else if (install.account_email !== verified) {
        throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
      }
      setText(doc, 'permission-status', 'Google 권한이 연결되었습니다 (' + verified + '). 다음 단계로 진행하세요.');
      renderResumeGuidance();
      render('Google에 연결되었습니다 (' + verified + '). 리소스 만들기를 누르세요.');
    } catch (e) {
      setText(doc, 'permission-status', humanError(e));
      render(humanError(e));
    }
  }

  async function handleCreate() {
    const avail = availability();
    if (avail.blocked) {
      render(avail.status);
      return;
    }
    if (installReleaseMismatch()) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    if (hasPendingMarker()) {
      render('요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.');
      renderResumeGuidance();
      return;
    }
    const schoolName = readInput(doc, 'school-name');
    const adminEmail = readInput(doc, 'school-admin-email') || readInput(doc, 'admin-email');
    const typedEmail = readInput(doc, 'account-email');
    const missing = missingInstallInputMessage({ schoolName, adminEmail, accountEmail: typedEmail });
    if (missing) {
      render(missing);
      return;
    }
    const runtimeFiles = readRuntimeFiles(win);
    if (!runtimeFiles) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    try {
      const verified = await ensureVerifiedEmail(typedEmail);
      const normVerified = normEmailLocal(verified);
      const normAdmin = normEmailLocal(adminEmail);
      if (!normAdmin || normAdmin !== normVerified) {
        throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
      }
      ensureInstall(schoolName, adminEmail, verified);
      if (normEmailLocal(install.account_email) !== normVerified) {
        throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
      }
      if (installReleaseMismatch()) {
        throw new Error(BLOCKED_NO_RUNTIME);
      }
      const freshPrefix = buildPrefix(schoolName, install.install_id);
      const storedPrefix = install.resources && typeof install.resources.install_prefix === 'string' ? install.resources.install_prefix : '';
      let prefixToUse = freshPrefix;
      if (storedPrefix) {
        if (storedPrefix !== freshPrefix) {
          throw new Error('학교명이 변경되었습니다. 처음 입력한 학교명으로 다시 시도하세요.');
        }
        prefixToUse = storedPrefix;
      } else {
        install.resources.install_prefix = freshPrefix;
      }
      if (hasPendingMarker()) {
        throw Object.assign(new Error('요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.'), { kind: 'OUTCOME_UNKNOWN', retryable: false });
      }
      const res = buildClients();
      render('학교 저장소를 만들고 있습니다…');
      await runToStorage({ install, accountEmail: verified, res, prefix: prefixToUse, onSnapshot: renderResumeGuidance });
      render('앱을 게시하고 있습니다…');
      await runToDeployed({
        install,
        accountEmail: verified,
        res,
        prefix: prefixToUse,
        runtimeFiles,
        versionDescription: 'maker ' + String(install.release || ''),
        onSnapshot: renderResumeGuidance,
      });
      const webAppUrl = install.resources ? install.resources.web_app_url : '';
      renderResumeGuidance();
      if (install.state === 'AWAITING_SCHOOL_AUTH' && isNonEmptyString(webAppUrl)) {
        const adminUrl = adminUrlFromWebAppUrl(webAppUrl);
        setLink(doc, 'admin-url', adminUrl, adminUrl);
        setText(doc, 'owner-steps', ownerSteps(webAppUrl));
        render('리소스가 만들어졌습니다 (AWAITING_SCHOOL_AUTH). 관리자 주소에서 초기 설정을 한 뒤 연결 검사를 누르세요.');
      } else {
        render('현재 단계: ' + install.state + '. 이어하기 정보를 확인하세요.');
      }
    } catch (e) {
      render(humanError(e));
    }
    renderResumeGuidance();
    if (!busy && !hasPendingMarker()) {
      const completion = completionAvailability(install);
      setDisabled(doc, 'complete-btn', availability().blocked || !completion.enabled);
    } else {
      setDisabled(doc, 'complete-btn', true);
    }
  }

  async function handleVerify() {
    const avail = availability();
    if (avail.blocked) {
      render(avail.status);
      return;
    }
    if (installReleaseMismatch()) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    if (!install) {
      render('먼저 학교 정보를 입력하고 리소스 만들기를 하세요.');
      return;
    }
    if (hasPendingMarker()) {
      render('요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.');
      renderResumeGuidance();
      return;
    }
    try {
      const typedEmail = readInput(doc, 'account-email');
      const verified = await ensureVerifiedEmail(typedEmail);
      if (normEmailLocal(install.account_email) !== normEmailLocal(verified)) {
        throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
      }
      if (installReleaseMismatch()) {
        throw new Error(BLOCKED_NO_RUNTIME);
      }
      const res = buildClients();
      const result = await checkSchoolVerified({ install, res, accountEmail: verified });
      if (result && result.verified) {
        const webAppUrl = install.resources ? install.resources.web_app_url : '';
        if (!isNonEmptyString(webAppUrl)) {
          render('연결 검사는 끝났지만 배포 주소가 없습니다. 다시 만들기를 하세요.');
          return;
        }
        setText(doc, 'owner-steps', ownerSteps(webAppUrl));
        setLink(doc, 'admin-url', adminUrlFromWebAppUrl(webAppUrl), adminUrlFromWebAppUrl(webAppUrl));
        renderResumeGuidance();
        render('연결 검사가 끝났습니다. 초기 설정 확인 완료 버튼을 눌러 마무리하세요. 실제 QR 제출·첨부 확인은 별도로 필요합니다.');
      } else {
        render('아직 학교 연결 검사가 끝나지 않았습니다. 관리자 주소에서 초기 설정을 마친 뒤 다시 누르세요.');
      }
    } catch (e) {
      render(humanError(e));
    }
    if (!busy && !hasPendingMarker()) {
      const completion = completionAvailability(install);
      setDisabled(doc, 'complete-btn', availability().blocked || !completion.enabled);
    } else {
      setDisabled(doc, 'complete-btn', true);
    }
  }

  async function handleComplete() {
    const avail = availability();
    if (avail.blocked) {
      render(avail.status);
      return;
    }
    if (installReleaseMismatch()) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    if (hasPendingMarker()) {
      render('요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.');
      renderResumeGuidance();
      return;
    }
    if (!install) {
      render('완료할 설치가 없습니다.');
      return;
    }
    const completion = completionAvailability(install);
    if (!completion.enabled) {
      render(completion.status);
      return;
    }
    try {
      const typedEmail = readInput(doc, 'account-email');
      const verified = await ensureVerifiedEmail(typedEmail);
      if (normEmailLocal(install.account_email) !== normEmailLocal(verified)) {
        throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
      }
      if (installReleaseMismatch()) {
        throw new Error(BLOCKED_NO_RUNTIME);
      }
      const res = buildClients();
      await completeSchoolInstall({ install, res, accountEmail: verified });
      renderResumeGuidance();
      render('초기 설정 확인이 완료되었습니다. 실제 QR 제출·시트 기록·관리자 화면·첨부·모바일 동작 확인은 별도로 필요합니다.');
    } catch (e) {
      render(humanError(e));
    }
    if (!busy && !hasPendingMarker()) {
      const next = completionAvailability(install);
      setDisabled(doc, 'complete-btn', availability().blocked || !next.enabled);
    } else {
      setDisabled(doc, 'complete-btn', true);
    }
  }

  async function handleResume() {
    const avail = availability();
    if (avail.blocked) {
      render(avail.status);
      return;
    }
    if (installReleaseMismatch()) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    if (hasPendingMarker()) {
      render('이어하기를 할 수 없습니다. 요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.');
      renderResumeGuidance();
      return;
    }
    if (install) {
      let allowed = false;
      try {
        const keys = install.resources && typeof install.resources === 'object' ? Object.keys(install.resources) : [];
        allowed = install.state === 'DRAFT' && keys.length === 0;
      } catch {
        allowed = false;
      }
      if (!allowed) {
        render('이어하기를 할 수 없습니다. 진행 중인 설치가 있습니다. 기존 설치를 그대로 사용하세요.');
        renderResumeGuidance();
        return;
      }
    }
    let token = null;
    try {
      token = auth.getToken();
    } catch {
      token = null;
    }
    if (!token) {
      render('먼저 Google 연결을 한 뒤 이어하기를 하세요. 연결 후 검증된 계정으로 이어하기 정보를 가져오세요.');
      return;
    }
    const inputEl = doc.getElementById('resume-input');
    const text = inputEl && typeof inputEl.value === 'string' ? inputEl.value : '';
    if (!text || !text.trim()) {
      render('이어하기 정보를 가져오지 못했습니다. 복사한 JSON이 올바른지 확인하세요.');
      try {
        renderResumeGuidance();
      } catch {
        // preserve previous snapshot on failure
      }
      return;
    }
    try {
      const typedEmail = readInput(doc, 'account-email');
      const verified = await ensureVerifiedEmail(typedEmail);
      const release = readRelease(doc, win);
      const commit = win && win.__QR_CHECK_RELEASE__ ? win.__QR_CHECK_RELEASE__.source_commit : '';
      const runtimeFiles = readRuntimeFiles(win);
      if (!release || !commit || !runtimeFiles) {
        throw new Error('resume gate');
      }
      const gateNow = availability();
      if (gateNow.blocked) {
        throw new Error('resume gate');
      }
      if (installReleaseMismatch()) {
        throw new Error('resume gate');
      }
      if (hasPendingMarker()) {
        throw new Error('resume gate');
      }
      if (install) {
        const keys = install.resources && typeof install.resources === 'object' ? Object.keys(install.resources) : [];
        if (!(install.state === 'DRAFT' && keys.length === 0)) {
          render('이어하기를 할 수 없습니다. 진행 중인 설치가 있습니다. 기존 설치를 그대로 사용하세요.');
          renderResumeGuidance();
          return;
        }
      }
      const res = buildClients();
      const restored = await restoreInstallFromSnapshot({
        text,
        accountEmail: verified,
        release,
        sourceCommit: commit,
        res,
        runtimeFiles,
      });
      if (install) {
        const keys2 = install.resources && typeof install.resources === 'object' ? Object.keys(install.resources) : [];
        if (!(install.state === 'DRAFT' && keys2.length === 0)) {
          render('이어하기를 할 수 없습니다. 진행 중인 설치가 있습니다. 기존 설치를 그대로 사용하세요.');
          renderResumeGuidance();
          return;
        }
      }
      if (hasPendingMarker()) {
        throw new Error('resume gate');
      }
      install = restored;
      try {
        const emailVal = install.account_email || verified;
        const accEl = doc.getElementById('account-email');
        if (accEl && 'value' in accEl) accEl.value = emailVal;
        const ownerEl = doc.getElementById('school-admin-email');
        if (ownerEl && 'value' in ownerEl) ownerEl.value = emailVal;
        const ownerEl2 = doc.getElementById('admin-email');
        if (ownerEl2 && 'value' in ownerEl2) ownerEl2.value = emailVal;
      } catch {
        // input populate best-effort; school-name preserved
      }
      try {
        const webAppUrl = install.resources ? install.resources.web_app_url : '';
        if (install.state === 'AWAITING_SCHOOL_AUTH' && isNonEmptyString(webAppUrl)) {
          const adminUrl = adminUrlFromWebAppUrl(webAppUrl);
          setLink(doc, 'admin-url', adminUrl, adminUrl);
          setText(doc, 'owner-steps', ownerSteps(webAppUrl));
        }
      } catch {
        // admin link best-effort
      }
      renderResumeGuidance();
      if (install.state === 'AWAITING_SCHOOL_AUTH') {
        render('이어하기 정보를 가져왔습니다. 원래 학교명을 그대로 사용하세요. 관리자 주소에서 초기 설정을 한 뒤 연결 검사를 누르세요. 완료는 새로운 연결 검사 후에 가능합니다.');
      } else {
        render('이어하기 정보를 가져왔습니다. 원래 학교명과 계정을 그대로 사용하세요. 다음 단계를 진행하세요.');
      }
    } catch {
      render('이어하기 정보를 가져오지 못했습니다. 복사한 JSON·원래 계정·릴리스를 확인하세요.');
      try {
        renderResumeGuidance();
      } catch {
        // preserve previous snapshot on failure
      }
    }
  }

  function handleRetry() {
    const avail = availability();
    if (avail.blocked) {
      render(avail.status);
      return;
    }
    if (installReleaseMismatch()) {
      render(BLOCKED_NO_RUNTIME);
      return;
    }
    const target = retryTargetForState(install ? install.state : '');
    if (target === 'verify') return handleVerify();
    if (target === 'create') return handleCreate();
    if (target === 'complete') return handleComplete();
    return handleConnect();
  }

  function bind(id, fn) {
    const el = doc.getElementById(id);
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('click', (ev) => {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        if (busy) return;
        busy = true;
        try {
          renderBusyOn();
        } catch {
          // busy UI best-effort; gesture preserved (sync only)
        }
        let result;
        try {
          result = fn();
        } catch {
          busy = false;
          try {
            refreshControlsPreserveStatus();
          } catch {
            // ignore
          }
          return;
        }
        if (result && typeof result.then === 'function') {
          result.then(
            () => {
              busy = false;
              try {
                refreshControlsPreserveStatus();
              } catch {
                // ignore
              }
            },
            () => {
              busy = false;
              try {
                refreshControlsPreserveStatus();
              } catch {
                // ignore
              }
            },
          );
        } else {
          busy = false;
          try {
            refreshControlsPreserveStatus();
          } catch {
            // ignore
          }
        }
      });
    }
  }

  bind('connect-btn', handleConnect);
  bind('create-btn', handleCreate);
  bind('verify-btn', handleVerify);
  bind('complete-btn', handleComplete);
  bind('retry-btn', handleRetry);
  bind('resume-btn', handleResume);

  // 초기 화면: clientId 누락·GIS 미가용을 있는 그대로 알리고 전 컨트롤 차단. 타이머 전이 없음.
  const init = availability();
  setText(doc, 'maker-status', init.status);
  setText(doc, 'permission-status', init.blocked ? init.status : 'Google 권한을 아직 연결하지 않았습니다.');
  render(init.status);
}

// Node 부작용 방지: 브라우저에서만 부팅한다. 추적기/CDN 추가 없음.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export { boot as bootMaker };

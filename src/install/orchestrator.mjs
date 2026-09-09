// installer/src/install/orchestrator.mjs — 설치 실행기.
// 상태머신 전이를 강제하고, 각 단계의 Google 호출을 멱등(기존 자원 재사용)으로 수행한다.
// 학교 설정(학교명 등)은 소유자가 학교 관리자 웹에서 직접 입력한다. 설치센터가 대신 쓰지 않는다.
// unit3 minimal safety: 단일 변이 래치(operation_pending), 계정/상태 선검증, 확정 ID 즉시 저장.
import { advance } from './state-machine.mjs';
import { names } from '../google/resources.mjs';

const PAST_STORAGE = ['STORAGE_CREATED', 'SCRIPT_CREATED', 'CODE_UPLOADED', 'DEPLOYED', 'AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE'];
const PAST_DEPLOYED = ['DEPLOYED', 'AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE'];
const KNOWN_STATES = ['DRAFT', 'OAUTH_READY', 'API_ACCESS_READY', 'STORAGE_CREATED', 'SCRIPT_CREATED', 'CODE_UPLOADED', 'DEPLOYED', 'AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE'];

// 확정된 알려진 오류만 마커를 지울 수 있다. 그 외는 OUTCOME_UNKNOWN으로 래치한다.
const CLEARABLE_KINDS = new Set([
  'NO_TOKEN',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'SCRIPT_API_DISABLED',
  'NOT_FOUND',
  'REQUEST_ERROR',
  'AMBIGUOUS_RESOURCE',
]);

const UNKNOWN_MESSAGE = '요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.';

function unknownError() {
  const e = new Error(UNKNOWN_MESSAGE);
  e.kind = 'OUTCOME_UNKNOWN';
  e.retryable = false;
  return e;
}

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function hasPendingMarker(install) {
  try {
    const v = install && install.resources && install.resources.operation_pending;
    return typeof v === 'string' && v.trim().length > 0;
  } catch {
    return false;
  }
}

function assertNoPending(install) {
  if (hasPendingMarker(install)) {
    throw unknownError();
  }
}

function assertAccountMatch(install, accountEmail) {
  const a = normEmail(accountEmail);
  if (!a) {
    throw new Error('설치용 Google 계정 이메일을 입력하세요.');
  }
  if (!install || typeof install !== 'object' || !normEmail(install.account_email)) {
    throw new Error('설치 정보가 없습니다.');
  }
  if (normEmail(install.account_email) !== a) {
    throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
  }
}

function assertValidInstall(install) {
  if (!install || typeof install !== 'object') {
    throw new Error('설치 정보가 없습니다.');
  }
  if (!KNOWN_STATES.includes(install.state)) {
    throw new Error('설치 상태가 유효하지 않습니다. 이어하기 정보를 확인하세요.');
  }
  if (!install.resources || typeof install.resources !== 'object') {
    install.resources = {};
  }
  if (!install.account_email || !normEmail(install.account_email)) {
    throw new Error('설치 정보가 없습니다.');
  }
  if (!install.release || String(install.release).trim().length === 0) {
    throw new Error('게시된 실행 파일이 없어 설치를 시작할 수 없습니다');
  }
}

function notifySnapshot(onSnapshot) {
  if (typeof onSnapshot === 'function') {
    try { onSnapshot(); } catch { /* guidance-only */ }
  }
}

// 공유 변이 래퍼: 대기 전 마커 설정, 확정 성공 시 제거, 확정 알려진 오류만 제거,
// OUTCOME_UNKNOWN은 유지, 미분류 예외는 OUTCOME_UNKNOWN으로 전환해 유지한다.
async function withMutation(install, label, fn, onSnapshot) {
  if (!install.resources || typeof install.resources !== 'object') {
    install.resources = {};
  }
  install.resources.operation_pending = label;
  notifySnapshot(onSnapshot);
  try {
    const result = await fn();
    try { delete install.resources.operation_pending; } catch { /* ignore */ }
    notifySnapshot(onSnapshot);
    return result;
  } catch (e) {
    const kind = e && e.kind ? String(e.kind) : '';
    if (CLEARABLE_KINDS.has(kind)) {
      try { delete install.resources.operation_pending; } catch { /* ignore */ }
      notifySnapshot(onSnapshot);
      throw e;
    }
    if (kind === 'OUTCOME_UNKNOWN') {
      if (!hasPendingMarker(install)) {
        try { install.resources.operation_pending = label; } catch { /* ignore */ }
      }
      notifySnapshot(onSnapshot);
      throw e;
    }
    try { install.resources.operation_pending = label; } catch { /* ignore */ }
    notifySnapshot(onSnapshot);
    throw unknownError();
  }
}

export async function runToStorage({ install, accountEmail, res, prefix, onSnapshot }) {
  assertValidInstall(install);
  assertAccountMatch(install, accountEmail);
  assertNoPending(install);
  if (PAST_STORAGE.includes(install.state)) {
    return install;
  }
  if (install.state === 'DRAFT') {
    advance(install, 'OAUTH_READY', { accountEmail: normEmail(accountEmail) });
  }
  if (PAST_STORAGE.includes(install.state)) {
    return install;
  }
  if (install.state === 'OAUTH_READY') {
    let folder;
    folder = await withMutation(install, 'create-folder', () => res.createDriveFolder(names(prefix).folder), onSnapshot);
    advance(install, 'API_ACCESS_READY', { accountEmail: normEmail(accountEmail), resource: { folder_id: folder.id } });
    notifySnapshot(onSnapshot);
  }
  if (install.state === 'API_ACCESS_READY') {
    let folderId = install.resources.folder_id || '';
    if (!folderId) {
      const folder = await withMutation(install, 'create-folder', () => res.createDriveFolder(names(prefix).folder), onSnapshot);
      folderId = folder.id;
      install.resources.folder_id = folderId;
      notifySnapshot(onSnapshot);
    }
    let sheetId = install.resources.spreadsheet_id || '';
    if (!sheetId) {
      const sheet = await withMutation(install, 'create-sheet', () => res.createSpreadsheet(names(prefix).sheet), onSnapshot);
      sheetId = sheet.spreadsheetId;
      install.resources.spreadsheet_id = sheetId;
      notifySnapshot(onSnapshot);
    }
    // 이동은 절대 삼키지 않는다. 알려진 실패는 중단, 알 수 없음은 래치 후 전파한다.
    // 이동 확정 전에는 STORAGE_CREATED로 전진하지 않는다.
    await withMutation(install, 'move-sheet', () => res.moveIntoFolder(sheetId, folderId), onSnapshot);
    advance(install, 'STORAGE_CREATED', {
      accountEmail: normEmail(accountEmail),
      resource: { folder_id: folderId, spreadsheet_id: sheetId },
    });
    notifySnapshot(onSnapshot);
  }
  return install;
}

export async function runToDeployed({ install, accountEmail, res, prefix, runtimeFiles, versionDescription, onSnapshot }) {
  assertValidInstall(install);
  assertAccountMatch(install, accountEmail);
  assertNoPending(install);
  if (PAST_DEPLOYED.includes(install.state)) {
    return install;
  }
  if (['DRAFT', 'OAUTH_READY', 'API_ACCESS_READY'].includes(install.state)) {
    throw new Error('저장소가 먼저 만들어져야 합니다. 리소스 만들기를 먼저 하세요.');
  }
  if (install.state === 'STORAGE_CREATED') {
    const existingScript = install.resources.script_id || '';
    if (!existingScript) {
      const script = await withMutation(install, 'create-script', () => res.createScriptProject(names(prefix).script), onSnapshot);
      advance(install, 'SCRIPT_CREATED', { accountEmail: normEmail(accountEmail), resource: { script_id: script.scriptId } });
      notifySnapshot(onSnapshot);
    } else {
      advance(install, 'SCRIPT_CREATED', { accountEmail: normEmail(accountEmail), resource: { script_id: existingScript } });
    }
  }
  if (install.state === 'SCRIPT_CREATED') {
    await withMutation(install, 'upload-runtime', () => res.uploadRuntime(install.resources.script_id, runtimeFiles), onSnapshot);
    advance(install, 'CODE_UPLOADED', { accountEmail: normEmail(accountEmail) });
    notifySnapshot(onSnapshot);
  }
  if (install.state === 'CODE_UPLOADED') {
    let versionNumber = null;
    const stored = install.resources.version_number;
    if (stored !== undefined && stored !== null && String(stored).trim().length > 0) {
      const n = Number(String(stored).trim());
      if (Number.isInteger(n) && n > 0) versionNumber = n;
    }
    if (versionNumber === null) {
      const version = await withMutation(install, 'create-version', () => res.createVersion(install.resources.script_id, versionDescription), onSnapshot);
      versionNumber = version.versionNumber;
      install.resources.version_number = String(versionNumber);
      notifySnapshot(onSnapshot);
    }
    const versionNumberStr = String(versionNumber);
    const existingDep = install.resources.deployment_id || '';
    if (existingDep) {
      const dep = await withMutation(
        install,
        'update-deployment',
        () => res.updateDeployment(install.resources.script_id, existingDep, versionNumber, versionDescription),
        onSnapshot,
      );
      if (!dep || !dep.deploymentId || !dep.webAppUrl) {
        try { install.resources.operation_pending = 'update-deployment'; } catch { /* ignore */ }
        notifySnapshot(onSnapshot);
        throw unknownError();
      }
      advance(install, 'DEPLOYED', {
        accountEmail: normEmail(accountEmail),
        resource: { version_number: versionNumberStr, deployment_id: dep.deploymentId, web_app_url: dep.webAppUrl },
      });
    } else {
      const dep = await withMutation(
        install,
        'create-deployment',
        () => res.createDeployment(install.resources.script_id, versionNumber, versionDescription),
        onSnapshot,
      );
      if (!dep || !dep.deploymentId || !dep.webAppUrl) {
        try { install.resources.operation_pending = 'create-deployment'; } catch { /* ignore */ }
        notifySnapshot(onSnapshot);
        throw unknownError();
      }
      advance(install, 'DEPLOYED', {
        accountEmail: normEmail(accountEmail),
        resource: {
          version_number: versionNumberStr,
          deployment_id: dep.deploymentId,
          web_app_url: dep.webAppUrl,
        },
      });
    }
    advance(install, 'AWAITING_SCHOOL_AUTH', { accountEmail: normEmail(accountEmail) });
    notifySnapshot(onSnapshot);
  }
  return install;
}

/** 학교 관리자 웹이 Sheet에 기록한 setup_completed를 설치센터 권한으로 확인한다. */
/* setup_completed marker proves initial setup only, not operational QR/attachments. */
export async function checkSchoolVerified({ install, res, accountEmail }) {
  assertValidInstall(install);
  assertAccountMatch(install, accountEmail);
  assertNoPending(install);
  if (!['AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE'].includes(install.state)) {
    throw new Error('학교 확인은 학교 인증 대기 이후에만 할 수 있습니다.');
  }
  const values = await res.getSheetValues(install.resources.spreadsheet_id, 'settings_school!A1:B200');
  const map = {};
  for (const row of values) {
    if (row && row[0]) map[String(row[0])] = row[1];
  }
  const done = map.setup_completed === 'true' || map.setup_completed === true;
  if (!done) {
    return { verified: false, school_name: map.school_name || '' };
  }
  if (install.state === 'AWAITING_SCHOOL_AUTH') {
    advance(install, 'VERIFIED', { accountEmail: normEmail(accountEmail) });
  }
  return { verified: true, school_name: map.school_name || '' };
}

/** 소유자 안내문: 설치센터가 자동화할 수 없는 남은 단계. */
export function ownerSteps(webAppUrl) {
  const base = String(webAppUrl || '').split('?')[0];
  return [
    '1. 위 관리자 주소로 접속해 Google 계정 권한을 승인하세요. 설치를 시작한 같은 계정으로 진행하세요.',
    '2. 스크립트 편집기에서 showSetupKeyForOwner 함수를 1회 실행하고 비공개 실행 로그에서 초기 설정 키를 확인하세요.',
    '3. 초기 설정 화면(?page=setup)에서 학교명·관리자 이메일(설치 계정과 동일)·초기 설정 키를 입력하세요. 독립 실행형이면 이어하기 정보의 spreadsheet_id를 함께 확인하세요.',
    '4. 초기 설정 확인 완료는 초기 설정 입력 확인이며, 실제 QR 제출·시트 기록·관리자 화면·첨부·모바일 동작 확인은 별도로 필요합니다.',
  ].map((s) => s).join('\n') + `\n관리자 주소: ${base}?page=admin\n초기 설정: ${base}?page=setup`;
}

/* Initial setup confirmation only, not operational attestation.
 * setup_completed marker proves initial setup input, not QR/attachment success. */
export async function completeSchoolInstall({ install, res, accountEmail }) {
  assertValidInstall(install);
  assertAccountMatch(install, accountEmail);
  assertNoPending(install);
  if (!['VERIFIED', 'COMPLETE'].includes(install.state)) {
    throw new Error('초기 설정 확인은 연결 검사 이후에만 할 수 있습니다.');
  }
  const result = await checkSchoolVerified({ install, res, accountEmail });
  if (!result || !result.verified) {
    throw new Error('아직 초기 설정 확인이 끝나지 않았습니다. 관리자 주소에서 초기 설정을 마친 뒤 다시 시도하세요.');
  }
  if (install.state === 'VERIFIED') {
    advance(install, 'COMPLETE', { accountEmail: normEmail(accountEmail) });
  }
  return install;
}

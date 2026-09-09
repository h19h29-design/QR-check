// installer/src/install/state-machine.mjs — 재개 가능한 설치 상태 머신 (순수 함수, 저장소 무관)
// 비밀값(oauth token, 학교 비밀키, QR 원문 토큰)은 이 모듈이 보관하지 않는다.
export const STATES = [
  'DRAFT',
  'OAUTH_READY',
  'API_ACCESS_READY',
  'STORAGE_CREATED',
  'SCRIPT_CREATED',
  'CODE_UPLOADED',
  'DEPLOYED',
  'AWAITING_SCHOOL_AUTH',
  'VERIFIED',
  'COMPLETE',
];

const NEXT = {
  DRAFT: ['OAUTH_READY'],
  OAUTH_READY: ['API_ACCESS_READY'],
  API_ACCESS_READY: ['STORAGE_CREATED'],
  STORAGE_CREATED: ['SCRIPT_CREATED'],
  SCRIPT_CREATED: ['CODE_UPLOADED'],
  CODE_UPLOADED: ['DEPLOYED'],
  DEPLOYED: ['AWAITING_SCHOOL_AUTH'],
  AWAITING_SCHOOL_AUTH: ['VERIFIED'],
  VERIFIED: ['COMPLETE'],
  COMPLETE: [],
};

// 재개 정보에 들어가면 안 되는 키. 발견 즉시 거부한다.
const FORBIDDEN_KEYS = [
  'access_token', 'refresh_token', 'id_token',
  'admin_token', 'sync_key', 'submit_token', 'setup_key', 'secret',
];

export function createInstall({ installId, accountEmail, release }) {
  if (!installId || !accountEmail || !release) {
    throw new Error('installId, accountEmail, release가 필요합니다.');
  }
  return {
    install_id: installId,
    account_email: String(accountEmail).toLowerCase(),
    release,
    state: 'DRAFT',
    resources: {},
    stage_completed_at: {},
    created_at: new Date().toISOString(),
  };
}

/** 다음 단계로 전진. 계정 불일치·중복 자원·단계 건너뛰기를 거부한다. */
export function advance(install, toState, { accountEmail, resource } = {}) {
  if (!install || typeof install !== 'object') throw new Error('설치 정보가 없습니다.');
  const allowed = NEXT[install.state] || [];
  if (!allowed.includes(toState)) {
    throw new Error(`단계 건너뛰기 불가: ${install.state} → ${toState}`);
  }
  if (accountEmail && String(accountEmail).toLowerCase() !== install.account_email) {
    throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
  }
  if (resource) {
    for (const [k, v] of Object.entries(resource)) {
      if (FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f))) {
        throw new Error(`비밀값은 설치 정보에 보관할 수 없습니다: ${k}`);
      }
      if (install.resources[k] && install.resources[k] !== v) {
        throw new Error(`이미 생성된 자원이 있습니다(${k}). 중복 생성하지 않고 기존 자원을 사용하세요.`);
      }
      install.resources[k] = v;
    }
  }
  install.state = toState;
  install.stage_completed_at[toState] = new Date().toISOString();
  return install;
}

/** 객체 키를 재귀 검사한다. 값 부분문자열은 거부하지 않는다. */
export function hasForbiddenSecretKey(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenSecretKey);
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const lower = String(k).toLowerCase();
      if (FORBIDDEN_KEYS.some((f) => lower.includes(f))) return true;
      if (hasForbiddenSecretKey(value[k])) return true;
    }
  }
  return false;
}

/** 이어하기용 정보. 단계·자원 ID·릴리스만 포함한다. */
export function resumeInfo(install) {
  const info = {
    install_id: install.install_id,
    account_email: install.account_email,
    release: install.release,
    state: install.state,
    resources: { ...(install.resources || {}) },
  };
  if (hasForbiddenSecretKey(info)) throw new Error('재개 정보에 비밀값이 포함되어 있습니다.');
  return info;
}

/** 실제 연결검사(VERIFIED) 없이 완료로 표시할 수 없다. */
export function canComplete(install) {
  return install.state === 'VERIFIED';
}

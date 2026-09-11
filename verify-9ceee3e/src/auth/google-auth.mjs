// installer/src/auth/google-auth.mjs — GIS token model, 메모리 보관 전용.
// 토큰을 URL/localStorage/IndexedDB/로그/서버에 저장하지 않는다.
// 테스트 가능성을 위해 gis + storage(기본 메모리)를 주입받는다.
import { GOOGLE_OAUTH_CLIENT_ID, INSTALL_SCOPES } from './config.js';

export function createMemoryTokenStore() {
  let token = null;
  let expiresAt = 0;
  return {
    set(t, expiresInSec) {
      token = t;
      expiresAt = Date.now() + Number(expiresInSec || 0) * 1000;
    },
    get() {
      if (!token) return null;
      if (expiresAt && Date.now() > expiresAt - 30 * 1000) return null; // 만료 30초 전 무효
      return token;
    },
    clear() {
      token = null;
      expiresAt = 0;
    },
  };
}

export function normalizeAccountEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/** 입력 이메일과 토큰 소유자 이메일을 비교한다. 불일치·누락은 닫힌 실패. */
export function assertVerifiedAccount({ typedEmail, verifiedEmail } = {}) {
  const verified = normalizeAccountEmail(verifiedEmail);
  if (!verified) {
    throw new Error('Google 계정 정보를 확인할 수 없습니다. 다시 연결하세요.');
  }
  const typed = normalizeAccountEmail(typedEmail);
  if (!typed) {
    throw new Error('설치용 Google 계정 이메일을 입력하세요.');
  }
  if (typed !== verified) {
    throw new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.');
  }
  return verified;
}

const EMAIL_SCOPE_URL = 'https://www.googleapis.com/auth/userinfo.email';
const PROFILE_SCOPE_URL = 'https://www.googleapis.com/auth/userinfo.profile';

function canonicalScope(value) {
  if (value === EMAIL_SCOPE_URL) return 'email';
  if (value === PROFILE_SCOPE_URL) return 'profile';
  return value;
}

function parseScopeString(value) {
  if (typeof value !== 'string') return [];
  return value.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}

function parseRequestedScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  const out = [];
  for (const entry of scopes) {
    if (typeof entry !== 'string') continue;
    for (const part of entry.split(/\s+/)) {
      const v = part.trim();
      if (v) out.push(v);
    }
  }
  return out;
}

function coversRequestedScopes(actualTokens, requestedScopes) {
  const actual = new Set(actualTokens.map(canonicalScope));
  for (const req of parseRequestedScopes(requestedScopes)) {
    if (!actual.has(canonicalScope(req))) return false;
  }
  return true;
}

export function createGoogleAuth({ gis, store, clientId, scopes, onDenied } = {}) {
  const mem = store || createMemoryTokenStore();
  const id = clientId !== undefined ? clientId : GOOGLE_OAUTH_CLIENT_ID;
  const sc = scopes || INSTALL_SCOPES;
  let granted = [];

  function clearState() {
    try {
      mem.clear();
    } catch {
      // 메모리 초기화 실패 무시
    }
    granted = [];
  }

  function notifyDenied() {
    try {
      if (onDenied) onDenied();
    } catch {
      // 호출자 콜백 오류 무시
    }
  }

  function ensureGis() {
    if (!gis || !gis.accounts || !gis.accounts.oauth2) {
      throw new Error('Google 로그인 모듈을 불러오지 못했습니다. 네트워크 후 다시 시도하세요.');
    }
    if (!id) throw new Error('설치센터 Google 연결 정보가 준비되지 않았습니다. 제작자 준비 작업을 확인하세요.');
  }

  function requestAccess({ accountEmail } = {}) {
    clearState();
    try {
      ensureGis();
    } catch (e) {
      clearState();
      return Promise.reject(e);
    }
    return new Promise((resolve, reject) => {
      const failDenied = (message) => {
        clearState();
        notifyDenied();
        reject(new Error(message));
      };
      const failSafe = (message) => {
        clearState();
        reject(new Error(message));
      };
      let client;
      try {
        client = gis.accounts.oauth2.initTokenClient({
          client_id: id,
          scope: sc.join(' '),
          // 설치 시작 계정과 다른 계정 선택을 막기 위해 login_hint 사용(강제는 아님 → 서버에서 재확인).
          ...(accountEmail ? { login_hint: accountEmail } : {}),
          callback: (resp) => {
            try {
              const token = resp && resp.access_token;
              const actualTokens = parseScopeString(resp && resp.scope);
              if (!token || actualTokens.length === 0) {
                failDenied('Google 권한이 거부되었습니다. 설치를 계속하려면 권한을 허용하세요.');
                return;
              }
              if (!coversRequestedScopes(actualTokens, sc)) {
                failDenied('Google 권한이 부족합니다. 필요한 모든 권한을 허용한 뒤 다시 시도하세요.');
                return;
              }
              granted = [...actualTokens];
              mem.set(token, Number(resp.expires_in || 3600));
              resolve({ expires_in: Number(resp.expires_in || 3600), granted_scopes: granted.join(' ') });
            } catch {
              failSafe('Google 권한 확인에 실패했습니다. 다시 시도하세요.');
            }
          },
          error_callback: () => {
            failSafe('Google 연결이 중단되었습니다. 다시 시도하세요.');
          },
        });
      } catch {
        failSafe('Google 연결이 중단되었습니다. 다시 시도하세요.');
        return;
      }
      try {
        client.requestAccessToken({ prompt: '' });
      } catch {
        failSafe('Google 연결이 중단되었습니다. 다시 시도하세요.');
      }
    });
  }

  function getToken() {
    return mem.get();
  }

  function revoke() {
    let t = null;
    try {
      t = mem.get();
    } catch {
      t = null;
    }
    clearState();
    try {
      if (t && gis && gis.accounts && gis.accounts.oauth2 && typeof gis.accounts.oauth2.revoke === 'function') {
        gis.accounts.oauth2.revoke(t, () => {});
      }
    } catch {
      // 철회 실패해도 메모리에서는 지워진 상태 유지
    }
  }

  function grantedScopes() {
    try {
      if (!mem.get()) {
        granted = [];
        return [];
      }
    } catch {
      return [];
    }
    return [...granted];
  }

  return { requestAccess, getToken, revoke, grantedScopes };
}

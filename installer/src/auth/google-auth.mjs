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

export function createGoogleAuth({ gis, store, clientId, scopes, onDenied } = {}) {
  const mem = store || createMemoryTokenStore();
  const id = clientId !== undefined ? clientId : GOOGLE_OAUTH_CLIENT_ID;
  const sc = scopes || INSTALL_SCOPES;

  function ensureGis() {
    if (!gis || !gis.accounts || !gis.accounts.oauth2) {
      throw new Error('Google 로그인 모듈을 불러오지 못했습니다. 네트워크 후 다시 시도하세요.');
    }
    if (!id) throw new Error('설치센터 Google 연결 정보가 준비되지 않았습니다. 제작자 준비 작업을 확인하세요.');
  }

  function requestAccess({ accountEmail } = {}) {
    try {
      ensureGis();
    } catch (e) {
      return Promise.reject(e);
    }
    return new Promise((resolve, reject) => {
      let client;
      try {
        client = gis.accounts.oauth2.initTokenClient({
          client_id: id,
          scope: sc.join(' '),
          // 설치 시작 계정과 다른 계정 선택을 막기 위해 login_hint 사용(강제는 아님 → 서버에서 재확인).
          ...(accountEmail ? { login_hint: accountEmail } : {}),
          callback: (resp) => {
            if (resp && resp.access_token) {
              mem.set(resp.access_token, Number(resp.expires_in || 3600));
              resolve({ expires_in: Number(resp.expires_in || 3600), granted_scopes: resp.scope || '' });
            } else {
              const err = new Error('Google 권한이 거부되었습니다. 설치를 계속하려면 권한을 허용하세요.');
              if (onDenied) onDenied(resp);
              reject(err);
            }
          },
          error_callback: (err) => {
            reject(new Error('Google 연결 실패: ' + ((err && err.message) || '다시 시도하세요.')));
          },
        });
      } catch (e) {
        reject(e);
        return;
      }
      client.requestAccessToken({ prompt: '' });
    });
  }

  function getToken() {
    return mem.get();
  }

  function revoke() {
    const t = mem.get();
    mem.clear();
    try {
      if (t && gis && gis.accounts && gis.accounts.oauth2) gis.accounts.oauth2.revoke(t, () => {});
    } catch {
      // 철회 실패해도 메모리에서는 지워진 상태 유지
    }
  }

  function grantedScopes() {
    return [...sc];
  }

  return { requestAccess, getToken, revoke, grantedScopes };
}

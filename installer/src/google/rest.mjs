// installer/src/google/rest.mjs — Google REST 호출 공용 계층.
// - Authorization: Bearer <메모리 토큰> (URL·로그에 토큰 기록 금지)
// - 429/5xx만 제한 재시도(최대 3회, 지수 백오프). 4xx는 즉시 분류 반환.
// - Apps Script API 미허용 오류를 식별해 안내 단계로 연결한다.
export const SCRIPT_API_NOT_ENABLED_PATTERNS = [
  /apps scrip.*api.*has not been used/i,
  /access not configured/i,
  /api.*not enabled/i,
];

export function classifyError(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  if (status === 401) return { kind: 'UNAUTHENTICATED', retryable: false, message: 'Google 로그인이 만료되었습니다. 다시 연결하세요.' };
  if (status === 403) {
    if (SCRIPT_API_NOT_ENABLED_PATTERNS.some((p) => p.test(text))) {
      return {
        kind: 'SCRIPT_API_DISABLED',
        retryable: false,
        message: 'Google에서 프로그램 설치 권한을 한 번 허용해야 합니다. 설정에서 허용한 뒤 다시 확인하세요.',
      };
    }
    return { kind: 'FORBIDDEN', retryable: false, message: '권한이 부족합니다. 학교 계정과 승인 범위를 확인하세요.' };
  }
  if (status === 404) return { kind: 'NOT_FOUND', retryable: false, message: '대상이 없습니다. 이어하기 정보를 확인하세요.' };
  if (status === 429) return { kind: 'RATE_LIMITED', retryable: true, message: '요청이 많아 잠시 후 다시 시도합니다.' };
  if (status >= 500) return { kind: 'SERVER_ERROR', retryable: true, message: 'Google 서버 오류로 잠시 후 다시 시도합니다.' };
  return { kind: 'REQUEST_ERROR', retryable: false, message: '요청 실패(' + status + '). 입력값을 확인하세요.' };
}

export function sanitizeForLog(obj) {
  // 토큰·비밀키가 로그에 섞이지 않게 마스킹한다.
  const s = JSON.stringify(obj || {});
  return s.replace(/(ya29\.[A-Za-z0-9_-]{5})[A-Za-z0-9_.-]*/g, '$1…(masked)');
}

export function createRestClient({ fetchImpl, getToken, sleep } = {}) {
  const doFetch = fetchImpl || fetch;
  const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  async function call(method, url, { body, token } = {}) {
    const t = token || (getToken ? getToken() : null);
    if (!t) throw Object.assign(new Error('Google 연결이 끊겼습니다. 다시 연결하세요.'), { kind: 'NO_TOKEN' });
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await doFetch(url, {
          method,
          headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (e) {
        lastErr = Object.assign(new Error('네트워크 오류. 연결 후 다시 시도하세요.'), { kind: 'NETWORK', retryable: true });
        await wait(1000 * 2 ** attempt);
        continue;
      }
      if (res.ok) {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      }
      const errText = await res.text().catch(() => '');
      const classified = classifyError(res.status, errText);
      lastErr = Object.assign(new Error(classified.message), {
        kind: classified.kind,
        status: res.status,
        detail: errText.slice(0, 500),
      });
      if (!classified.retryable) throw lastErr;
      await wait(1000 * 2 ** attempt);
    }
    throw lastErr;
  }

  return {
    get: (url, opts) => call('GET', url, opts),
    post: (url, body, opts) => call('POST', url, { ...(opts || {}), body }),
    put: (url, body, opts) => call('PUT', url, { ...(opts || {}), body }),
  };
}

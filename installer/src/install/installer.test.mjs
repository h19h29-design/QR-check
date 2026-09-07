// installer Google 계층 테스트 (fake gis/fetch/리소스 — live 대체 아님)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAuth, createMemoryTokenStore } from '../auth/google-auth.mjs';
import { classifyError, createRestClient } from '../google/rest.mjs';
import { runToStorage, runToDeployed, checkSchoolVerified } from './orchestrator.mjs';
import { createInstall } from './state-machine.mjs';

function fakeGis({ token = 'ya29.test', denied = false } = {}) {
  return {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback }) => ({
          requestAccessToken: () => {
            if (denied) callback({});
            else callback({ access_token: token, expires_in: 3600, scope: 'openid' });
          },
        }),
        revoke: () => {},
      },
    },
  };
}

test('토큰은 메모리 보관, 거부 시 명확한 오류', async () => {
  const auth = createGoogleAuth({ gis: fakeGis(), clientId: 'test-client-id' });
  await auth.requestAccess({ accountEmail: 'o@t.e' });
  assert.equal(auth.getToken(), 'ya29.test');
  auth.revoke();
  assert.equal(auth.getToken(), null);

  const denied = createGoogleAuth({ gis: fakeGis({ denied: true }), clientId: 'test-client-id' });
  await assert.rejects(() => denied.requestAccess({}), /거부/);
});

test('client ID 미설정 시 설치를 시작하지 않는다', async () => {
  const auth = createGoogleAuth({ gis: fakeGis(), clientId: '' });
  await assert.rejects(() => auth.requestAccess({}), /준비/);
});

test('만료 임박 토큰은 무효', () => {
  const store = createMemoryTokenStore();
  store.set('t', 10); // 10초 → 30초 버퍼로 무효
  assert.equal(store.get(), null);
});

test('SCRIPT_API_DISABLED 분류', () => {
  const c = classifyError(403, { error: { message: 'Apps Script API has not been used in project' } });
  assert.equal(c.kind, 'SCRIPT_API_DISABLED');
  assert.equal(c.retryable, false);
  assert.equal(classifyError(401, '').kind, 'UNAUTHENTICATED');
  assert.equal(classifyError(429, '').retryable, true);
  assert.equal(classifyError(500, '').retryable, true);
  assert.equal(classifyError(404, '').retryable, false);
});

test('401/403은 재시도하지 않는다', async () => {
  let calls = 0;
  const rest = createRestClient({
    getToken: () => 't',
    sleep: () => Promise.resolve(),
    fetchImpl: async () => {
      calls++;
      return { ok: false, status: 403, text: async () => 'forbidden' };
    },
  });
  await assert.rejects(() => rest.get('https://x'), /권한/);
  assert.equal(calls, 1);
});

test('429는 재시도 후 성공한다', async () => {
  let calls = 0;
  const rest = createRestClient({
    getToken: () => 't',
    sleep: () => Promise.resolve(),
    fetchImpl: async () => {
      calls++;
      if (calls < 3) return { ok: false, status: 429, text: async () => 'slow' };
      return { ok: true, text: async () => '{"a":1}' };
    },
  });
  const res = await rest.get('https://x');
  assert.deepEqual(res, { a: 1 });
  assert.equal(calls, 3);
});

function fakeRes() {
  return {
    calls: [],
    async createDriveFolder(name) { this.calls.push(['folder', name]); return { id: 'f1', reused: false }; },
    async createSpreadsheet(title) { this.calls.push(['sheet', title]); return { spreadsheetId: 's1', reused: false }; },
    async moveIntoFolder() {},
    async createScriptProject(title) { this.calls.push(['script', title]); return { scriptId: 'sc1' }; },
    async uploadRuntime() { this.calls.push(['upload']); },
    async createVersion() { return { versionNumber: 1 }; },
    async createDeployment() {
      return { deploymentId: 'd1', webAppUrl: 'https://script.google.com/macros/s/XYZ/exec' };
    },
    async getSheetValues() { return [['setup_completed', 'true'], ['school_name', 'QR체크 테스트학교']]; },
  };
}

test('중단 후 재개: 기존 자원 재사용, 단계 건너뛰기 없음', async () => {
  const res = fakeRes();
  const install = createInstall({ installId: 'i1', accountEmail: 'o@t.e', release: 'v0.1.0' });
  await runToStorage({ install, accountEmail: 'o@t.e', res, prefix: 'QR_CHECK_E2E_20260907_' });
  assert.equal(install.state, 'STORAGE_CREATED');
  assert.equal(install.resources.spreadsheet_id, 's1');
  await runToDeployed({
    install, accountEmail: 'o@t.e', res, prefix: 'QR_CHECK_E2E_20260907_',
    runtimeFiles: [{ name: 'Code.gs', source: 'x' }], versionDescription: 'v0.1.0',
  });
  assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
  assert.ok(install.resources.web_app_url.includes('/exec'));
  const v = await checkSchoolVerified({ install, res });
  assert.equal(v.verified, true);
  assert.equal(install.state, 'VERIFIED');
});

test('다른 계정으로 재개하면 중단된다', async () => {
  const res = fakeRes();
  const install = createInstall({ installId: 'i1', accountEmail: 'o@t.e', release: 'v0.1.0' });
  await assert.rejects(
    runToStorage({ install, accountEmail: 'attacker@t.e', res, prefix: 'P_' }),
    /다른|다릅니다/,
  );
});

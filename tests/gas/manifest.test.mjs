// appsscript.json manifest 회귀 검증 (API 배포가 웹 진입점을 만들려면 webapp 블록 필수)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(here, '..', '..', 'apps-script', 'appsscript.json'), 'utf8'),
);

test('웹앱 실행 설정이 manifest에 고정된다', () => {
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal(manifest.timeZone, 'Asia/Seoul');
});

test('런타임 최소 scope가 유지된다', () => {
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/userinfo.email'));
  // 독립형/API 설치 프로젝트는 컨테이너가 없어 openById가 필요하므로 spreadsheets 전체 scope 사용.
  // currentonly로는 바인딩된 시트 ID 열기가 거부된다 (live 확인).
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
});

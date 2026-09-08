// 공개 exec URL (QR·제출 주소용) 회귀 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGas } from './loader.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminView = fs.readFileSync(
  path.resolve(here, '..', '..', 'apps-script', 'AdminView.html'),
  'utf8',
);
const setupView = fs.readFileSync(
  path.resolve(here, '..', '..', 'apps-script', 'WebApp.html'),
  'utf8',
);

test('publicExecUrl_은 /exec 주소를 반환한다', () => {
  const { api } = loadGas({});
  assert.equal(api.publicExecUrl_(), 'https://script.google.com/macros/s/TESTEXEC/exec');
});

test('publicExecUrl_은 미배포·/dev·임의 호스트 주소를 거부한다', () => {
  const { ctx, api } = loadGas({});
  ctx.ScriptApp.getService = () => ({ getUrl: () => null });
  assert.equal(api.publicExecUrl_(), '');
  ctx.ScriptApp.getService = () => ({ getUrl: () => 'https://script.google.com/macros/s/TESTEXEC/dev' });
  assert.equal(api.publicExecUrl_(), '');
  ctx.ScriptApp.getService = () => ({ getUrl: () => 'https://example.test/macros/s/TESTEXEC/exec' });
  assert.equal(api.publicExecUrl_(), '');
});

test('health 응답은 안전한 build 표식만 노출한다', () => {
  const { ctx } = loadGas({ activeEmail: 'owner@test.example', effectiveEmail: 'owner@test.example' });
  const output = ctx.doGet({ parameter: { page: 'health' } });
  const health = JSON.parse(output.content);
  assert.deepEqual(Object.keys(health).sort(), ['app', 'app_version', 'build_id', 'now', 'ok']);
  assert.equal(health.ok, true);
  assert.match(health.build_id, /^[a-z0-9][a-z0-9._-]+$/i);
});

test('초기 설정 화면에 테스트용 인증 우회 플래그가 남지 않는다', () => {
  assert.ok(!setupView.includes('TEST-SETUP'));
  assert.ok(!setupView.includes('testBootstrap'));
});

// Apps Script의 일반 출력(<?=)은 JSON 문자열을 JS 문자열로 다시 이스케이프한다.
// live v8에서 URL 양끝의 따옴표가 값에 남은 회귀를 막기 위한 템플릿 경계 검사다.
test('AdminView는 exec URL JSON 리터럴을 force-print한다', () => {
  assert.match(
    adminView,
    /window\.__EXEC_URL__\s*=\s*<\?!=\s*jsonForHtmlScript_\(data\.execUrl\s*\|\|\s*''\)\s*\?>;/,
  );
});

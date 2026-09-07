// installer/src/install/state-machine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATES, createInstall, advance, resumeInfo, canComplete } from './state-machine.mjs';

function happy() {
  const ins = createInstall({ installId: 'inst_1', accountEmail: 'Owner@test.example', release: 'v0.1.0' });
  const flow = [
    ['OAUTH_READY'],
    ['API_ACCESS_READY'],
    ['STORAGE_CREATED', { resource: { folder_id: 'f1', sheet_id: 's1' } }],
    ['SCRIPT_CREATED', { resource: { script_id: 'sc1' } }],
    ['CODE_UPLOADED'],
    ['DEPLOYED', { resource: { deployment_id: 'd1', web_app_url: 'https://script.google.com/exec' } }],
    ['AWAITING_SCHOOL_AUTH'],
    ['VERIFIED'],
    ['COMPLETE'],
  ];
  for (const [s, extra] of flow) advance(ins, s, { accountEmail: 'owner@test.example', ...(extra || {}) });
  return ins;
}

test('정상 흐름이 COMPLETE까지 간다', () => {
  const ins = happy();
  assert.equal(ins.state, 'COMPLETE');
  assert.ok(canComplete({ state: 'VERIFIED' }));
});

test('단계 건너뛰기는 거부된다', () => {
  const ins = createInstall({ installId: 'a', accountEmail: 'o@t.e', release: 'v0.1.0' });
  assert.throws(() => advance(ins, 'DEPLOYED', { accountEmail: 'o@t.e' }), /건너뛰기/);
});

test('다른 계정으로 이어하기는 거부된다', () => {
  const ins = createInstall({ installId: 'a', accountEmail: 'o@t.e', release: 'v0.1.0' });
  assert.throws(() => advance(ins, 'OAUTH_READY', { accountEmail: 'evil@t.e' }), /다른|다릅니다/);
});

test('비밀값은 설치 정보에 보관할 수 없다', () => {
  const ins = createInstall({ installId: 'a', accountEmail: 'o@t.e', release: 'v0.1.0' });
  advance(ins, 'OAUTH_READY', { accountEmail: 'o@t.e' });
  advance(ins, 'API_ACCESS_READY', { accountEmail: 'o@t.e' });
  assert.throws(
    () => advance(ins, 'STORAGE_CREATED', { accountEmail: 'o@t.e', resource: { access_token: 'x' } }),
    /비밀값/,
  );
});

test('중복 자원 생성을 막는다', () => {
  const ins = createInstall({ installId: 'a', accountEmail: 'o@t.e', release: 'v0.1.0' });
  advance(ins, 'OAUTH_READY', { accountEmail: 'o@t.e' });
  advance(ins, 'API_ACCESS_READY', { accountEmail: 'o@t.e' });
  advance(ins, 'STORAGE_CREATED', { accountEmail: 'o@t.e', resource: { sheet_id: 's1' } });
  const ins2 = createInstall({ installId: 'b', accountEmail: 'o@t.e', release: 'v0.1.0' });
  ins2.state = 'API_ACCESS_READY';
  ins2.resources = { sheet_id: 's1' };
  assert.throws(
    () => advance(ins2, 'STORAGE_CREATED', { accountEmail: 'o@t.e', resource: { sheet_id: 's2' } }),
    /이미 생성된 자원/,
  );
});

test('재개 정보에는 단계·자원·릴리스만 들어간다', () => {
  const ins = happy();
  const r = resumeInfo(ins);
  assert.equal(r.state, 'COMPLETE');
  assert.ok(r.resources.sheet_id);
  assert.ok(!('access_token' in r));
});

test('상태 목록이 스펙과 일치한다', () => {
  assert.deepEqual(STATES, [
    'DRAFT', 'OAUTH_READY', 'API_ACCESS_READY', 'STORAGE_CREATED', 'SCRIPT_CREATED',
    'CODE_UPLOADED', 'DEPLOYED', 'AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE',
  ]);
});

// Go Muse Contributor/xhigh; public synthetic only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInstall, resumeInfo } from '../src/install/state-machine.mjs';
let resume;
try {
  resume = await import('../src/install/resume.mjs');
} catch (e) {
  assert.match(String((e && e.message) || e), /ENOENT|Cannot find|Failed to load/i);
  throw new Error('missing feature installer/src/install/resume.mjs');
}
const { createResumeEnvelope, parseResumeEnvelope } = resume;
const ACCT = 'owner@example.com';
const REL = '1.0.0';
const COMMIT = 'a'.repeat(40);
const ctx = () => ({ accountEmail: ACCT, release: REL, sourceCommit: COMMIT });
const TOP = ['schema_version', 'source_commit', 'install_id', 'account_email', 'release', 'state', 'resources'].sort();
const draftEnv = () => ({ schema_version: 1, source_commit: COMMIT, install_id: 'inst-1', account_email: ACCT, release: REL, state: 'DRAFT', resources: {} });
const awaitingEnv = () => ({ schema_version: 1, source_commit: COMMIT, install_id: 'inst-9', account_email: ACCT, release: REL, state: 'AWAITING_SCHOOL_AUTH', resources: { install_prefix: 'demo', folder_id: 'fold-1', spreadsheet_id: 'sheet-1', script_id: 'scr-1', version_number: '3', deployment_id: 'dep-1', web_app_url: 'https://script.google.com/macros/s/Abc-123/exec' } });
test('create envelope from real install has exact schema, no secrets, no mutate', () => {
  const inst = createInstall({ installId: 'inst-1', accountEmail: ACCT, release: REL });
  const before = JSON.stringify(inst);
  const info = resumeInfo(inst);
  const env = createResumeEnvelope(info, COMMIT);
  assert.deepEqual(Object.keys(env).sort(), TOP);
  assert.equal(env.schema_version, 1);
  assert.equal(JSON.stringify(inst), before);
  assert.equal(JSON.stringify(env).includes('token'), false);
  assert.equal(JSON.stringify(env).includes('secret'), false);
  const back = parseResumeEnvelope(JSON.stringify(env), ctx());
  assert.deepEqual(back, env);
});
test('valid DRAFT and AWAITING roundtrip', () => {
  for (const env of [draftEnv(), awaitingEnv()]) {
    const got = parseResumeEnvelope(JSON.stringify(env), ctx());
    assert.deepEqual(got, env);
  }
});
test('rejects malformed shape', () => {
  const big = JSON.stringify(draftEnv()).padEnd(16385, ' ');
  const cases = [
    ['malformed', '{oops', ctx()],
    ['oversized', big, ctx()],
    ['null', 'null', ctx()],
    ['array', '[]', ctx()],
    ['unknown top', JSON.stringify({ ...draftEnv(), extra: 1 }), ctx()],
    ['timestamps', JSON.stringify({ ...draftEnv(), created_at: 'x' }), ctx()],
    ['proto', '{"schema_version":1,"source_commit":"' + COMMIT + '","install_id":"inst-1","account_email":"' + ACCT + '","release":"' + REL + '","state":"DRAFT","resources":{},"__proto__":{"x":1}}', ctx()],
    ['nested secret', JSON.stringify({ ...draftEnv(), resources: { install_prefix: 'a', access_token: 't' } }), ctx()],
    ['nested object', JSON.stringify({ ...draftEnv(), resources: { install_prefix: { x: 1 } } }), ctx()],
    ['unknown resource', JSON.stringify({ ...draftEnv(), resources: { install_prefix: 'a', unknown_x: '1' } }), ctx()],
    ['constructor', JSON.stringify({ ...draftEnv(), resources: { install_prefix: 'a', constructor: '1' } }), ctx()],
    ['array value', JSON.stringify({ ...draftEnv(), resources: { install_prefix: ['a'] } }), ctx()],
    ['null value', JSON.stringify({ ...draftEnv(), resources: { install_prefix: null } }), ctx()],
  ];
  for (const [n, text] of cases) assert.throws(() => parseResumeEnvelope(text, ctx()), /./, n);
});
test('rejects trust mismatch', () => {
  const badAcct = { ...draftEnv(), account_email: 'other@example.com' };
  const badRel = { ...draftEnv(), release: '9.9.9' };
  const badCommit = { ...draftEnv(), source_commit: 'b'.repeat(40) };
  const badId = { ...draftEnv(), install_id: '' };
  const badState = { ...draftEnv(), state: 'NOPE' };
  assert.throws(() => parseResumeEnvelope(JSON.stringify(badAcct), ctx()));
  assert.throws(() => parseResumeEnvelope(JSON.stringify(badRel), ctx()));
  assert.throws(() => parseResumeEnvelope(JSON.stringify(badCommit), ctx()));
  assert.throws(() => parseResumeEnvelope(JSON.stringify(badId), ctx()));
  assert.throws(() => parseResumeEnvelope(JSON.stringify(badState), ctx()));
});
test('requires IDs per state', () => {
  const noPrefix = { ...awaitingEnv(), state: 'API_ACCESS_READY', resources: { folder_id: 'fold-1' } };
  const noFolder = { ...awaitingEnv(), state: 'API_ACCESS_READY', resources: { install_prefix: 'demo' } };
  const noSheet = { ...awaitingEnv(), state: 'STORAGE_CREATED', resources: { install_prefix: 'demo', folder_id: 'fold-1' } };
  const noScript = { ...awaitingEnv(), state: 'SCRIPT_CREATED', resources: { install_prefix: 'demo', folder_id: 'fold-1', spreadsheet_id: 'sheet-1' } };
  const noDeploy = { ...awaitingEnv(), state: 'DEPLOYED', resources: { install_prefix: 'demo', folder_id: 'fold-1', spreadsheet_id: 'sheet-1', script_id: 'scr-1' } };
  const draftWithFolder = { ...draftEnv(), resources: { folder_id: 'fold-1' } };
  const oauthWithSheet = { ...draftEnv(), state: 'OAUTH_READY', resources: { install_prefix: 'demo', spreadsheet_id: 'sheet-1' } };
  for (const [n, e] of Object.entries({ noPrefix, noFolder, noSheet, noScript, noDeploy, draftWithFolder, oauthWithSheet })) assert.throws(() => parseResumeEnvelope(JSON.stringify(e), ctx()), /./, n);
});
test('accepts lower-stage optional sheet/script and CODE_UPLOADED version', () => {
  const apiWithSheet = { ...awaitingEnv(), state: 'API_ACCESS_READY', resources: { install_prefix: 'demo', folder_id: 'fold-1', spreadsheet_id: 'sheet-1' } };
  const storWithScript = { ...awaitingEnv(), state: 'STORAGE_CREATED', resources: { install_prefix: 'demo', folder_id: 'fold-1', spreadsheet_id: 'sheet-1', script_id: 'scr-1' } };
  const codeWithVer = { ...awaitingEnv(), state: 'CODE_UPLOADED', resources: { install_prefix: 'demo', folder_id: 'fold-1', spreadsheet_id: 'sheet-1', script_id: 'scr-1', version_number: '2' } };
  for (const e of [apiWithSheet, storWithScript, codeWithVer]) parseResumeEnvelope(JSON.stringify(e), ctx());
  const earlyVer = { ...draftEnv(), resources: { install_prefix: 'a', version_number: '1' } };
  const earlyDep = { ...draftEnv(), state: 'STORAGE_CREATED', resources: { install_prefix: 'demo', folder_id: 'f', spreadsheet_id: 's', deployment_id: 'd' } };
  assert.throws(() => parseResumeEnvelope(JSON.stringify(earlyVer), ctx()));
  assert.throws(() => parseResumeEnvelope(JSON.stringify(earlyDep), ctx()));
});
test('rejects unsafe URL', () => {
  const bad = ['http://script.google.com/macros/s/x/exec', 'https://script.google.com/macros/s/x/exec?q=1', 'https://evil.example/s/x/exec', 'https://script.google.com:443/macros/s/x/exec', 'https://script.google.com/macros/s/x/exec#h'];
  for (const u of bad) {
    const e = { ...awaitingEnv(), resources: { ...awaitingEnv().resources, web_app_url: u } };
    assert.throws(() => parseResumeEnvelope(JSON.stringify(e), ctx()), /./, u);
  }
});
test('pending marker blocks import without mutation', () => {
  const e = { ...awaitingEnv(), resources: { ...awaitingEnv().resources, operation_pending: 'deploy' } };
  const text = JSON.stringify(e);
  assert.throws(() => parseResumeEnvelope(text, ctx()));
  assert.equal(JSON.parse(text).resources.operation_pending, 'deploy');
});

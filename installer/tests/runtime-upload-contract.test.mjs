import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResourceClients } from '../src/google/resources.mjs';

const BASE = 'https://script.googleapis.com/v1';
const UNKNOWN = '요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.';

const CODE_SRC = 'function main(){ return 1; }';
const SUBMIT_SRC = '<html><body>submit</body></html>';
const CLIENT_SRC = 'console.log("client");';
const MANIFEST_SRC = '{"timeZone":"Asia/Seoul"}';
const SCRIPT_ID = 'test-script-1';

const REQ = [
  { name: 'Code.gs', source: CODE_SRC },
  { name: 'SubmitView.html', source: SUBMIT_SRC },
  { name: 'Client.js.html', source: CLIENT_SRC },
  { name: 'appsscript.json', source: MANIFEST_SRC },
];

const EXPECTED_BODY = {
  files: [
    { name: 'Code', type: 'SERVER_JS', source: CODE_SRC },
    { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC },
    { name: 'Client.js', type: 'HTML', source: CLIENT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
  ],
};

function setup(payload) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    let parsed;
    try {
      parsed = JSON.parse(init.body);
    } catch {
      parsed = undefined;
    }
    calls.push({ url, method: init.method, body: parsed });
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
  const client = createResourceClients({ fetchImpl, getToken: () => 'tok' });
  return { calls, client };
}

function assertUnknown(err, calls, forbidden = []) {
  assert.ok(err, 'expected to throw');
  assert.equal(err.kind, 'OUTCOME_UNKNOWN');
  assert.equal(err.retryable, false);
  assert.equal(err.message, UNKNOWN);
  assert.equal(calls.length, 1);
  assert.equal(err.cause, undefined);
  assert.equal(err.body, undefined);
  assert.equal(err.response, undefined);
  const flat = String(err.message) + ' ' + JSON.stringify(err);
  for (const s of forbidden) {
    assert.ok(!flat.includes(s), `must not leak ${s}`);
  }
}

test('maps names stripping final extension and PUTs literal body', async () => {
  const payload = { scriptId: SCRIPT_ID, files: EXPECTED_BODY.files };
  const { calls, client } = setup(payload);
  await client.uploadRuntime(SCRIPT_ID, REQ);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].url, `${BASE}/projects/${SCRIPT_ID}/content`);
  assert.deepStrictEqual(calls[0].body, {
    files: [
      { name: 'Code', type: 'SERVER_JS', source: 'function main(){ return 1; }' },
      { name: 'SubmitView', type: 'HTML', source: '<html><body>submit</body></html>' },
      { name: 'Client.js', type: 'HTML', source: 'console.log("client");' },
      { name: 'appsscript', type: 'JSON', source: '{"timeZone":"Asia/Seoul"}' },
    ],
  });
});

test('encodes special project id in PUT path', async () => {
  const sid = 'Ab C/D:E';
  const encoded = 'Ab%20C%2FD%3AE';
  const ok = { scriptId: sid, files: [{ name: 'Code', type: 'SERVER_JS', source: 'const A=1;' }] };
  const { calls, client } = setup(ok);
  await client.uploadRuntime(sid, [{ name: 'Code.gs', source: 'const A=1;' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].url, `${BASE}/projects/${encoded}/content`);
  assert.deepStrictEqual(calls[0].body, { files: [{ name: 'Code', type: 'SERVER_JS', source: 'const A=1;' }] });
});

test('accepts reordered files with server metadata', async () => {
  const payload = {
    scriptId: SCRIPT_ID,
    files: [
      { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC, createTime: '2026-01-01T00:00:00Z' },
      { name: 'Client.js', type: 'HTML', source: CLIENT_SRC, updateTime: '2026-01-02T00:00:00Z' },
      { name: 'Code', type: 'SERVER_JS', source: CODE_SRC, functionSet: {} },
      { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC, createTime: '2026-01-01T00:00:00Z' },
    ],
  };
  const { calls, client } = setup(payload);
  const out = await client.uploadRuntime(SCRIPT_ID, REQ);
  assert.equal(calls.length, 1);
  assert.deepStrictEqual(calls[0].body, EXPECTED_BODY);
  assert.equal(out.scriptId, SCRIPT_ID);
  assert.ok(Array.isArray(out.files));
});

function expectReject(label, payload, forbidden = []) {
  test(`rejects ${label} as OUTCOME_UNKNOWN after one PUT`, async () => {
    const { calls, client } = setup(payload);
    let err;
    try {
      await client.uploadRuntime(SCRIPT_ID, REQ);
    } catch (e) {
      err = e;
    }
    assertUnknown(err, calls, forbidden);
    assert.equal(calls[0].method, 'PUT');
    assert.equal(calls[0].url, `${BASE}/projects/${SCRIPT_ID}/content`);
    assert.deepStrictEqual(calls[0].body, EXPECTED_BODY);
  });
}

expectReject('missing scriptId', { files: EXPECTED_BODY.files });
expectReject('wrong scriptId', { scriptId: 'other-id', files: EXPECTED_BODY.files }, ['other-id']);
expectReject('missing files', { scriptId: SCRIPT_ID });
expectReject('non-array files', { scriptId: SCRIPT_ID, files: 'not-an-array' }, ['not-an-array']);
expectReject('empty files', { scriptId: SCRIPT_ID, files: [] });
expectReject('duplicate files', {
  scriptId: SCRIPT_ID,
  files: [
    { name: 'Code', type: 'SERVER_JS', source: CODE_SRC },
    { name: 'Code', type: 'SERVER_JS', source: CODE_SRC },
    { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
  ],
});
expectReject('extra file', {
  scriptId: SCRIPT_ID,
  files: [
    { name: 'Code', type: 'SERVER_JS', source: CODE_SRC },
    { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC },
    { name: 'Client.js', type: 'HTML', source: CLIENT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
    { name: 'Extra', type: 'SERVER_JS', source: 'const X=1;' },
  ],
}, ['Extra']);
expectReject('missing file', {
  scriptId: SCRIPT_ID,
  files: [
    { name: 'Code', type: 'SERVER_JS', source: CODE_SRC },
    { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
  ],
});
expectReject('mismatched type', {
  scriptId: SCRIPT_ID,
  files: [
    { name: 'Code', type: 'HTML', source: CODE_SRC },
    { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC },
    { name: 'Client.js', type: 'HTML', source: CLIENT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
  ],
});
expectReject('mismatched name with extension', {
  scriptId: SCRIPT_ID,
  files: [
    { name: 'Code', type: 'SERVER_JS', source: CODE_SRC },
    { name: 'SubmitView.html', type: 'HTML', source: SUBMIT_SRC },
    { name: 'Client.js', type: 'HTML', source: CLIENT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
  ],
}, ['SubmitView.html']);
expectReject('mismatched source', {
  scriptId: SCRIPT_ID,
  files: [
    { name: 'Code', type: 'SERVER_JS', source: 'TAMPERED-SOURCE-xyz-123' },
    { name: 'SubmitView', type: 'HTML', source: SUBMIT_SRC },
    { name: 'Client.js', type: 'HTML', source: CLIENT_SRC },
    { name: 'appsscript', type: 'JSON', source: MANIFEST_SRC },
  ],
}, ['TAMPERED-SOURCE-xyz-123']);

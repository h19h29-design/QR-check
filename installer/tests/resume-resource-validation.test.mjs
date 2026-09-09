// Go Muse/xhigh; public synthetic only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResumeEnvelope, restoreInstallFromSnapshot } from '../src/install/resume.mjs';
import { names } from '../src/google/resources.mjs';
const PREFIX = 'QR_DEMO_';
const N = names(PREFIX);
const ACCOUNT = 'owner@example.com';
const RELEASE = '1.0.0';
const COMMIT = 'a'.repeat(40);
const URL = 'https://script.google.com/macros/s/mock/exec';
const RT = [{ name: 'Code.gs', source: '// synthetic' }, { name: 'appsscript.json', source: '{}' }];
const EXP = [{ name: 'Code', type: 'SERVER_JS', source: '// synthetic' }, { name: 'appsscript', type: 'JSON', source: '{}' }];
const BASE = { install_prefix: PREFIX, folder_id: 'f1', spreadsheet_id: 's1', script_id: 'sc1', version_number: '1', deployment_id: 'd1', web_app_url: URL };
const MT = { f: 'application/vnd.google-apps.folder', s: 'application/vnd.google-apps.spreadsheet', c: 'application/vnd.google-apps.script' };
function txt(state, res) { return JSON.stringify(createResumeEnvelope({ install_id: 'i1', account_email: ACCOUNT, release: RELEASE, state, resources: res, stage_completed_at: {} }, COMMIT)); }
function md(id, name, mime, parents) { return { id, name, mimeType: mime, ownedByMe: true, trashed: false, parents: parents || [] }; }
function V(o = {}) {
  const st = { n: 0 };
  return {
    async getFileMetadata(id) { st.n++; if (id === 'f1') return { ...md('f1', N.folder, MT.f), ...o.F }; if (id === 's1') return { ...md('s1', N.sheet, MT.s, ['f1']), ...o.S }; if (id === 'sc1') return { ...md('sc1', N.script, MT.c), ...o.P }; throw Object.assign(new Error('not found'), { status: 404 }); },
    async getContent(id, v) { st.n++; if (id !== 'sc1') throw Object.assign(new Error('not found'), { status: 404 }); const f = o.files || EXP; if (v === undefined) return { scriptId: 'sc1', files: structuredClone(f) }; if (Number.isSafeInteger(v) && v === 1) return { scriptId: 'sc1', files: structuredClone(o.vf || f) }; throw Object.assign(new Error('bad version'), { status: 400 }); },
    async getDeployment(s, d) { st.n++; if (s !== 'sc1' || d !== 'd1') throw Object.assign(new Error('not found'), { status: 404 }); return o.dep || { deploymentId: 'd1', deploymentConfig: { scriptId: 'sc1', versionNumber: 1, manifestFileName: 'appsscript' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: URL } }] }; },
    _n: st,
  };
}
function A(state, res, ov = {}) { return { text: txt(state, res), accountEmail: ACCOUNT, release: RELEASE, sourceCommit: COMMIT, res: V(ov), runtimeFiles: structuredClone(RT) }; }
test('valid DEPLOYED resets, cloned, stage empty, no mutation', async () => {
  const a = A('DEPLOYED', BASE);
  assert.deepEqual(Object.keys(a.res).filter((k) => !k.startsWith('_')).sort(), ['getContent', 'getDeployment', 'getFileMetadata']);
  const out = await restoreInstallFromSnapshot(a);
  assert.equal(out.state, 'AWAITING_SCHOOL_AUTH');
  assert.deepEqual(out.stage_completed_at, {});
  assert.equal(out.account_email, ACCOUNT);
  assert.deepEqual(out.resources, BASE);
  assert.ok(a.res._n.n >= 5);
  assert.deepEqual(a.runtimeFiles, RT);
});
test('owned/name/id/trashed/mime/parent mismatch rejects', async () => {
  const bad = [[{ F: { ownedByMe: false } }], [{ F: { name: 'WRONG' } }], [{ F: { id: 'other' } }], [{ S: { trashed: true } }], [{ P: { mimeType: MT.f } }], [{ S: { parents: ['other'] } }], [{ F: { mimeType: MT.s } }]];
  for (const [ov] of bad) await assert.rejects(() => restoreInstallFromSnapshot(A('DEPLOYED', BASE, ov)));
});
test('HEAD/version/content/deployment mismatch rejects', async () => {
  const extra = [...EXP, { name: 'X', type: 'SERVER_JS', source: 'x' }];
  const badDepVer = { deploymentId: 'd1', deploymentConfig: { scriptId: 'sc1', versionNumber: 2, manifestFileName: 'appsscript' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: URL } }] };
  const badDepUrl = { deploymentId: 'd1', deploymentConfig: { scriptId: 'sc1', versionNumber: 1, manifestFileName: 'appsscript' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'https://script.google.com/macros/s/other/exec' } }] };
  const badDepId = { deploymentId: 'other', deploymentConfig: { scriptId: 'sc1', versionNumber: 1, manifestFileName: 'appsscript' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: URL } }] };
  const cases = [{ files: [EXP[0]] }, { files: extra }, { files: [{ ...EXP[0], source: 'tampered' }, EXP[1]] }, { files: [EXP[0], EXP[0]] }, { vf: [{ ...EXP[0], source: 'other' }, EXP[1]] }, { dep: badDepVer }, { dep: badDepUrl }, { dep: badDepId }];
  for (const ov of cases) await assert.rejects(() => restoreInstallFromSnapshot(A('DEPLOYED', BASE, ov)));
});
test('pending/account/commit fail before reads', async () => {
  const t = JSON.stringify(createResumeEnvelope({ install_id: 'i1', account_email: ACCOUNT, release: RELEASE, state: 'API_ACCESS_READY', resources: { install_prefix: PREFIX, folder_id: 'f1', operation_pending: 'op1' }, stage_completed_at: {} }, COMMIT));
  const r0 = V();
  await assert.rejects(() => restoreInstallFromSnapshot({ text: t, accountEmail: ACCOUNT, release: RELEASE, sourceCommit: COMMIT, res: r0, runtimeFiles: structuredClone(RT) }));
  assert.equal(r0._n.n, 0);
  const a1 = A('DEPLOYED', BASE); a1.accountEmail = 'foreign@example.com';
  await assert.rejects(() => restoreInstallFromSnapshot(a1)); assert.equal(a1.res._n.n, 0);
  const a2 = A('DEPLOYED', BASE); a2.sourceCommit = 'b'.repeat(40);
  await assert.rejects(() => restoreInstallFromSnapshot(a2)); assert.equal(a2.res._n.n, 0);
});
test('SCRIPT_CREATED user code rejects; empty/default allow', async () => {
  const R = { install_prefix: PREFIX, folder_id: 'f1', spreadsheet_id: 's1', script_id: 'sc1' };
  await assert.rejects(() => restoreInstallFromSnapshot(A('SCRIPT_CREATED', R, { files: [{ name: 'Code', type: 'SERVER_JS', source: 'function user(){}' }, EXP[1]] })));
  const okEmpty = await restoreInstallFromSnapshot(A('SCRIPT_CREATED', R, { files: [] }));
  assert.equal(okEmpty.state, 'SCRIPT_CREATED'); assert.deepEqual(okEmpty.stage_completed_at, {});
  const okDef = await restoreInstallFromSnapshot(A('SCRIPT_CREATED', R, { files: [{ name: 'appsscript', type: 'JSON', source: '{}' }] }));
  assert.equal(okDef.state, 'SCRIPT_CREATED');
});
test('API_ACCESS_READY unmoved sheet succeeds; errors sanitized', async () => {
  const R = { install_prefix: PREFIX, folder_id: 'f1', spreadsheet_id: 's1' };
  const out = await restoreInstallFromSnapshot(A('API_ACCESS_READY', R, { S: { parents: ['root'] } }));
  assert.equal(out.state, 'API_ACCESS_READY'); assert.deepEqual(out.stage_completed_at, {});
  const bad = V(); bad.getFileMetadata = async () => { throw new Error('RAW-SECRET-xyz'); };
  const t = txt('STORAGE_CREATED', { install_prefix: PREFIX, folder_id: 'f1', spreadsheet_id: 's1', script_id: 'sc1' });
  await assert.rejects(() => restoreInstallFromSnapshot({ text: t, accountEmail: ACCOUNT, release: RELEASE, sourceCommit: COMMIT, res: bad, runtimeFiles: structuredClone(RT) }), (e) => !String(e && e.message).includes('RAW-SECRET-xyz'));
});
test('normalization: DRAFT/OAUTH_READY->DRAFT, COMPLETE->AWAITING, others retain', async () => {
  assert.equal((await restoreInstallFromSnapshot(A('DRAFT', { install_prefix: PREFIX }))).state, 'DRAFT');
  assert.equal((await restoreInstallFromSnapshot(A('OAUTH_READY', { install_prefix: PREFIX }))).state, 'DRAFT');
  assert.equal((await restoreInstallFromSnapshot(A('CODE_UPLOADED', { install_prefix: PREFIX, folder_id: 'f1', spreadsheet_id: 's1', script_id: 'sc1' }))).state, 'CODE_UPLOADED');
  assert.equal((await restoreInstallFromSnapshot(A('COMPLETE', BASE))).state, 'AWAITING_SCHOOL_AUTH');
  assert.deepEqual((await restoreInstallFromSnapshot(A('DRAFT', { install_prefix: PREFIX }))).stage_completed_at, {});
});

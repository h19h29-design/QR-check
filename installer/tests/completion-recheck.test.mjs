// installer/tests/completion-recheck.test.mjs — completeSchoolInstall recheck contract.
// setup_completed marker proves initial setup only, not operational QR/attachments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstall, advance } from '../src/install/state-machine.mjs';

const ACCT = 'o@t.e';

async function loadComplete() {
  const ns = await import('../src/install/orchestrator.mjs');
  assert.equal(typeof ns.completeSchoolInstall, 'function', 'missing feature: completeSchoolInstall');
  return ns.completeSchoolInstall;
}

function baseInstall(id = 'i1') {
  return createInstall({ installId: id, accountEmail: ACCT, release: 'v0.1.0' });
}

function toVerified(install, sheet = 's1') {
  advance(install, 'OAUTH_READY', { accountEmail: ACCT });
  advance(install, 'API_ACCESS_READY', { accountEmail: ACCT, resource: { folder_id: 'f1' } });
  advance(install, 'STORAGE_CREATED', { accountEmail: ACCT, resource: { folder_id: 'f1', spreadsheet_id: sheet } });
  advance(install, 'SCRIPT_CREATED', { accountEmail: ACCT, resource: { script_id: 'sc1' } });
  advance(install, 'CODE_UPLOADED', { accountEmail: ACCT });
  advance(install, 'DEPLOYED', { accountEmail: ACCT, resource: { version_number: '1', deployment_id: 'd1', web_app_url: 'https://script.google.com/macros/s/XYZ/exec' } });
  advance(install, 'AWAITING_SCHOOL_AUTH', { accountEmail: ACCT });
  advance(install, 'VERIFIED', { accountEmail: ACCT });
  return install;
}

function toAwaiting(install, sheet = 's1') {
  advance(install, 'OAUTH_READY', { accountEmail: ACCT });
  advance(install, 'API_ACCESS_READY', { accountEmail: ACCT, resource: { folder_id: 'f1' } });
  advance(install, 'STORAGE_CREATED', { accountEmail: ACCT, resource: { folder_id: 'f1', spreadsheet_id: sheet } });
  advance(install, 'SCRIPT_CREATED', { accountEmail: ACCT, resource: { script_id: 'sc1' } });
  advance(install, 'CODE_UPLOADED', { accountEmail: ACCT });
  advance(install, 'DEPLOYED', { accountEmail: ACCT, resource: { version_number: '1', deployment_id: 'd1', web_app_url: 'https://script.google.com/macros/s/XYZ/exec' } });
  advance(install, 'AWAITING_SCHOOL_AUTH', { accountEmail: ACCT });
  return install;
}

function makeRes(marker = 'true', { fail = false, state = null } = {}) {
  const st = state || { calls: 0 };
  return {
    state: st,
    async getSheetValues(spreadsheetId, range) {
      st.calls += 1;
      assert.equal(spreadsheetId, 's1');
      assert.ok(String(range).includes('settings_school'));
      if (fail) throw Object.assign(new Error('read fail'), { kind: 'REQUEST_ERROR' });
      if (marker === 'missing') return [['school_name', 'T']];
      return [['setup_completed', marker], ['school_name', 'T']];
    },
  };
}

test('VERIFIED+true advances COMPLETE once; COMPLETE+true rechecks but leaves timestamps unchanged', async () => {
  const completeSchoolInstall = await loadComplete();
  const install = toVerified(baseInstall('i-complete'));
  const res = makeRes('true');
  const verifiedAt = install.stage_completed_at.VERIFIED;
  await completeSchoolInstall({ install, res, accountEmail: ACCT });
  assert.equal(install.state, 'COMPLETE');
  assert.ok(install.stage_completed_at.COMPLETE);
  assert.equal(install.stage_completed_at.VERIFIED, verifiedAt);
  assert.equal(res.state.calls, 1);
  const snap = JSON.stringify({ t: install.stage_completed_at, r: install.resources, s: install.state });
  await completeSchoolInstall({ install, res, accountEmail: ACCT });
  assert.equal(install.state, 'COMPLETE');
  assert.equal(res.state.calls, 2);
  assert.equal(JSON.stringify({ t: install.stage_completed_at, r: install.resources, s: install.state }), snap);
});

test('VERIFIED+false rejects, never COMPLETE or mutate', async () => {
  const completeSchoolInstall = await loadComplete();
  const install = toVerified(baseInstall('i-false'));
  const res = makeRes('false');
  const before = JSON.stringify(install);
  await assert.rejects(() => completeSchoolInstall({ install, res, accountEmail: ACCT }));
  assert.equal(res.state.calls, 1);
  assert.equal(install.state, 'VERIFIED');
  assert.equal(JSON.stringify(install), before);
});

test('read-error/mismatch/absent/earlier/pending never COMPLETE or mutate', async () => {
  const completeSchoolInstall = await loadComplete();
  {
    const install = toVerified(baseInstall('i-err'));
    const res = makeRes('true', { fail: true });
    const before = JSON.stringify(install);
    await assert.rejects(() => completeSchoolInstall({ install, res, accountEmail: ACCT }));
    assert.equal(install.state, 'VERIFIED');
    assert.equal(JSON.stringify(install), before);
  }
  {
    const install = toVerified(baseInstall('i-mismatch'));
    const res = makeRes('true');
    const before = JSON.stringify(install);
    await assert.rejects(() => completeSchoolInstall({ install, res, accountEmail: 'attacker@t.e' }));
    assert.equal(JSON.stringify(install), before);
    assert.notEqual(install.state, 'COMPLETE');
  }
  {
    const install = toVerified(baseInstall('i-absent'));
    const res = makeRes('true');
    const before = JSON.stringify(install);
    await assert.rejects(() => completeSchoolInstall({ install, res, accountEmail: '' }));
    await assert.rejects(() => completeSchoolInstall({ install, res }));
    assert.equal(JSON.stringify(install), before);
  }
  {
    const install = toAwaiting(baseInstall('i-early'));
    const res = makeRes('true');
    const before = JSON.stringify(install);
    await assert.rejects(() => completeSchoolInstall({ install, res, accountEmail: ACCT }));
    assert.equal(JSON.stringify(install), before);
    assert.notEqual(install.state, 'COMPLETE');
  }
  {
    const install = toVerified(baseInstall('i-pending'));
    install.resources.operation_pending = 'create-folder';
    const res = makeRes('true');
    await assert.rejects(() => completeSchoolInstall({ install, res, accountEmail: ACCT }));
    assert.equal(install.state, 'VERIFIED');
    assert.equal(install.resources.operation_pending, 'create-folder');
    assert.ok(!install.stage_completed_at.COMPLETE);
  }
});

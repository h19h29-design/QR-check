// installer/tests/install-operation-safety.test.mjs — TESTS ONLY.
// Run: node --test installer/tests/install-operation-safety.test.mjs
// Real runToStorage/runToDeployed with injected async res only. Synthetic fixtures, no secrets.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInstall, advance } from '../src/install/state-machine.mjs';
import { runToStorage, runToDeployed } from '../src/install/orchestrator.mjs';

const OWNER = 'owner@school.kr';
const OTHER = 'admin@school.kr';
const RELEASE = '0.1.0';

function toApiReadyInstall() {
  const install = createInstall({ installId: 'install-synthetic001', accountEmail: OWNER, release: RELEASE });
  advance(install, 'OAUTH_READY', { accountEmail: OWNER });
  advance(install, 'API_ACCESS_READY', { accountEmail: OWNER, resource: { folder_id: 'synthetic-folder-001' } });
  install.resources.spreadsheet_id = 'synthetic-sheet-001';
  return install;
}

function toStorageCreatedInstall() {
  const install = toApiReadyInstall();
  advance(install, 'STORAGE_CREATED', {
    accountEmail: OWNER,
    resource: { folder_id: 'synthetic-folder-001', spreadsheet_id: 'synthetic-sheet-001' },
  });
  return install;
}

describe('install operation safety (real orchestrator, injected res)', () => {
  it('account mismatch at API_ACCESS_READY/STORAGE_CREATED causes zero API calls', async () => {
    {
      const install = toApiReadyInstall();
      const calls = [];
      const res = {
        createDriveFolder: async () => { calls.push('createDriveFolder'); return { id: 'synthetic-folder-001' }; },
        createSpreadsheet: async () => { calls.push('createSpreadsheet'); return { spreadsheetId: 'synthetic-sheet-001' }; },
        moveIntoFolder: async () => { calls.push('moveIntoFolder'); return {}; },
      };
      await assert.rejects(
        runToStorage({ install, accountEmail: OTHER, res, prefix: 'QR_SYNTHETIC_' }),
        /다릅니다|mismatch/i,
      );
      assert.equal(calls.length, 0, `mismatch at API_ACCESS_READY must cause zero API calls, got ${calls.join(',')}`);
      assert.equal(install.state, 'API_ACCESS_READY');
    }
    {
      const install = toStorageCreatedInstall();
      const calls = [];
      const res = {
        createScriptProject: async () => { calls.push('createScriptProject'); return { scriptId: 'synthetic-script-001' }; },
        uploadRuntime: async () => { calls.push('uploadRuntime'); return {}; },
        createVersion: async () => { calls.push('createVersion'); return { versionNumber: 1 }; },
        createDeployment: async () => { calls.push('createDeployment'); return { deploymentId: 'synthetic-dep-001', webAppUrl: 'https://script.google.com/macros/s/synthetic/exec' }; },
        updateDeployment: async () => { calls.push('updateDeployment'); return {}; },
      };
      await assert.rejects(
        runToDeployed({ install, accountEmail: OTHER, res, prefix: 'QR_SYNTHETIC_', runtimeFiles: [], versionDescription: 'maker 0.1.0' }),
        /다릅니다|mismatch/i,
      );
      assert.equal(calls.length, 0, `mismatch at STORAGE_CREATED must cause zero API calls, got ${calls.join(',')}`);
      assert.equal(install.state, 'STORAGE_CREATED');
    }
  });

  it('OUTCOME_UNKNOWN during move propagates, marks pending, and blocks further mutation', async () => {
    const install = toApiReadyInstall();
    const calls1 = [];
    const unknownErr = Object.assign(new Error('synthetic-stop-unknown'), { kind: 'OUTCOME_UNKNOWN' });
    const res1 = {
      createDriveFolder: async () => { calls1.push('createDriveFolder'); return { id: 'synthetic-folder-001' }; },
      createSpreadsheet: async () => { calls1.push('createSpreadsheet'); return { spreadsheetId: 'synthetic-sheet-001' }; },
      moveIntoFolder: async () => { calls1.push('moveIntoFolder'); throw unknownErr; },
    };
    let caught = null;
    try {
      await runToStorage({ install, accountEmail: OWNER, res: res1, prefix: 'QR_SYNTHETIC_' });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught, 'OUTCOME_UNKNOWN during move must propagate');
    assert.equal(caught && caught.kind, 'OUTCOME_UNKNOWN', `expected kind OUTCOME_UNKNOWN, got ${caught && caught.kind}`);
    assert.equal(install.state, 'API_ACCESS_READY', `uncertain move must not advance, got ${install.state}`);
    assert.equal(typeof install.resources.operation_pending, 'string');
    assert.ok(install.resources.operation_pending.length > 0, 'operation_pending must be non-empty');

    const calls2 = [];
    const res2 = {
      createDriveFolder: async () => { calls2.push('createDriveFolder'); return { id: 'synthetic-folder-001' }; },
      createSpreadsheet: async () => { calls2.push('createSpreadsheet'); return { spreadsheetId: 'synthetic-sheet-001' }; },
      moveIntoFolder: async () => { calls2.push('moveIntoFolder'); return {}; },
      createScriptProject: async () => { calls2.push('createScriptProject'); return { scriptId: 'synthetic-script-001' }; },
      uploadRuntime: async () => { calls2.push('uploadRuntime'); return {}; },
      createVersion: async () => { calls2.push('createVersion'); return { versionNumber: 1 }; },
      createDeployment: async () => { calls2.push('createDeployment'); return { deploymentId: 'synthetic-dep-001', webAppUrl: 'https://script.google.com/macros/s/synthetic/exec' }; },
      updateDeployment: async () => { calls2.push('updateDeployment'); return {}; },
    };
    let caughtRetry = null;
    try {
      await runToStorage({ install, accountEmail: OWNER, res: res2, prefix: 'QR_SYNTHETIC_' });
    } catch (e) {
      caughtRetry = e;
    }
    assert.ok(caughtRetry, 'uncertain state retry must not silently succeed');
    assert.equal(caughtRetry && caughtRetry.kind, 'OUTCOME_UNKNOWN');
    assert.equal(calls2.length, 0, `uncertain retry must not mutate, got ${calls2.join(',')}`);

    const calls3 = [];
    const res3 = {
      createScriptProject: async () => { calls3.push('createScriptProject'); return { scriptId: 'synthetic-script-001' }; },
      uploadRuntime: async () => { calls3.push('uploadRuntime'); return {}; },
      createVersion: async () => { calls3.push('createVersion'); return { versionNumber: 1 }; },
      createDeployment: async () => { calls3.push('createDeployment'); return { deploymentId: 'synthetic-dep-001', webAppUrl: 'https://script.google.com/macros/s/synthetic/exec' }; },
      updateDeployment: async () => { calls3.push('updateDeployment'); return {}; },
    };
    let caughtDeploy = null;
    try {
      await runToDeployed({ install, accountEmail: OWNER, res: res3, prefix: 'QR_SYNTHETIC_', runtimeFiles: [], versionDescription: 'maker 0.1.0' });
    } catch (e) {
      caughtDeploy = e;
    }
    assert.ok(caughtDeploy, 'uncertain state must block script creation');
    assert.equal(calls3.length, 0, `uncertain state must prevent script creation, got ${calls3.join(',')}`);
  });

  it('unclassified upload error latches UNKNOWN without exposing raw detail', async () => {
    const SECRET = 'do-not-expose-test-detail';
    const install = toStorageCreatedInstall();
    install.install_id = 'install-synthetic010';
    const res1 = {
      createScriptProject: async () => ({ scriptId: 'synthetic-script-010' }),
      uploadRuntime: async () => { throw new Error(`upload boom ${SECRET}`); },
      createVersion: async () => ({ versionNumber: 1 }),
      createDeployment: async () => ({ deploymentId: 'synthetic-dep-010', webAppUrl: 'https://script.google.com/macros/s/synthetic/exec' }),
    };
    let caught = null;
    try {
      await runToDeployed({ install, accountEmail: OWNER, res: res1, prefix: 'QR_SYNTHETIC_', runtimeFiles: [], versionDescription: 'maker 0.1.0' });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught, 'unclassified upload must throw');
    assert.equal(caught && caught.kind, 'OUTCOME_UNKNOWN');
    assert.equal(install.resources.script_id, 'synthetic-script-010', 'same script ID preserved');
    assert.equal(typeof install.resources.operation_pending, 'string');
    assert.ok(install.resources.operation_pending.length > 0, 'operation_pending must remain');
    assert.ok(!String((caught && caught.message) || '').includes(SECRET), 'message must not expose raw detail');
    assert.ok(!String((caught && caught.cause && caught.cause.message) || (caught && caught.cause) || '').includes(SECRET), 'cause must not expose raw detail');
    assert.ok(!String((caught && caught.detail) || '').includes(SECRET), 'detail must not expose raw detail');
    assert.ok(!String(JSON.stringify(install.resources) || '').includes(SECRET), 'stored resources must not expose raw detail');

    const calls2 = [];
    const res2 = {
      createScriptProject: async () => { calls2.push('createScriptProject'); return { scriptId: 'synthetic-script-010' }; },
      uploadRuntime: async () => { calls2.push('uploadRuntime'); return {}; },
      createVersion: async () => { calls2.push('createVersion'); return { versionNumber: 1 }; },
      createDeployment: async () => { calls2.push('createDeployment'); return { deploymentId: 'synthetic-dep-010', webAppUrl: 'https://script.google.com/macros/s/synthetic/exec' }; },
    };
    let caughtRetry = null;
    try {
      await runToDeployed({ install, accountEmail: OWNER, res: res2, prefix: 'QR_SYNTHETIC_', runtimeFiles: [], versionDescription: 'maker 0.1.0' });
    } catch (e) {
      caughtRetry = e;
    }
    assert.ok(caughtRetry, 'latched retry must throw');
    assert.equal(caughtRetry && caughtRetry.kind, 'OUTCOME_UNKNOWN');
    assert.equal(calls2.length, 0, `latched retry must not call API, got ${calls2.join(',')}`);
    assert.equal(install.resources.script_id, 'synthetic-script-010', 'same script ID preserved on retry');
  });

  it('partial definite failures reuse created resource on retry', async () => {
    const known403 = (msg) => Object.assign(new Error(msg), { kind: 'FORBIDDEN', status: 403 });
    const cases = [
      {
        name: 'sheet created then move 403 reuses sheet',
        async run() {
          const install = createInstall({ installId: 'install-synthetic011', accountEmail: OWNER, release: RELEASE });
          advance(install, 'OAUTH_READY', { accountEmail: OWNER });
          advance(install, 'API_ACCESS_READY', { accountEmail: OWNER, resource: { folder_id: 'synthetic-folder-011' } });
          let sheetCreates = 0;
          const resFail = {
            createDriveFolder: async () => ({ id: 'synthetic-folder-011' }),
            createSpreadsheet: async () => { sheetCreates++; return { spreadsheetId: 'synthetic-sheet-011' }; },
            moveIntoFolder: async () => { throw known403('known 403 move forbidden'); },
          };
          await assert.rejects(
            runToStorage({ install, accountEmail: OWNER, res: resFail, prefix: 'QR_SYNTHETIC_' }),
            /known 403|FORBIDDEN|403/,
          );
          assert.equal(install.state, 'API_ACCESS_READY');
          assert.equal(install.resources.spreadsheet_id, 'synthetic-sheet-011');
          const resRetry = {
            createDriveFolder: async () => ({ id: 'synthetic-folder-011' }),
            createSpreadsheet: async () => { sheetCreates++; return { spreadsheetId: 'synthetic-sheet-011' }; },
            moveIntoFolder: async () => ({}),
          };
          await runToStorage({ install, accountEmail: OWNER, res: resRetry, prefix: 'QR_SYNTHETIC_' });
          assert.equal(install.state, 'STORAGE_CREATED');
          assert.equal(sheetCreates, 1, 'retry must reuse sheet (one create)');
        },
      },
      {
        name: 'version created then deployment 403 reuses version',
        async run() {
          const install = createInstall({ installId: 'install-synthetic012', accountEmail: OWNER, release: RELEASE });
          advance(install, 'OAUTH_READY', { accountEmail: OWNER });
          advance(install, 'API_ACCESS_READY', { accountEmail: OWNER, resource: { folder_id: 'synthetic-folder-012' } });
          advance(install, 'STORAGE_CREATED', { accountEmail: OWNER, resource: { folder_id: 'synthetic-folder-012', spreadsheet_id: 'synthetic-sheet-012' } });
          advance(install, 'SCRIPT_CREATED', { accountEmail: OWNER, resource: { script_id: 'synthetic-script-012' } });
          advance(install, 'CODE_UPLOADED', { accountEmail: OWNER });
          let versionCreates = 0;
          const resFail = {
            createVersion: async () => { versionCreates++; return { versionNumber: 7 }; },
            createDeployment: async () => { throw known403('known 403 deployment forbidden'); },
          };
          await assert.rejects(
            runToDeployed({ install, accountEmail: OWNER, res: resFail, prefix: 'QR_SYNTHETIC_', runtimeFiles: [], versionDescription: 'maker 0.1.0' }),
            /known 403|FORBIDDEN|403/,
          );
          assert.equal(install.state, 'CODE_UPLOADED');
          assert.equal(String(install.resources.version_number), '7');
          const resRetry = {
            createVersion: async () => { versionCreates++; return { versionNumber: 7 }; },
            createDeployment: async () => ({ deploymentId: 'synthetic-dep-012', webAppUrl: 'https://script.google.com/macros/s/synthetic/exec' }),
          };
          await runToDeployed({ install, accountEmail: OWNER, res: resRetry, prefix: 'QR_SYNTHETIC_', runtimeFiles: [], versionDescription: 'maker 0.1.0' });
          assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
          assert.equal(versionCreates, 1, 'retry must reuse version (one createVersion)');
        },
      },
    ];
    for (const tc of cases) {
      await tc.run();
    }
  });
});

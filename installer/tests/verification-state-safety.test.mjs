// installer/tests/verification-state-safety.test.mjs
// Public/synthetic coverage for checkSchoolVerified state safety only.
// No secrets. Synthetic IDs + owner@example.com + release 1.0.0.
// Real orchestrator + state-machine imports; only service boundary faked is res.getSheetValues.
// NOTE: data-marker verification (settings_school setup_completed) is initial-setup-only.
// It is NOT evidence of real QR issuance, attachment handling, or operation success.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSchoolVerified } from '../src/install/orchestrator.mjs';
import { createInstall, advance } from '../src/install/state-machine.mjs';

const OWNER = 'owner@example.com';
const RELEASE = '1.0.0';
const EXPECTED_RANGE = 'settings_school!A1:B200';

let seq = 0;
function nextId(prefix) {
  seq += 1;
  return `${prefix}-synth-${seq}`;
}

function baseInstall(tag) {
  return createInstall({
    installId: nextId(tag),
    accountEmail: OWNER,
    release: RELEASE,
  });
}

function atDraft(tag = 'draft') {
  return baseInstall(tag);
}

function atStorageCreated(tag = 'storage') {
  const install = baseInstall(tag);
  const folder = `folder-${install.install_id}`;
  const sheet = `sheet-${install.install_id}`;
  advance(install, 'OAUTH_READY', { accountEmail: OWNER });
  advance(install, 'API_ACCESS_READY', {
    accountEmail: OWNER,
    resource: { folder_id: folder },
  });
  advance(install, 'STORAGE_CREATED', {
    accountEmail: OWNER,
    resource: { folder_id: folder, spreadsheet_id: sheet },
  });
  return install;
}

function atAwaiting(tag = 'awaiting') {
  const install = atStorageCreated(tag);
  const script = `script-${install.install_id}`;
  const dep = `dep-${install.install_id}`;
  advance(install, 'SCRIPT_CREATED', {
    accountEmail: OWNER,
    resource: { script_id: script },
  });
  advance(install, 'CODE_UPLOADED', { accountEmail: OWNER });
  advance(install, 'DEPLOYED', {
    accountEmail: OWNER,
    resource: {
      version_number: '1',
      deployment_id: dep,
      web_app_url: 'https://example.invalid/exec',
    },
  });
  advance(install, 'AWAITING_SCHOOL_AUTH', { accountEmail: OWNER });
  return install;
}

function atVerified(tag = 'verified') {
  const install = atAwaiting(tag);
  advance(install, 'VERIFIED', { accountEmail: OWNER });
  return install;
}

function atComplete(tag = 'complete') {
  const install = atVerified(tag);
  advance(install, 'COMPLETE', { accountEmail: OWNER });
  return install;
}

function snapshot(install) {
  return JSON.parse(JSON.stringify(install));
}

function makeRes({ values, error } = {}) {
  const calls = [];
  return {
    calls,
    res: {
      getSheetValues: async (spreadsheetId, range) => {
        calls.push({ spreadsheetId, range });
        if (error) throw error;
        return values ?? [];
      },
    },
  };
}

function verifiedTrueRows() {
  return [
    ['setup_completed', 'true'],
    ['school_name', 'Synthetic School'],
  ];
}

describe('verification-state-safety (checkSchoolVerified only)', () => {
  describe('account gate rejects before any API read or mutation', () => {
    it('rejects absent accountEmail (omitted) without reading', async () => {
      const install = atAwaiting('acct-absent');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() => checkSchoolVerified({ install, res }));
      assert.equal(calls.length, 0);
      assert.deepEqual(snapshot(install), before);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
    });

    it('rejects undefined accountEmail without reading', async () => {
      const install = atAwaiting('acct-undef');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: undefined }),
      );
      assert.equal(calls.length, 0);
      assert.deepEqual(snapshot(install), before);
    });

    it('rejects blank accountEmail without reading', async () => {
      for (const blank of ['', '   ']) {
        const install = atAwaiting('acct-blank');
        const before = snapshot(install);
        const { calls, res } = makeRes({ values: verifiedTrueRows() });
        await assert.rejects(() =>
          checkSchoolVerified({ install, res, accountEmail: blank }),
        );
        assert.equal(calls.length, 0);
        assert.deepEqual(snapshot(install), before);
        assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      }
    });

    it('rejects mismatched accountEmail without reading', async () => {
      const install = atAwaiting('acct-mismatch');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() =>
        checkSchoolVerified({
          install,
          res,
          accountEmail: 'other@example.com',
        }),
      );
      assert.equal(calls.length, 0);
      assert.deepEqual(snapshot(install), before);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      assert.ok(!install.stage_completed_at.VERIFIED);
    });
  });

  describe('premature states reject before read', () => {
    it('rejects DRAFT before read', async () => {
      const install = atDraft('premature-draft');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: OWNER }),
      );
      assert.equal(calls.length, 0);
      assert.deepEqual(snapshot(install), before);
      assert.equal(install.state, 'DRAFT');
    });

    it('rejects STORAGE_CREATED before read', async () => {
      const install = atStorageCreated('premature-storage');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: OWNER }),
      );
      assert.equal(calls.length, 0);
      assert.deepEqual(snapshot(install), before);
      assert.equal(install.state, 'STORAGE_CREATED');
      assert.ok(!install.stage_completed_at.VERIFIED);
    });

    it('rejects other pre-awaiting states before read', async () => {
      const cases = [
        (() => {
          const i = baseInstall('premature-oauth');
          advance(i, 'OAUTH_READY', { accountEmail: OWNER });
          return i;
        })(),
        (() => {
          const i = baseInstall('premature-api');
          advance(i, 'OAUTH_READY', { accountEmail: OWNER });
          advance(i, 'API_ACCESS_READY', {
            accountEmail: OWNER,
            resource: { folder_id: `folder-${i.install_id}` },
          });
          return i;
        })(),
        (() => {
          const i = atStorageCreated('premature-script');
          advance(i, 'SCRIPT_CREATED', {
            accountEmail: OWNER,
            resource: { script_id: `script-${i.install_id}` },
          });
          return i;
        })(),
        (() => {
          const i = atStorageCreated('premature-code');
          advance(i, 'SCRIPT_CREATED', {
            accountEmail: OWNER,
            resource: { script_id: `script-${i.install_id}` },
          });
          advance(i, 'CODE_UPLOADED', { accountEmail: OWNER });
          return i;
        })(),
        (() => {
          const i = atStorageCreated('premature-deployed');
          advance(i, 'SCRIPT_CREATED', {
            accountEmail: OWNER,
            resource: { script_id: `script-${i.install_id}` },
          });
          advance(i, 'CODE_UPLOADED', { accountEmail: OWNER });
          advance(i, 'DEPLOYED', {
            accountEmail: OWNER,
            resource: {
              version_number: '1',
              deployment_id: `dep-${i.install_id}`,
              web_app_url: 'https://example.invalid/exec',
            },
          });
          return i;
        })(),
      ];
      for (const install of cases) {
        const before = snapshot(install);
        const { calls, res } = makeRes({ values: verifiedTrueRows() });
        await assert.rejects(() =>
          checkSchoolVerified({ install, res, accountEmail: OWNER }),
        );
        assert.equal(calls.length, 0, `state=${install.state} must not read`);
        assert.deepEqual(snapshot(install), before);
        assert.ok(!install.stage_completed_at.VERIFIED);
      }
    });
  });

  describe('eligible transition', () => {
    it('AWAITING + same account + setup_completed true transitions to VERIFIED', async () => {
      const install = atAwaiting('eligible');
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, true);
      assert.equal(out.school_name, 'Synthetic School');
      assert.equal(install.state, 'VERIFIED');
      assert.ok(install.stage_completed_at.VERIFIED);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].range, EXPECTED_RANGE);
      assert.equal(calls[0].spreadsheetId, install.resources.spreadsheet_id);
    });

    it('accepts Google Sheets uppercase TRUE marker', async () => {
      const install = atAwaiting('eligible-uppercase');
      const { calls, res } = makeRes({
        values: [
          ['setup_completed', 'TRUE'],
          ['school_name', 'Synthetic School'],
        ],
      });
      const out = await checkSchoolVerified({ install, res, accountEmail: OWNER });
      assert.equal(out.verified, true);
      assert.equal(install.state, 'VERIFIED');
      assert.equal(calls.length, 1);
    });

    it('accepts case-variant of same account as valid', async () => {
      const install = atAwaiting('eligible-case');
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: 'Owner@Example.Com',
      });
      assert.equal(out.verified, true);
      assert.equal(install.state, 'VERIFIED');
      assert.equal(calls.length, 1);
    });
  });

  describe('idempotent re-check retains state and timestamps', () => {
    it('repeated VERIFIED check re-reads but retains VERIFIED without illegal advance', async () => {
      const install = atVerified('re-verified');
      const before = snapshot(install);
      const beforeVerifiedAt = install.stage_completed_at.VERIFIED;
      assert.ok(beforeVerifiedAt);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].range, EXPECTED_RANGE);
      assert.equal(install.state, 'VERIFIED');
      assert.equal(install.stage_completed_at.VERIFIED, beforeVerifiedAt);
      assert.deepEqual(install.stage_completed_at, before.stage_completed_at);
      assert.ok(!install.stage_completed_at.COMPLETE);
      assert.deepEqual(install.resources, before.resources);
    });

    it('COMPLETE check re-reads but retains COMPLETE without illegal advance', async () => {
      const install = atComplete('re-complete');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].range, EXPECTED_RANGE);
      assert.equal(install.state, 'COMPLETE');
      assert.deepEqual(install.stage_completed_at, before.stage_completed_at);
      assert.deepEqual(install.resources, before.resources);
    });

    it('VERIFIED with setup_completed false retains VERIFIED (no downgrade, no advance)', async () => {
      const install = atVerified('re-verified-false');
      const before = snapshot(install);
      const { calls, res } = makeRes({
        values: [
          ['setup_completed', 'false'],
          ['school_name', 'Synthetic School'],
        ],
      });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, false);
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'VERIFIED');
      assert.deepEqual(install.stage_completed_at, before.stage_completed_at);
      assert.deepEqual(snapshot(install), {
        ...before,
      });
    });

    it('COMPLETE with setup_completed false retains COMPLETE', async () => {
      const install = atComplete('re-complete-false');
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: [['setup_completed', 'false']] });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, false);
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'COMPLETE');
      assert.deepEqual(install.stage_completed_at, before.stage_completed_at);
    });
  });

  describe('negative marker and read failure grant nothing', () => {
    it('setup_completed false returns false without granting VERIFIED', async () => {
      const install = atAwaiting('neg-false');
      const before = snapshot(install);
      const { calls, res } = makeRes({
        values: [
          ['setup_completed', 'false'],
          ['school_name', 'Synthetic School'],
        ],
      });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, false);
      assert.equal(out.school_name, 'Synthetic School');
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      assert.ok(!install.stage_completed_at.VERIFIED);
      assert.ok(!install.stage_completed_at.COMPLETE);
      assert.deepEqual(install.resources, before.resources);
    });

    it('missing marker returns false without granting completion', async () => {
      const install = atAwaiting('neg-missing');
      const { calls, res } = makeRes({ values: [['school_name', 'Synthetic School']] });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, false);
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      assert.ok(!install.stage_completed_at.VERIFIED);
    });

    it('empty sheet returns false without granting completion', async () => {
      const install = atAwaiting('neg-empty');
      const { calls, res } = makeRes({ values: [] });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, false);
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      assert.ok(!install.stage_completed_at.VERIFIED);
    });

    it('read failure throws without granting new completion', async () => {
      const install = atAwaiting('neg-throw');
      const before = snapshot(install);
      const failure = new Error('synthetic read failure');
      const { calls, res } = makeRes({ error: failure });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: OWNER }),
      );
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      assert.ok(!install.stage_completed_at.VERIFIED);
      assert.ok(!install.stage_completed_at.COMPLETE);
      assert.deepEqual(snapshot(install), before);
    });

    it('read failure on VERIFIED retains VERIFIED without new completion', async () => {
      const install = atVerified('neg-throw-verified');
      const before = snapshot(install);
      const { calls, res } = makeRes({ error: new Error('synthetic read failure') });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: OWNER }),
      );
      assert.equal(calls.length, 1);
      assert.equal(install.state, 'VERIFIED');
      assert.deepEqual(install.stage_completed_at, before.stage_completed_at);
      assert.deepEqual(snapshot(install), before);
    });
  });

  describe('pending operation blocks reads', () => {
    it('AWAITING with operation_pending rejects before read and retains marker', async () => {
      const install = atAwaiting('pending-awaiting');
      install.resources.operation_pending = 'create-folder';
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: OWNER }),
      );
      assert.equal(calls.length, 0);
      assert.equal(install.state, 'AWAITING_SCHOOL_AUTH');
      assert.equal(install.resources.operation_pending, 'create-folder');
      assert.deepEqual(snapshot(install), before);
      assert.ok(!install.stage_completed_at.VERIFIED);
    });

    it('VERIFIED with operation_pending rejects before read', async () => {
      const install = atVerified('pending-verified');
      install.resources.operation_pending = 'update-deployment';
      const before = snapshot(install);
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      await assert.rejects(() =>
        checkSchoolVerified({ install, res, accountEmail: OWNER }),
      );
      assert.equal(calls.length, 0);
      assert.equal(install.state, 'VERIFIED');
      assert.equal(install.resources.operation_pending, 'update-deployment');
      assert.deepEqual(snapshot(install), before);
    });
  });

  describe('marker scope is initial-setup-only', () => {
    it('successful check proves only settings_school marker, not QR/attachment/operation', async () => {
      const install = atAwaiting('scope');
      const { calls, res } = makeRes({ values: verifiedTrueRows() });
      const out = await checkSchoolVerified({
        install,
        res,
        accountEmail: OWNER,
      });
      assert.equal(out.verified, true);
      assert.equal(install.state, 'VERIFIED');
      // Only the settings_school range is read.
      assert.equal(calls.length, 1);
      assert.equal(calls[0].range, EXPECTED_RANGE);
      assert.equal(calls[0].spreadsheetId, install.resources.spreadsheet_id);
      // Marker success must not fabricate evidence of real QR/attachment/operation.
      const keys = Object.keys(install.resources || {}).join(' ').toLowerCase();
      assert.ok(!keys.includes('qr'));
      assert.ok(!keys.includes('attach'));
      assert.ok(!keys.includes('submit'));
      assert.ok(!keys.includes('operation_pending'));
    });
  });
});

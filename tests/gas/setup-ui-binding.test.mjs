import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function runSetupWithInputs(inputs) {
  const htmlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../apps-script/WebApp.html',
  );
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'WebApp.html should contain an inline script');
  const inlineJs = match[1];

  const elements = {
    setupKey: { value: inputs.setupKey },
    schoolName: { value: inputs.schoolName },
    adminEmail: { value: inputs.adminEmail },
    initialRooms: { value: inputs.initialRooms },
    adminToken: { value: inputs.adminToken },
    rotateTokens: { checked: inputs.rotateTokens },
    spreadsheetId: { value: inputs.spreadsheetId },
    result: { textContent: '' },
  };

  let captured;
  const runBoundary = {
    withSuccessHandler() {
      return runBoundary;
    },
    withFailureHandler() {
      return runBoundary;
    },
    setupInitializeForUi(payload) {
      captured = payload;
    },
  };
  const sandbox = {
    document: {
      getElementById(id) {
        return elements[id];
      },
    },
    google: { script: { run: runBoundary } },
  };
  vm.createContext(sandbox);
  vm.runInContext(inlineJs, sandbox);
  vm.runInContext('runSetup()', sandbox);
  return captured;
}

describe('setup UI spreadsheet binding', () => {
  it('sends trimmed nonempty spreadsheet_id and preserves school/admin/rooms/legacy fields', () => {
    const payload = runSetupWithInputs({
      setupKey: 'SYNTHETIC-SETUP-KEY-001',
      schoolName: 'Synthetic School',
      adminEmail: 'synthetic-admin@example.invalid',
      initialRooms: 'Room Alpha\nRoom Beta',
      adminToken: 'SYNTHETIC-ADMIN-TOKEN-001',
      rotateTokens: false,
      spreadsheetId: '  synthetic-spreadsheet-abc123  ',
    });

    assert.strictEqual(payload.school_name, 'Synthetic School');
    assert.strictEqual(payload.admin_email, 'synthetic-admin@example.invalid');
    assert.deepStrictEqual(Array.from(payload.rooms), ['Room Alpha', 'Room Beta']);
    assert.ok(payload.setupKey);
    assert.ok('adminToken' in payload);
    assert.strictEqual(payload.rotateTokens, false);
    assert.strictEqual(payload.spreadsheet_id, 'synthetic-spreadsheet-abc123');
  });

  it('passes empty string for blank spreadsheetId legacy container binding', () => {
    const payload = runSetupWithInputs({
      setupKey: 'SYNTHETIC-SETUP-KEY-002',
      schoolName: 'Synthetic School',
      adminEmail: 'synthetic-admin@example.invalid',
      initialRooms: 'Room Alpha',
      adminToken: 'SYNTHETIC-ADMIN-TOKEN-002',
      rotateTokens: false,
      spreadsheetId: '   ',
    });

    assert.strictEqual(payload.spreadsheet_id, '');
  });
});

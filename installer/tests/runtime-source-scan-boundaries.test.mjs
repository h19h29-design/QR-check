// installer/tests/runtime-source-scan.test.mjs — regressions for runtime scanner.
// Public inputs only; no shell/network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanRuntimeSource } from '../../tools/build-site.mjs';

test('whitespace before a real punctuation terminator is allowed', () => {
  assert.doesNotThrow(() =>
    scanRuntimeSource('ok-space-semi', 'const adminToken = payload.adminToken ;\nconst ok = 1;'),
  );
  assert.doesNotThrow(() =>
    scanRuntimeSource('ok-tab-comma', 'const adminToken = payload.adminToken\t,\nconst ok = 1;'),
  );
  assert.doesNotThrow(() =>
    scanRuntimeSource('ok-object', '{\n  adminToken: adminToken ,\n}\n'),
  );
  assert.doesNotThrow(() =>
    scanRuntimeSource('ok-qs', "adminToken: qs('adminToken').value   ;\n"),
  );
});

test('newline continuation fallback is rejected (newline/CR are not terminators)', () => {
  assert.throws(
    () => scanRuntimeSource('evil-newline', 'const adminToken = payload.adminToken\n|| "evil-fallback"'),
    /secret\/sensitive|private\/absolute/,
  );
  assert.throws(
    () => scanRuntimeSource('evil-cr', 'const adminToken = payload.adminToken\r\n|| "evil-fallback"'),
    /secret\/sensitive|private\/absolute/,
  );
  assert.throws(
    () => scanRuntimeSource('evil-qs-newline', "adminToken: qs('adminToken').value\n|| \"evil\""),
    /secret\/sensitive|private\/absolute/,
  );
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-payload-and',
        'const adminToken = payload && payload.adminToken\n|| "evil"',
      ),
    /secret\/sensitive|private\/absolute/,
  );
});

test('exact runtime scopes pass', () => {
  assert.doesNotThrow(() =>
    scanRuntimeSource('ok-drive', 'const scopes = ["https://www.googleapis.com/auth/drive"];'),
  );
  assert.doesNotThrow(() =>
    scanRuntimeSource(
      'ok-spreadsheets',
      'const scopes = ["https://www.googleapis.com/auth/spreadsheets"];',
    ),
  );
  assert.doesNotThrow(() =>
    scanRuntimeSource(
      'ok-email',
      'const scopes = ["https://www.googleapis.com/auth/userinfo.email"];',
    ),
  );
});

test('scope-prefix lookalike is rejected', () => {
  assert.throws(
    () => scanRuntimeSource('evil-drive-prefix', 'const s = "https://www.googleapis.com/auth/drive.evil";'),
    /private\/absolute URL/,
  );
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-drive-concat',
        'const s = "https://www.googleapis.com/auth/driveevil";',
      ),
    /private\/absolute URL/,
  );
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-sheets-prefix',
        'const s = "https://www.googleapis.com/auth/spreadsheets.evil";',
      ),
    /private\/absolute URL/,
  );
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-email-prefix',
        'const s = "https://www.googleapis.com/auth/userinfo.email.evil";',
      ),
    /private\/absolute URL/,
  );
});

test('exact public-validation regex literals pass', () => {
  assert.doesNotThrow(() =>
    scanRuntimeSource(
      'ok-code-re',
      'const RE = /^https:\\/\\/script\\.google\\.com\\/macros\\/s\\/[A-Za-z0-9_-]+\\/exec$/;',
    ),
  );
  assert.doesNotThrow(() =>
    scanRuntimeSource(
      'ok-client-re',
      'const RE2 = /^https:\\/\\/(drive|docs)\\.google\\.com\\//;',
    ),
  );
});

test('arbitrary escaped private URL is rejected', () => {
  assert.throws(
    () => scanRuntimeSource('evil-escaped', 'const u = "https:\\/\\/evil.example.com\\/x";'),
    /private\/absolute URL/,
  );
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-escaped-re',
        'const RE = /^https:\\/\\/evil\\.example\\.com\\//;',
      ),
    /private\/absolute URL/,
  );
});

test('suffix URL is rejected', () => {
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-suffix',
        'const s = "https://www.googleapis.com/auth/drive/extra-evil";',
      ),
    /private\/absolute URL/,
  );
  assert.throws(
    () =>
      scanRuntimeSource(
        'evil-drive-file-suffix',
        'const s = "https://www.googleapis.com/auth/drive.file.evil";',
      ),
    /private\/absolute URL/,
  );
});

test('owner token generation from payload or UUID is not a hardcoded token', () => {
  assert.doesNotThrow(() => scanRuntimeSource('Auth.gs', 'const token = payload && payload.newAdminToken ? payload.newAdminToken : Utilities.getUuid() + Utilities.getUuid();'));
  assert.doesNotThrow(() => scanRuntimeSource('Auth.gs', 'const key = payload && payload.newSyncKey ? payload.newSyncKey : Utilities.getUuid() + Utilities.getUuid();'));
  assert.throws(() => scanRuntimeSource('Auth.gs', 'const token = payload && payload.newAdminToken ? payload.newAdminToken : "hardcoded";'));
});

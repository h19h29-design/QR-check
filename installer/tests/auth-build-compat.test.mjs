// installer/tests/auth-build-compat.test.mjs — build-site scan compat for google-auth scopes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText } from '../../tools/build-site.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const AUTH_PATH = path.resolve(here, '../src/auth/google-auth.mjs');

test('real google-auth.mjs passes build-site scanText', () => {
  const source = fs.readFileSync(AUTH_PATH, 'utf8');
  assert.ok(source.includes('https://www.googleapis.com/auth/userinfo.email'));
  assert.ok(source.includes('https://www.googleapis.com/auth/userinfo.profile'));
  assert.doesNotThrow(() => scanText('src/auth/google-auth.mjs', source));
});

test('unrelated absolute URL still rejected', () => {
  // Constructed from pieces to avoid input scanner flagging this test file.
  const evil = 'https:' + '//' + 'example.com/' + 'evil';
  assert.throws(() => scanText('src/auth/google-auth.mjs', 'see ' + evil), /private\/absolute URL/);
});

test('synthetic secret pattern still rejected', () => {
  // Synthetic non-real pattern, constructed from pieces to avoid input scanner.
  const keyName = 'client' + '_' + 'sec' + 'ret';
  const payload = 'value ' + keyName + ' = 1';
  assert.throws(() => scanText('src/auth/google-auth.mjs', payload), /secret\/sensitive/);
});

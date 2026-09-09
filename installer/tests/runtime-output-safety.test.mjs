import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL_BUILDER = path.resolve(HERE, '../../tools/build-runtime.mjs');
const PUBLIC = ['Code.gs','SchoolConfig.gs','SchemaMigrations.gs','Sheets.gs','Submit.gs','QrTokens.gs','DriveFiles.gs','Templates.gs','Client.js.html','SubmitView.html','Styles.html','appsscript.json'];
const ADMIN_ONLY = ['Auth.gs','Admin.gs','Api.gs','DesktopSync.gs','AdminView.html','WebApp.html'];
const ALL = [...PUBLIC, ...ADMIN_ONLY];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function makeRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-'));
  fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
  fs.copyFileSync(REAL_BUILDER, path.join(tmp, 'tools', 'build-runtime.mjs'));
  fs.mkdirSync(path.join(tmp, 'apps-script'), { recursive: true });
  for (const n of ALL) {
    const c = n === 'Code.gs' ? "const APP_VERSION = '0.1.0';\n// synthetic Code\n" : n === 'appsscript.json' ? '{"timeZone":"Etc/UTC","synthetic":true}\n' : `synthetic ${n} 0.1.0\n`;
    fs.writeFileSync(path.join(tmp, 'apps-script', n), c);
  }
  return tmp;
}
function run(tmp, args) {
  return spawnSync(process.execPath, [path.join(tmp, 'tools', 'build-runtime.mjs'), ...args], { cwd: tmp, encoding: 'utf8' });
}
function srcHashes(tmp) {
  return ALL.map((n) => sha(fs.readFileSync(path.join(tmp, 'apps-script', n))));
}
function outHashes(out) {
  const h = [];
  for (const n of PUBLIC) h.push(sha(fs.readFileSync(path.join(out, 'public', n))));
  for (const n of ALL) h.push(sha(fs.readFileSync(path.join(out, 'admin', n))));
  h.push(sha(fs.readFileSync(path.join(out, 'manifest.json'))));
  return h;
}
test('valid new --out yields admin18 public12 and manifest', () => {
  const tmp = makeRepo();
  const out = path.join(tmp, 'out-new');
  const r = run(tmp, ['--out', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readdirSync(path.join(out, 'public')).length, 12);
  assert.equal(fs.readdirSync(path.join(out, 'admin')).length, 18);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(m.bundles.public.length, 12);
  assert.equal(m.bundles.admin.length, 18);
});
test('same path repeat rejects and preserves hashes', () => {
  const tmp = makeRepo();
  const out = path.join(tmp, 'out-repeat');
  assert.equal(run(tmp, ['--out', out]).status, 0);
  const before = outHashes(out);
  const r = run(tmp, ['--out', out]);
  assert.notEqual(r.status, 0);
  assert.deepEqual(outHashes(out), before);
});
test('existing out with sentinel rejects preserving sentinel', () => {
  const tmp = makeRepo();
  const out = path.join(tmp, 'out-exists');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'sentinel.txt'), 'synthetic sentinel\n');
  const r = run(tmp, ['--out', out]);
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(path.join(out, 'sentinel.txt'), 'utf8'), 'synthetic sentinel\n');
  assert.equal(fs.existsSync(path.join(out, 'manifest.json')), false);
  assert.equal(fs.existsSync(path.join(out, 'public')), false);
  assert.equal(fs.existsSync(path.join(out, 'admin')), false);
});
test('--out missing argument rejects', () => {
  const tmp = makeRepo();
  const r = run(tmp, ['--out']);
  assert.notEqual(r.status, 0);
  assert.equal(fs.existsSync(path.join(tmp, '--out')), false);
  assert.equal(fs.existsSync(path.join(tmp, 'release')), false);
});
test('unknown args reject', () => {
  const tmp = makeRepo();
  const out = path.join(tmp, 'out-unknown');
  const r = run(tmp, ['--out', out, '--bogus']);
  assert.notEqual(r.status, 0);
  assert.equal(fs.existsSync(path.join(out, 'manifest.json')), false);
});
test('--out equal or under apps-script rejects without source changes', () => {
  const t1 = makeRepo();
  const b1 = srcHashes(t1);
  assert.notEqual(run(t1, ['--out', path.join(t1, 'apps-script')]).status, 0);
  assert.deepEqual(srcHashes(t1), b1);
  assert.equal(fs.existsSync(path.join(t1, 'apps-script', 'manifest.json')), false);
  const t2 = makeRepo();
  const b2 = srcHashes(t2);
  assert.notEqual(run(t2, ['--out', path.join(t2, 'apps-script', 'sub')]).status, 0);
  assert.deepEqual(srcHashes(t2), b2);
});
test('--out repo root rejects', () => {
  const tmp = makeRepo();
  const before = srcHashes(tmp);
  assert.notEqual(run(tmp, ['--out', tmp]).status, 0);
  assert.deepEqual(srcHashes(tmp), before);
  assert.equal(fs.existsSync(path.join(tmp, 'manifest.json')), false);
});

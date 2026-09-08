// installer/tests/site-content-build.test.mjs — static site content + build tests (Node built-ins only).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..', '..');
const INSTALLER_DIR = path.join(ROOT, 'installer');
const BUILDER_PATH = path.join(ROOT, 'tools', 'build-site.mjs');
const GUIDE_HTML = path.join(INSTALLER_DIR, 'guide', 'index.html');
const HELP_HTML = path.join(INSTALLER_DIR, 'help', 'index.html');
const UPDATE_HTML = path.join(INSTALLER_DIR, 'update', 'index.html');
const UPDATE_JS_PATH = path.join(INSTALLER_DIR, 'update', 'update-page.js');
const SITE_JS_PATH = path.join(INSTALLER_DIR, 'assets', 'site.js');
const HOME_HTML = path.join(INSTALLER_DIR, 'index.html');

const UNPUBLISHED_TEXT = '미게시 — 게시된 릴리스 정보가 없습니다';

const trackedTempDirs = [];

function norm(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}
function hasNorm(haystack, needle) {
  return norm(haystack).includes(norm(needle));
}
function readText(p) {
  return fs.readFileSync(p, 'utf8');
}
function isUnderTmpdir(candidate) {
  const tmp = path.resolve(os.tmpdir());
  const r = path.resolve(candidate);
  if (r === tmp) return true;
  return r.startsWith(tmp + path.sep);
}
function makeBase(prefix) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  trackedTempDirs.push(base);
  return base;
}
function listRelFiles(dir) {
  const out = [];
  const walk = (cur) => {
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      const lst = fs.lstatSync(full);
      if (lst.isSymbolicLink()) throw new Error('symlink found: ' + full);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) out.push(path.relative(dir, full).split(path.sep).join('/'));
      else throw new Error('unexpected entry: ' + full);
    }
  };
  walk(dir);
  return out.sort();
}
function parseAllowlist(builderText) {
  const m = builderText.match(/ALLOWLIST\s*=\s*\[(.*?)\]/s);
  assert.ok(m, 'ALLOWLIST block not found');
  const entries = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  return entries;
}
function runBuilder(args) {
  return spawnSync(process.execPath, [BUILDER_PATH, ...args], { encoding: 'utf8' });
}

after(() => {
  for (const d of trackedTempDirs) {
    if (!isUnderTmpdir(d)) continue;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {}
  }
});

describe('guide/help static content (ko shell, relative routes, truth, no secrets)', () => {
  test('guide + help exist with Korean shell and relative routes', () => {
    for (const p of [GUIDE_HTML, HELP_HTML]) {
      const html = readText(p);
      assert.ok(html.includes('<html lang="ko"'), 'missing ko shell: ' + p);
      assert.ok(hasNorm(html, 'charset'), 'missing charset: ' + p);
      assert.ok(html.includes('<nav'), 'missing nav: ' + p);
      assert.ok(html.includes('<main'), 'missing main: ' + p);
      // No absolute http(s) resource in static help/guide.
      assert.ok(!/href\s*=\s*["']https?:\/\//i.test(html), 'absolute href in ' + p);
      assert.ok(!/src\s*=\s*["']https?:\/\//i.test(html), 'absolute src in ' + p);
      assert.ok(!/https?:\/\/[^\s"'`<>)\]]+/i.test(html), 'absolute URL in ' + p);
      // Relative routes back to sibling sections.
      assert.ok(/href\s*=\s*["'][.][./][^"']*["']/.test(html), 'no relative href in ' + p);
    }
    const guide = readText(GUIDE_HTML);
    assert.ok(guide.includes('../maker/'), 'guide missing ../maker/ link');
    assert.ok(/href\s*=\s*["']\.\.\/demo\/["']/.test(guide) || hasNorm(guide, 'demo/'), 'guide missing demo link');
    const help = readText(HELP_HTML);
    assert.ok(help.includes('../guide/'), 'help missing ../guide/ link');
    assert.ok(help.includes('../maker/'), 'help missing ../maker/ link');
  });

  test('guide roles + live NOT_TESTED truth', () => {
    const guide = readText(GUIDE_HTML);
    assert.ok(hasNorm(guide, '학교 관리자 안내'), 'guide missing admin role');
    assert.ok(hasNorm(guide, '점검 담당자 안내'), 'guide missing inspector role');
    assert.ok(hasNorm(guide, '직접 확인해야 합니다'), 'guide missing live-check truth');
    // Preview/sample alone never proves live behavior.
    assert.ok(hasNorm(guide, '검증되는 것은 아닙니다'), 'guide missing live NOT_TESTED disclaimer');
    // Initial-setup guidance must survive the redesign.
    assert.ok(guide.includes('createInitialSetupKey'), 'guide missing setup-key guidance');
    assert.ok(guide.includes('?page=setup'), 'guide missing setup-page guidance');
    assert.ok(hasNorm(guide, '테스트 제출'), 'guide missing trial-submission guidance');
  });

  test('help privacy + limitations truth', () => {
    const help = readText(HELP_HTML);
    assert.ok(hasNorm(help, '어디에 보관되나요'), 'help missing storage section');
    assert.ok(
      hasNorm(help, '중앙 관리 화면이 아닙니다'),
      'help missing central-server privacy truth',
    );
    assert.ok(hasNorm(help, '타사 접근 권한'), 'help missing revoke truth');
    assert.ok(hasNorm(help, '공유를 정리'), 'help missing sharing-cleanup truth');
    assert.ok(hasNorm(help, '강하게 증명할 수는 없습니다'), 'help missing name-selection limitation');
    assert.ok(hasNorm(help, '편집 권한을 필요한 관리자에게만 부여'), 'help missing edit-permission limitation');
    assert.ok(hasNorm(help, '내보내어 별도 보관'), 'help missing backup limitation');
  });

  test('guide/help have no admin-token fallback, secret claims, or external resources', () => {
    for (const p of [GUIDE_HTML, HELP_HTML, UPDATE_HTML, HOME_HTML]) {
      const html = readText(p);
      const low = html.toLowerCase();
      assert.ok(!/admin\s*[-_]?token/i.test(html), 'admin token pattern in ' + p);
      assert.ok(!/admin\s*[-_]?secret/i.test(html), 'admin secret pattern in ' + p);
      assert.ok(!/sync\s*[-_]?token/i.test(html), 'sync token pattern in ' + p);
      assert.ok(!/client_secret/i.test(html), 'client_secret in ' + p);
      assert.ok(!/AIza[0-9A-Za-z_-]{10,}/.test(html), 'api key pattern in ' + p);
      assert.ok(!/ya29\.[0-9A-Za-z_-]{10,}/.test(html), 'access token pattern in ' + p);
      assert.ok(!/begin [a-z ]*private key/i.test(html), 'private key in ' + p);
      assert.ok(!low.includes('admintoken') && !low.includes('synctoken'), 'token fallback in ' + p);
      assert.ok(!/sourceMappingURL/i.test(html), 'source map ref in ' + p);
      assert.ok(!/https?:\/\/[^\s"'`<>)\]]+/i.test(html), 'external URL in ' + p);
    }
  });
});

describe('update page + update-page.js (unpublished exact, no actions, pure view model)', () => {
  test('update html shows exact unpublished text, no button or live calls', async () => {
    const html = readText(UPDATE_HTML);
    assert.ok(hasNorm(html, UNPUBLISHED_TEXT), 'update missing exact unpublished text');
    assert.ok(norm(html).includes(norm(UNPUBLISHED_TEXT)), 'unpublished text not exact/whitespace-robust');
    assert.ok(html.includes('id="release-status"'), 'missing #release-status');
    assert.ok(html.includes('release-data.js'), 'update must load release-data.js');
    assert.ok(html.includes('update-page.js'), 'update must load update-page.js');
    const buttons = html.match(/<button\b[^>]*>/gi) ?? [];
    const nonMenu = buttons.filter((tag) => !/menu-toggle/.test(tag));
    assert.deepEqual(nonMenu, [], 'update page must have no action buttons (mobile menu toggle only)');
    assert.ok(!/fetch\s*\(/.test(html), 'update page must not fetch');
    assert.ok(!/XMLHttpRequest/i.test(html), 'update page must not XHR');
    assert.ok(!/WebSocket/i.test(html), 'update page must not use WebSocket');
    const mod = await import('../update/update-page.js');
    assert.equal(mod.UNPUBLISHED_TEXT, UNPUBLISHED_TEXT, 'exported unpublished text must be exact');
  });

  test('update-page.js source has no action button/live/storage/network calls', () => {
    const src = readText(UPDATE_JS_PATH);
    assert.ok(src.includes(UNPUBLISHED_TEXT), 'update-page.js must define exact unpublished text');
    assert.ok(!/<button/i.test(src), 'update-page.js must not create buttons');
    assert.ok(!/fetch\s*\(/.test(src), 'update-page.js must not fetch');
    assert.ok(!/XMLHttpRequest/i.test(src), 'update-page.js must not XHR');
    assert.ok(!/WebSocket/i.test(src), 'update-page.js must not WebSocket');
    assert.ok(!/localStorage|sessionStorage/i.test(src), 'update-page.js must not use storage');
    assert.ok(!/setInterval|setTimeout/i.test(src), 'update-page.js must not use timers');
  });

  test('validateReleaseData rejects placeholder/invalid, accepts valid published only', async () => {
    const { validateReleaseData } = await import('../update/update-page.js');
    for (const bad of [null, undefined, 0, '', [], { status: 'unpublished' }, {}, { status: 'published' }]) {
      const r = validateReleaseData(bad);
      assert.equal(r.ok, false, 'must reject ' + JSON.stringify(bad));
    }
    assert.equal(validateReleaseData({ status: 'published', app_version: '1.2.3' }).ok, false);
    assert.equal(
      validateReleaseData({ status: 'published', app_version: ' ', source_commit: 'abc1234', built_at: '2025-01-01T00:00:00Z' }).ok,
      false,
    );
    const good = {
      status: 'published',
      app_version: '1.2.3',
      source_commit: 'abcdef1234567',
      built_at: '2025-01-02T03:04:05.000Z',
    };
    assert.equal(validateReleaseData(good).ok, true);
    assert.equal(validateReleaseData({ ...good, extra_admin_token: 'x' }).ok, true, 'extra fields do not affect validity');
  });

  test('releaseViewModel exposes only version/commit/built_at/runtime count', async () => {
    const { releaseViewModel, UNPUBLISHED_TEXT: T } = await import('../update/update-page.js');
    const un = releaseViewModel({ status: 'unpublished' }, []);
    assert.equal(un.ok, false);
    assert.equal(un.statusText, T);
    assert.equal(un.appVersion, '');
    assert.equal(un.sourceCommit, '');
    assert.equal(un.builtAt, '');
    assert.equal(un.fileCount, 0);

    const data = {
      status: 'published',
      app_version: '9.8.7',
      source_commit: 'deadbeef1234567',
      built_at: '2025-06-01T00:00:00.000Z',
      runtime_file_count: 3,
      admin_token: 'must-not-leak',
      secret: 'must-not-leak',
    };
    const before = JSON.stringify(data);
    const vm = releaseViewModel(data, [{ name: 'a' }]);
    assert.equal(JSON.stringify(data), before, 'must be pure (no input mutation)');
    assert.equal(vm.ok, true);
    assert.equal(vm.appVersion, '9.8.7');
    assert.equal(vm.sourceCommit, 'deadbeef1234567');
    assert.equal(vm.builtAt, '2025-06-01T00:00:00.000Z');
    assert.equal(vm.fileCount, 3);
    assert.deepEqual(Object.keys(vm).sort(), ['appVersion', 'builtAt', 'fileCount', 'ok', 'sourceCommit', 'statusText']);
    assert.ok(!JSON.stringify(vm).includes('must-not-leak'), 'must not leak extra fields');

    const viaFiles = releaseViewModel(
      { status: 'published', app_version: '1.0.0', source_commit: 'abc1234567', built_at: '2025-01-01T00:00:00Z' },
      [{ name: 'a' }, { name: 'b' }],
    );
    assert.equal(viaFiles.fileCount, 2, 'falls back to runtimeFiles length');
  });
});

describe('site.js /update mapping + homepage update links', () => {
  test('currentPageFromPath maps /update and siblings', async () => {
    const { currentPageFromPath } = await import('../assets/site.js');
    assert.equal(currentPageFromPath('/update/'), 'update');
    assert.equal(currentPageFromPath('/update'), 'update');
    assert.equal(currentPageFromPath('/foo/update/bar'), 'update');
    assert.equal(currentPageFromPath('/guide/'), 'guide');
    assert.equal(currentPageFromPath('/help'), 'help');
    assert.equal(currentPageFromPath('/'), 'home');
  });

  test('site.js source mentions /update mapping', () => {
    const src = readText(SITE_JS_PATH);
    assert.ok(src.includes('/update'), 'site.js missing /update route');
    assert.ok(src.includes('update'), 'site.js missing update token');
    assert.ok(!/fetch\s*\(|XMLHttpRequest/i.test(src), 'site.js must stay offline (no live calls)');
  });

  test('homepage links to update/guide/help relatively', () => {
    const home = readText(HOME_HTML);
    assert.ok(hasNorm(home, '업데이트'), 'homepage missing update wording');
    assert.ok(/href\s*=\s*["']update\/(index\.html)?["']/.test(home), 'homepage missing relative update/ link');
    assert.ok(/href\s*=\s*["']guide\/(index\.html)?["']/.test(home), 'homepage missing relative guide/ link');
    assert.ok(/href\s*=\s*["']help\/(index\.html)?["']/.test(home), 'homepage missing relative help/ link');
  });
});

describe('tools/build-site.mjs static guards', () => {
  test('builder has no child_process/delete calls, explicit + google allowlists', async () => {
    const src = readText(BUILDER_PATH);
    assert.ok(!src.includes('child_process'), 'builder must not use child_process');
    assert.ok(!src.includes('execSync') && !src.includes('spawnSync') && !src.includes('execFile'), 'builder must not spawn');
    assert.ok(!src.includes('rmSync') && !src.includes('rmdirSync') && !src.includes('unlinkSync'), 'builder must not delete');
    const allow = parseAllowlist(src);
    assert.equal(allow.length, 22, 'allowlist must have exactly 22 entries');
    for (const need of ['index.html', 'release-data.js', 'guide/index.html', 'help/index.html', 'update/index.html', 'update/update-page.js', 'assets/site.js', 'assets/tokens.css', 'assets/site-overrides.css']) {
      assert.ok(allow.includes(need), 'allowlist missing ' + need);
    }
    for (const u of [
      'https://accounts.google.com/gsi/client',
      'https://www.googleapis.com/drive/v3',
      'https://sheets.googleapis.com/v4',
      'https://script.googleapis.com/v1',
    ]) {
      assert.ok(src.includes(u), 'builder missing Google allowlist ' + u);
    }
  });

  test('scanText allows Google bases but rejects unrelated absolute URLs', async () => {
    const { scanText } = await import('../../tools/build-site.mjs');
    assert.doesNotThrow(() => scanText('ok', 'load https://accounts.google.com/gsi/client now'));
    assert.doesNotThrow(() => scanText('ok', 'use https://www.googleapis.com/drive/v3/files now'));
    assert.throws(() => scanText('bad', 'see https://example.com/evil for details'));
    assert.throws(() => scanText('bad', 'visit http://127.0.0.1:1/x now'));
  });
});

describe('tools/build-site.mjs spawn builds (mkdtemp exact paths)', () => {
  test('unpublished build succeeds with exactly 20 allowlisted files + placeholder', () => {
    const base = makeBase('site-content-');
    const out = path.join(base, 'out-unpublished');
    const r = runBuilder(['--out', out]);
    assert.equal(r.status, 0, 'unpublished build failed: ' + (r.stderr || r.stdout));
    const summary = JSON.parse(String(r.stdout).trim().split('\n').pop());
    assert.equal(summary.status, 'unpublished');
    assert.equal(summary.file_count, 22);
    assert.equal(summary.runtime_file_count, 0);
    const allow = parseAllowlist(readText(BUILDER_PATH));
    assert.deepEqual(listRelFiles(out), [...allow].sort());
    const rel = readText(path.join(out, 'release-data.js'));
    assert.ok(rel.includes('__QR_CHECK_RELEASE__'), 'missing QR release var');
    assert.ok(rel.includes('__MAKER_RUNTIME_FILES__'), 'missing runtime files var');
    assert.ok(rel.includes('__MAKER_RELEASE__'), 'missing maker release var');
    assert.ok(/unpublished/.test(rel), 'placeholder must stay unpublished');
  });

  test('nonempty output rejects', () => {
    const base = makeBase('site-content-');
    const out = path.join(base, 'out-nonempty');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'sentinel.txt'), 'x', 'utf8');
    const r = runBuilder(['--out', out]);
    assert.notEqual(r.status, 0, 'nonempty output must fail');
    assert.ok(/non-empty|nonempty/i.test(String(r.stderr) + String(r.stdout)), 'must report non-empty output');
  });

  test('synthetic runtime (one UTF-8 admin file) publishes exact source; mutated SHA rejects', () => {
    const base = makeBase('site-content-');
    const runtime = path.join(base, 'runtime');
    const adminDir = path.join(runtime, 'admin');
    fs.mkdirSync(adminDir, { recursive: true });
    const adminName = 'admin-test.js';
    const adminSource = '관리자 런타임 파일 — 한글 테스트\nconsole.log("hi");\n';
    fs.writeFileSync(path.join(adminDir, adminName), adminSource, 'utf8');
    const buf = fs.readFileSync(path.join(adminDir, adminName));
    assert.equal(buf.toString('utf8'), adminSource, 'admin file must round-trip UTF-8');
    const bytes = buf.length;
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const manifest = {
      app_version: '1.2.3',
      source_commit: 'abcdef1234567890',
      built_at: '2025-01-02T03:04:05.000Z',
      source_dirty: false,
      bundles: { admin: [{ name: adminName, bytes, sha256: sha }] },
    };
    fs.writeFileSync(path.join(runtime, 'manifest.json'), JSON.stringify(manifest), 'utf8');

    const out = path.join(base, 'out-published');
    const r = runBuilder(['--out', out, '--runtime', runtime]);
    assert.equal(r.status, 0, 'valid runtime build failed: ' + (r.stderr || r.stdout));
    const summary = JSON.parse(String(r.stdout).trim().split('\n').pop());
    assert.equal(summary.status, 'published');
    assert.equal(summary.app_version, '1.2.3');
    assert.equal(summary.runtime_file_count, 1);

    const gen = readText(path.join(out, 'release-data.js'));
    const qrMatch = gen.match(/__QR_CHECK_RELEASE__\s*=\s*(\{.*?\});/s);
    assert.ok(qrMatch, 'generated release-data missing QR object');
    const qr = JSON.parse(qrMatch[1]);
    assert.equal(qr.status, 'published');
    assert.equal(qr.app_version, '1.2.3');
    assert.equal(qr.source_commit, 'abcdef1234567890');
    assert.equal(qr.built_at, '2025-01-02T03:04:05.000Z');
    assert.equal(qr.runtime_file_count, 1);
    assert.ok(new RegExp('__MAKER_RELEASE__\\s*=\\s*"1\\.2\\.3"').test(gen), 'maker release must be bare version string');
    const filesMatch = gen.match(/__MAKER_RUNTIME_FILES__\s*=\s*(\[.*?\]);/s);
    assert.ok(filesMatch, 'generated release-data missing runtime files array');
    const files = JSON.parse(filesMatch[1]);
    assert.equal(files.length, 1);
    assert.equal(files[0].name, adminName);
    assert.equal(files[0].source, adminSource, 'runtime source must be exact UTF-8 bytes');

    // Mutated SHA must reject without touching the good output.
    const runtimeBad = path.join(base, 'runtime-bad');
    const adminBad = path.join(runtimeBad, 'admin');
    fs.mkdirSync(adminBad, { recursive: true });
    fs.writeFileSync(path.join(adminBad, adminName), adminSource, 'utf8');
    const badSha = sha.slice(0, 63) + (sha[63] === '0' ? '1' : '0');
    const manifestBad = {
      ...manifest,
      bundles: { admin: [{ name: adminName, bytes, sha256: badSha }] },
    };
    fs.writeFileSync(path.join(runtimeBad, 'manifest.json'), JSON.stringify(manifestBad), 'utf8');
    const outBad = path.join(base, 'out-bad');
    const rb = runBuilder(['--out', outBad, '--runtime', runtimeBad]);
    assert.notEqual(rb.status, 0, 'mutated SHA must fail');
    assert.ok(/sha256/i.test(String(rb.stderr) + String(rb.stdout)), 'must report sha256 mismatch');
  });
});



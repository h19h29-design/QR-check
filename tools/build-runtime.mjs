// tools/build-runtime.mjs — 학교 런타임 PUBLIC/ADMIN 묶음 생성 + 무결성 manifest
// private 원본 전체가 아니라 allowlist 파일만 추출한다. 시크릿 패턴이 있으면 중단한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const APP_DIR = path.join(ROOT, 'apps-script');

const PUBLIC_FILES = [
  'Code.gs',
  'SchoolConfig.gs',
  'SchemaMigrations.gs',
  'Sheets.gs',
  'Submit.gs',
  'QrTokens.gs',
  'DriveFiles.gs',
  'Templates.gs',
  'Client.js.html',
  'SubmitView.html',
  'Styles.html',
  'appsscript.json',
];

const ADMIN_ONLY_FILES = [
  'Auth.gs',
  'Admin.gs',
  'Api.gs',
  'DesktopSync.gs',
  'AdminView.html',
  'WebApp.html',
];

// 公开 묶음에 관리자·설정 API가 file 이름 기준으로 들어가지 않았는지 강제한다.
const FORBIDDEN_IN_PUBLIC = ['Auth.gs', 'Admin.gs', 'Api.gs', 'DesktopSync.gs', 'AdminView.html', 'WebApp.html'];

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{10,}/,
  /ya29\.[0-9A-Za-z_-]{10,}/,
  /client_secret/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function appVersion() {
  const code = fs.readFileSync(path.join(APP_DIR, 'Code.gs'), 'utf8');
  const m = code.match(/const APP_VERSION = '([^']+)'/);
  if (!m) throw new Error('APP_VERSION을 Code.gs에서 찾을 수 없습니다.');
  return m[1];
}

function gitCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function gitDirty() {
  try {
    return execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
  } catch {
    return true;
  }
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const version = appVersion();
  const outRoot = path.resolve(args[outIdx + 1] || path.join(ROOT, 'release', 'runtime', 'v' + version));

  for (const f of FORBIDDEN_IN_PUBLIC) {
    if (PUBLIC_FILES.includes(f)) throw new Error('공개 묶음에 관리자 파일 포함: ' + f);
  }

  const bundles = {
    public: PUBLIC_FILES,
    admin: [...PUBLIC_FILES, ...ADMIN_ONLY_FILES],
  };

  const manifest = {
    app_version: version,
    source_commit: gitCommit(),
    source_dirty: gitDirty(),
    built_at: new Date().toISOString(),
    bundles: {},
  };

  for (const [bundle, files] of Object.entries(bundles)) {
    const dir = path.join(outRoot, bundle);
    fs.mkdirSync(dir, { recursive: true });
    manifest.bundles[bundle] = [];
    for (const name of files) {
      const src = path.join(APP_DIR, name);
      if (!fs.existsSync(src)) throw new Error('묶음 파일 누락: ' + name);
      const content = fs.readFileSync(src, 'utf8');
      for (const pat of SECRET_PATTERNS) {
        if (pat.test(content)) throw new Error(`시크릿 패턴 검출(${bundle}/${name}): 빌드 중단`);
      }
      fs.writeFileSync(path.join(dir, name), content);
      manifest.bundles[bundle].push({
        name,
        bytes: Buffer.byteLength(content, 'utf8'),
        sha256: sha256(content),
      });
    }
  }

  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({
    out: outRoot,
    version,
    commit: manifest.source_commit,
    dirty: manifest.source_dirty,
    public_files: manifest.bundles.public.length,
    admin_files: manifest.bundles.admin.length,
  }));
}

main();

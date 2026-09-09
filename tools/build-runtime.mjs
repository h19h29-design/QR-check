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

function isEqualOrDescendant(child, parent) {
  let c = path.resolve(child);
  let p = path.resolve(parent);
  if (process.platform === 'win32') {
    c = c.toLowerCase();
    p = p.toLowerCase();
    return c === p || c.startsWith(p + path.sep);
  }
  return c === p || c.startsWith(p + path.sep);
}

function parseOutRaw(args) {
  if (args.length === 0) return { raw: null, isDefault: true };
  let raw = null;
  let count = 0;
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--out') {
      count += 1;
      const v = args[i + 1];
      if (v === undefined) {
        throw new Error('--out 값 누락: --out 다음에 경로가 필요합니다.');
      }
      if (typeof v !== 'string' || v.trim() === '') {
        throw new Error('--out 값 비어 있음: 빈 경로는 허용되지 않습니다.');
      }
      if (v.startsWith('-')) {
        throw new Error('--out 값 누락: 플래그가 값으로 전달됨: ' + v);
      }
      if (count === 1) raw = v;
      i += 2;
    } else if (typeof a === 'string' && a.startsWith('--out=')) {
      count += 1;
      const v = a.slice('--out='.length);
      if (v.trim() === '') {
        throw new Error('--out 값 비어 있음: --out= 뒤에 경로가 필요합니다.');
      }
      if (count === 1) raw = v;
      i += 1;
    } else {
      throw new Error('알 수 없는 인수: ' + a);
    }
  }
  if (count === 0) {
    throw new Error('알 수 없는 인수: 인자를 해석할 수 없습니다.');
  }
  if (count > 1) {
    throw new Error('--out 중복: 출력 경로는 한 번만 지정해야 합니다.');
  }
  return { raw, isDefault: false };
}

function main() {
  const args = process.argv.slice(2);
  const parsed = parseOutRaw(args);
  const version = appVersion();
  const outRoot = parsed.isDefault
    ? path.resolve(path.join(ROOT, 'release', 'runtime', 'v' + version))
    : path.resolve(parsed.raw);

  const fsRoot = path.parse(outRoot).root;
  if (outRoot === fsRoot) {
    throw new Error('출력 경로 거부: 파일시스템 루트는 허용되지 않습니다: ' + outRoot);
  }
  const normOut = process.platform === 'win32' ? outRoot.toLowerCase() : outRoot;
  const normRoot = process.platform === 'win32' ? ROOT.toLowerCase() : ROOT;
  if (normOut === normRoot) {
    throw new Error('출력 경로 거부: 저장소 루트는 허용되지 않습니다: ' + outRoot);
  }
  if (isEqualOrDescendant(outRoot, APP_DIR)) {
    throw new Error('출력 경로 거부: apps-script 내부/동일 경로는 허용되지 않습니다: ' + outRoot);
  }

  let cur = outRoot;
  while (true) {
    let st = null;
    try {
      st = fs.lstatSync(cur);
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        st = null;
      } else {
        throw e;
      }
    }
    if (st && st.isSymbolicLink()) {
      throw new Error('출력 경로 거부: 심볼릭 링크/정션: ' + cur);
    }
    if (st) {
      try {
        fs.readlinkSync(cur);
        throw new Error('출력 경로 거부: 심볼릭 링크/정션: ' + cur);
      } catch (e) {
        if (e && e.message && e.message.indexOf('출력 경로 거부: 심볼릭 링크/정션') === 0) throw e;
      }
    }
    if (process.platform === 'win32' ? cur.toLowerCase() === ROOT.toLowerCase() : cur === ROOT) break;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  let exists = false;
  try {
    const st = fs.lstatSync(outRoot);
    if (st.isSymbolicLink()) {
      throw new Error('출력 경로 거부: 출력이 심볼릭 링크입니다: ' + outRoot);
    }
    if (!st.isDirectory()) {
      throw new Error('출력 경로 거부: 기존 출력이 디렉터리가 아닙니다: ' + outRoot);
    }
    const entries = fs.readdirSync(outRoot);
    if (entries.length !== 0) {
      throw new Error('출력 경로 거부: 기존 출력이 비어 있지 않습니다: ' + outRoot);
    }
    exists = true;
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      exists = false;
    } else {
      throw e;
    }
  }

  if (!exists) {
    fs.mkdirSync(outRoot, { recursive: true });
    const rst = fs.lstatSync(outRoot);
    if (rst.isSymbolicLink() || !rst.isDirectory()) {
      throw new Error('출력 경로 거부: 생성 후 실제 디렉터리 확인 실패: ' + outRoot);
    }
    try {
      fs.readlinkSync(outRoot);
      throw new Error('출력 경로 거부: 생성 후 실제 디렉터리 확인 실패: ' + outRoot);
    } catch (e) {
      if (e && e.message && e.message.indexOf('출력 경로 거부: 생성 후 실제 디렉터리 확인 실패') === 0) throw e;
    }
  }

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
      fs.writeFileSync(path.join(dir, name), content, { flag: 'wx' });
      manifest.bundles[bundle].push({
        name,
        bytes: Buffer.byteLength(content, 'utf8'),
        sha256: sha256(content),
      });
    }
  }

  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
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

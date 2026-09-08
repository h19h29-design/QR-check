// tools/build-site.mjs — static installer site packager (Node built-ins only).
// Copies an explicit installer allowlist into a new-or-empty output dir.
// Without --runtime leaves release-data.js as unpublished placeholder.
// With --runtime verifies runtime/admin against manifest.json and generates OUTPUT/release-data.js.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const INSTALLER_DIR = path.join(ROOT, 'installer');

const ALLOWLIST = [
  'index.html',
  'release-data.js',
  'assets/site.css',
  'assets/tokens.css',
  'assets/site-overrides.css',
  'assets/site.js',
  'maker/index.html',
  'maker/maker.js',
  'demo/index.html',
  'demo/demo.js',
  'demo/sample-store.mjs',
  'guide/index.html',
  'help/index.html',
  'update/index.html',
  'update/update-page.js',
  'src/auth/config.js',
  'src/auth/google-auth.mjs',
  'src/google/rest.mjs',
  'src/google/resources.mjs',
  'src/install/state-machine.mjs',
  'src/install/orchestrator.mjs',
  'src/update/update.mjs',
];

const GIS_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4';
const SCRIPT_BASE = 'https://script.googleapis.com/v1';
const ALLOWED_URL_BASES = [
  GIS_URL,
  DRIVE_BASE,
  SHEETS_BASE,
  SCRIPT_BASE,
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
];

export function parseArgs(argv) {
  let out = null;
  let runtime = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out') {
      out = argv[i + 1] ?? null;
      i += 1;
    } else if (a.startsWith('--out=')) {
      out = a.slice('--out='.length) || null;
    } else if (a === '--runtime') {
      runtime = argv[i + 1] ?? null;
      i += 1;
    } else if (a.startsWith('--runtime=')) {
      runtime = a.slice('--runtime='.length) || null;
    } else if (a === '--help' || a === '-h') {
      out = out; // no-op, handled by caller error message
    } else {
      throw new Error('unknown argument: ' + a);
    }
  }
  return { out, runtime };
}

export function isInside(parentDir, childPath) {
  const rel = path.relative(parentDir, childPath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function isSimpleBasename(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return false;
  if (name !== path.basename(name)) return false;
  if (name === '.' || name === '..') return false;
  return true;
}

export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Throws on first secret / source-map / private-URL match. Allowed public Google bases are stripped first.
export function scanText(rel, content) {
  let withoutGis = content;
  for (const base of ALLOWED_URL_BASES) {
    withoutGis = withoutGis.split(base).join('');
  }
  const checks = [
    [/AIza[0-9A-Za-z_-]{10,}/, 'api key'],
    [/ya29\.[0-9A-Za-z_-]{10,}/, 'access token'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
    [/client_secret\s*["']?\s*[:=]/i, 'client_secret assignment'],
    [/admin[_\-]?(token|secret|key)["']?\s*[:=]/i, 'admin token/secret'],
    [/sync[_\-]?(token|secret|key)["']?\s*[:=]/i, 'sync token/secret'],
    [/admin(Token|Secret|Key)["']?\s*[:=]/, 'adminToken assignment'],
    [/sync(Token|Secret|Key)["']?\s*[:=]/, 'syncToken assignment'],
    [/sourceMappingURL\s*=/i, 'source map'],
    [/sourceMappingURL/i, 'source map'],
  ];
  for (const [re, label] of checks) {
    if (re.test(withoutGis)) {
      throw new Error('secret/sensitive pattern detected (' + label + ') in ' + rel);
    }
  }
  // Full absolute URLs are not allowed in the offline installer except the required public Google bases.
  // Detect any remaining http(s) URL after allowed-base removal.
  const urlRe = /https?:\/\/[^\s"'`<>)\]]+/i;
  const m = withoutGis.match(urlRe);
  if (m) {
    throw new Error('private/absolute URL detected in ' + rel + ': ' + m[0].slice(0, 80));
  }
}

function ensureRepoRoot() {
  let st = null;
  try {
    st = fs.lstatSync(ROOT);
  } catch {
    throw new Error('repo root not found: ' + ROOT);
  }
  if (st.isSymbolicLink()) throw new Error('repo root is a symlink: ' + ROOT);
  if (!st.isDirectory()) throw new Error('repo root is not a directory: ' + ROOT);
}

function ensureOutputDir(outRaw) {
  if (!outRaw) throw new Error('missing --out <new-or-empty-dir>');
  const resolvedOut = path.resolve(outRaw);
  if (resolvedOut === ROOT) throw new Error('refusing repo root as --out');
  if (resolvedOut === INSTALLER_DIR) throw new Error('refusing installer dir as --out: ' + resolvedOut);
  if (isInside(INSTALLER_DIR, resolvedOut)) throw new Error('refusing --out inside installer dir: ' + resolvedOut);
  let st = null;
  try {
    st = fs.lstatSync(resolvedOut);
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err;
  }
  if (st) {
    if (st.isSymbolicLink()) throw new Error('refusing symlinked --out: ' + resolvedOut);
    if (!st.isDirectory()) throw new Error('refusing non-directory --out: ' + resolvedOut);
    if (resolvedOut === ROOT) throw new Error('refusing repo root as --out');
    if (resolvedOut === INSTALLER_DIR) throw new Error('refusing installer dir as --out: ' + resolvedOut);
    if (isInside(INSTALLER_DIR, resolvedOut)) throw new Error('refusing --out inside installer dir: ' + resolvedOut);
    const entries = fs.readdirSync(resolvedOut);
    if (entries.length > 0) throw new Error('refusing non-empty output: ' + resolvedOut);
  } else {
    fs.mkdirSync(resolvedOut, { recursive: true });
  }
  // Re-lstat after mkdir to guard symlink races.
  const st2 = fs.lstatSync(resolvedOut);
  if (st2.isSymbolicLink()) throw new Error('refusing symlinked --out: ' + resolvedOut);
  if (!st2.isDirectory()) throw new Error('refusing non-directory --out: ' + resolvedOut);
  return resolvedOut;
}

function copyAllowlist(resolvedOut) {
  for (const rel of ALLOWLIST) {
    if (rel.endsWith('.map')) throw new Error('source map file not allowed: ' + rel);
    const src = path.join(INSTALLER_DIR, rel);
    const dest = path.resolve(resolvedOut, rel);
    if (dest !== resolvedOut && !isInside(resolvedOut, dest)) {
      throw new Error('refusing path outside output: ' + rel);
    }
    let lst = null;
    try {
      lst = fs.lstatSync(src);
    } catch {
      throw new Error('installer source missing: ' + rel);
    }
    if (lst.isSymbolicLink()) throw new Error('refusing symlink source: ' + rel);
    if (!lst.isFile()) throw new Error('installer source not a regular file: ' + rel);
    const content = fs.readFileSync(src, 'utf8');
    if (content.includes('sourceMappingURL') || rel.endsWith('.map')) {
      throw new Error('source map detected in ' + rel);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const finalDest = path.resolve(resolvedOut, rel);
    if (finalDest !== resolvedOut && !isInside(resolvedOut, finalDest)) {
      throw new Error('refusing path outside output: ' + rel);
    }
    fs.writeFileSync(finalDest, content, 'utf8');
  }
}

function listOutputFiles(resolvedOut) {
  const found = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const lst = fs.lstatSync(full);
      if (lst.isSymbolicLink()) throw new Error('symlink in output: ' + path.relative(resolvedOut, full));
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile()) {
        const rel = path.relative(resolvedOut, full).split(path.sep).join('/');
        found.push(rel);
      } else {
        throw new Error('unexpected non-file in output: ' + path.relative(resolvedOut, full));
      }
    }
  };
  walk(resolvedOut);
  return found.sort();
}

function verifyOutputExact(resolvedOut) {
  const found = listOutputFiles(resolvedOut);
  const want = [...ALLOWLIST].sort();
  if (found.length !== want.length || found.some((f, i) => f !== want[i])) {
    const extra = found.filter((f) => !ALLOWLIST.includes(f));
    const missing = ALLOWLIST.filter((f) => !found.includes(f));
    throw new Error(
      'output must contain exactly the allowlist (extra: ' + JSON.stringify(extra) +
      ', missing: ' + JSON.stringify(missing) + ')'
    );
  }
}

function scanOutput(resolvedOut) {
  for (const rel of ALLOWLIST) {
    const full = path.resolve(resolvedOut, rel);
    if (!isInside(resolvedOut, full) && full !== resolvedOut) {
      throw new Error('refusing path outside output during scan: ' + rel);
    }
    const content = fs.readFileSync(full, 'utf8');
    if (content.includes('sourceMappingURL')) throw new Error('source map detected in output ' + rel);
    scanText(rel, content);
  }
}

function loadAndVerifyRuntime(runtimeRaw) {
  const resolvedRuntime = path.resolve(runtimeRaw);
  let rst = null;
  try {
    rst = fs.lstatSync(resolvedRuntime);
  } catch {
    throw new Error('runtime dir not found: ' + resolvedRuntime);
  }
  if (rst.isSymbolicLink()) throw new Error('refusing symlinked --runtime: ' + resolvedRuntime);
  if (!rst.isDirectory()) throw new Error('--runtime is not a directory: ' + resolvedRuntime);
  const manifestPath = path.join(resolvedRuntime, 'manifest.json');
  let mst = null;
  try {
    mst = fs.lstatSync(manifestPath);
  } catch {
    throw new Error('runtime manifest missing: ' + manifestPath);
  }
  if (mst.isSymbolicLink()) throw new Error('refusing symlinked manifest: ' + manifestPath);
  if (!mst.isFile()) throw new Error('runtime manifest is not a file: ' + manifestPath);
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error('invalid runtime manifest JSON: ' + String(err && err.message ? err.message : err));
  }
  if (!manifest || typeof manifest !== 'object') throw new Error('invalid runtime manifest shape');
  const { app_version, source_commit, built_at, source_dirty, bundles } = manifest;
  if (typeof app_version !== 'string' || !/^[0-9]+\.[0-9]+\.[0-9]+([.+-][0-9A-Za-z.+-]+)*$/.test(app_version)) {
    throw new Error('invalid manifest app_version');
  }
  if (typeof source_commit !== 'string' || source_commit === 'unknown' || !/^[0-9a-fA-F]{7,64}$/.test(source_commit)) {
    throw new Error('invalid manifest source_commit');
  }
  if (typeof built_at !== 'string' || Number.isNaN(Date.parse(built_at))) {
    throw new Error('invalid manifest built_at');
  }
  if (source_dirty !== false) throw new Error('refusing dirty runtime source (source_dirty must be false)');
  if (!bundles || typeof bundles !== 'object' || !Array.isArray(bundles.admin) || bundles.admin.length === 0) {
    throw new Error('invalid manifest bundles.admin (must be nonempty)');
  }
  const adminDir = path.resolve(resolvedRuntime, 'admin');
  let adst = null;
  try {
    adst = fs.lstatSync(adminDir);
  } catch {
    throw new Error('runtime admin dir missing: ' + adminDir);
  }
  if (adst.isSymbolicLink()) throw new Error('refusing symlinked runtime admin dir');
  if (!adst.isDirectory()) throw new Error('runtime admin is not a directory');
  const verified = [];
  for (const entry of bundles.admin) {
    if (!entry || typeof entry !== 'object') throw new Error('invalid manifest admin entry shape');
    const { name, bytes, sha256 } = entry;
    if (!isSimpleBasename(name)) throw new Error('invalid admin entry name (must be simple basename): ' + String(name));
    if (!Number.isInteger(bytes) || bytes < 0) throw new Error('invalid admin entry bytes: ' + name);
    if (typeof sha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(sha256)) {
      throw new Error('invalid admin entry sha256: ' + name);
    }
    const full = path.resolve(adminDir, name);
    if (full !== adminDir && !isInside(adminDir, full)) {
      throw new Error('refusing admin path outside runtime/admin: ' + name);
    }
    let fst = null;
    try {
      fst = fs.lstatSync(full);
    } catch {
      throw new Error('runtime admin file missing: ' + name);
    }
    if (fst.isSymbolicLink()) throw new Error('refusing symlinked runtime file: ' + name);
    if (!fst.isFile()) throw new Error('runtime admin entry is not a regular file: ' + name);
    const buf = fs.readFileSync(full);
    if (buf.length !== bytes) {
      throw new Error('byte length mismatch for runtime file ' + name + ': manifest ' + bytes + ' vs actual ' + buf.length);
    }
    const actual = sha256Hex(buf);
    if (actual.toLowerCase() !== sha256.toLowerCase()) {
      throw new Error('sha256 mismatch for runtime file ' + name);
    }
    verified.push({ name, source: buf.toString('utf8') });
  }
  return { manifest, verified };
}

function generateReleaseData(resolvedOut, manifest, verified) {
  const runtimeFileCount = verified.length;
  const qr = {
    status: 'published',
    app_version: manifest.app_version,
    source_commit: manifest.source_commit,
    built_at: manifest.built_at,
    runtime_file_count: runtimeFileCount,
  };
  const makerRelease = manifest.app_version;
  const runtimeFiles = verified.map((v) => ({ name: v.name, source: v.source }));
  const body =
    '// Generated by tools/build-site.mjs. Do not edit.\n' +
    'window.__QR_CHECK_RELEASE__ = ' + safeJson(qr) + ';\n' +
    'window.__MAKER_RELEASE__ = ' + safeJson(makerRelease) + ';\n' +
    'window.__MAKER_RUNTIME_FILES__ = ' + safeJson(runtimeFiles) + ';\n';
  scanText('release-data.js', body);
  const dest = path.resolve(resolvedOut, 'release-data.js');
  if (!isInside(resolvedOut, dest)) throw new Error('refusing path outside output for release-data.js');
  fs.writeFileSync(dest, body, 'utf8');
  return { qr, makerRelease, runtimeFiles };
}

function main() {
  const { out, runtime } = parseArgs(process.argv.slice(2));
  ensureRepoRoot();
  const resolvedOut = ensureOutputDir(out);
  copyAllowlist(resolvedOut);
  verifyOutputExact(resolvedOut);
  scanOutput(resolvedOut);

  let status = 'unpublished';
  let appVersion = null;
  let sourceCommit = null;
  let builtAt = null;
  let runtimeFileCount = 0;

  if (runtime) {
    const { manifest, verified } = loadAndVerifyRuntime(runtime);
    generateReleaseData(resolvedOut, manifest, verified);
    status = 'published';
    appVersion = manifest.app_version;
    sourceCommit = manifest.source_commit;
    builtAt = manifest.built_at;
    runtimeFileCount = verified.length;
    // Rescan complete output including generated file; enforce exact allowlist still.
    verifyOutputExact(resolvedOut);
    scanOutput(resolvedOut);
  }

  const summary = {
    out: resolvedOut,
    status,
    app_version: appVersion,
    source_commit: sourceCommit,
    built_at: builtAt,
    file_count: ALLOWLIST.length,
    runtime_file_count: runtimeFileCount,
  };
  console.log(JSON.stringify(summary));
}

const invokedAsMain =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsMain) {
  try {
    main();
  } catch (err) {
    console.error('build-site failed: ' + (err && err.message ? err.message : String(err)));
    process.exit(1);
  }
}



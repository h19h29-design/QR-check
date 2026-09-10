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
  'maker/maker-polish.css',
  'demo/index.html',
  'demo/demo.js',
  'demo/sample-store.mjs',
  'guide/index.html',
  'help/index.html',
  'privacy/index.html',
  'update/index.html',
  'update/update-page.js',
  'src/auth/config.js',
  'src/auth/google-auth.mjs',
  'src/google/rest.mjs',
  'src/google/resources.mjs',
  'src/install/state-machine.mjs',
  'src/install/orchestrator.mjs',
  'src/install/resume.mjs',
  'src/update/update.mjs',
];

const GIS_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4';
const SCRIPT_BASE = 'https://script.googleapis.com/v1';
const MACROS_BASE = 'https://script.google.com/macros/s/';
const ALLOWED_URL_BASES = [
  GIS_URL,
  DRIVE_BASE,
  SHEETS_BASE,
  SCRIPT_BASE,
  MACROS_BASE,
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
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

// Runtime-specific URL allowlist: installer static bases plus the full Apps Script
// scopes legitimately present in verified runtime appsscript.json. Static scanText
// stays strict and unchanged; only decoded verified runtime sources use this list.
export const RUNTIME_ALLOWED_URL_BASES = [
  ...ALLOWED_URL_BASES,
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

// Exact public-validation regex literals observed in verified runtime. Each contains
// literal `\/` sequences that runtimeNormalizeForScan would otherwise convert into
// `https://` false positives. Only these two exact strings are removed before
// normalizing; arbitrary regex with escaped URLs must still reject.
export const RUNTIME_ALLOWED_REGEX_LITERALS = [
  '/^https:\\/\\/script\\.google\\.com\\/macros\\/s\\/[A-Za-z0-9_-]+\\/exec$/',
  '/^https:\\/\\/(drive|docs)\\.google\\.com\\//',
];

function runtimeNormalizeForScan(s) {
  return String(s)
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

// Narrow allowlist of harmless adminToken/syncKey shapes observed in verified runtime.
// Each entry requires a statement terminator afterwards so `...value || "evil"`
// or `...payload.adminToken || "evil"` is NOT stripped (LHS remains and rejects).
const RUNTIME_SAFE_STRIP_RES = [
  /const\s+token\s*=\s*payload\s*&&\s*payload\.newAdminToken\s*\?\s*payload\.newAdminToken\s*:\s*Utilities\.getUuid\(\)\s*\+\s*Utilities\.getUuid\(\)(?=\s*;)/g,
  /const\s+key\s*=\s*payload\s*&&\s*payload\.newSyncKey\s*\?\s*payload\.newSyncKey\s*:\s*Utilities\.getUuid\(\)\s*\+\s*Utilities\.getUuid\(\)(?=\s*;)/g,
  /adminToken\s*:\s*qs\(\s*['"]adminToken['"]\s*\)\.value(?=\s*[,;}\]\)]|\s*$)/g,
  /adminToken\s*:\s*document\.getElementById\(\s*['"]adminToken['"]\s*\)\.value(?=\s*[,;}\]\)]|\s*$)/g,
  /(?:const|let|var)\s+adminToken\s*=\s*payload\s*&&\s*payload\.adminToken(?=\s*[,;}\]\)]|\s*$)/g,
  /(?:const|let|var)\s+syncKey\s*=\s*payload\s*&&\s*\(\s*payload\.syncKey\s*\|\|\s*payload\.sync_key\s*\)(?=\s*[,;}\]\)]|\s*$)/g,
  /(?:const|let|var)\s+adminToken\s*=\s*payload\.adminToken(?=\s*[,;}\]\)]|\s*$)/g,
  /(?:const|let|var)\s+syncKey\s*=\s*payload\.syncKey(?=\s*[,;}\]\)]|\s*$)/g,
  /(?:const|let|var)\s+adminToken\s*=\s*\(\s*!setting_\(\s*['"]admin_token_hash['"]\s*,\s*['"]['"]\s*\)\s*\|\|\s*rotate\s*\)\s*\?\s*generateAdminTokenForSetup_\(\s*payload\s*\)\s*:\s*['"]\(기존 관리자 토큰 유지\)['"](?=\s*[,;}\]\)]|\s*$)/g,
  /(?:const|let|var)\s+syncKey\s*=\s*\(\s*!setting_\(\s*['"]sync_key_hash['"]\s*,\s*['"]['"]\s*\)\s*\|\|\s*rotate\s*\)\s*\?\s*generateSyncKeyForSetup_\(\s*payload\s*\)\s*:\s*['"]\(기존 Desktop Sync Key 유지\)['"](?=\s*[,;}\]\)]|\s*$)/g,
  /adminToken\s*:\s*adminToken(?=\s*[,;}\]\)]|\s*$)/g,
  /syncKey\s*:\s*syncKey(?=\s*[,;}\]\)]|\s*$)/g,
];

// Strict-but-context-aware scanner for decoded verified runtime sources (raw source
// with context). Rejects real key/token/secret literals, private keys, API/access
// tokens, OAuth client secrets, source maps, and unapproved absolute URLs, while
// accepting the narrow harmless adminToken/syncKey reads above and the explicit
// runtime Google scope URLs. Never evals or executes runtime code.
export function scanRuntimeSource(rel, content) {
  if (typeof content !== 'string') throw new Error('invalid runtime source type in ' + String(rel));
  const label = String(rel || 'runtime source');
  let pre = String(content);
  for (const lit of RUNTIME_ALLOWED_REGEX_LITERALS) {
    if (pre.includes(lit)) pre = pre.split(lit).join(' ');
  }
  const normalized = runtimeNormalizeForScan(pre);
  if (/sourceMappingURL/i.test(content) || /sourceMappingURL/i.test(normalized)) {
    throw new Error('secret/sensitive pattern detected (source map) in ' + label);
  }
  if (/AIza[0-9A-Za-z_-]{10,}/.test(normalized)) {
    throw new Error('secret/sensitive pattern detected (api key) in ' + label);
  }
  if (/ya29\.[0-9A-Za-z_-]{10,}/.test(normalized)) {
    throw new Error('secret/sensitive pattern detected (access token) in ' + label);
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(normalized)) {
    throw new Error('secret/sensitive pattern detected (private key) in ' + label);
  }
  let sans = normalized;
  for (const re of RUNTIME_SAFE_STRIP_RES) {
    re.lastIndex = 0;
    sans = sans.replace(re, ' ');
    re.lastIndex = 0;
  }
  const checks = [
    [/client_secret\s*["']?\s*[:=]/i, 'client_secret assignment'],
    [/admin[_\-]?(token|secret|key)["']?\s*[:=]/i, 'admin token/secret'],
    [/sync[_\-]?(token|secret|key)["']?\s*[:=]/i, 'sync token/secret'],
    [/admin(Token|Secret|Key)["']?\s*[:=]/, 'adminToken assignment'],
    [/sync(Token|Secret|Key)["']?\s*[:=]/, 'syncToken assignment'],
  ];
  for (const [re, checkLabel] of checks) {
    if (re.test(sans)) {
      throw new Error('secret/sensitive pattern detected (' + checkLabel + ') in ' + label);
    }
  }
  // Exact URL token allowlist: compare each complete URL token to the exact
  // allowed runtime entries. Substring removal would accept scope-prefix
  // lookalikes (e.g. `.../auth/drive.evil` contains `.../auth/drive`), so each
  // discovered token must equal an allowlist entry exactly.
  const allowedSet = new Set(RUNTIME_ALLOWED_URL_BASES);
  const urlReGlobal = /https?:\/\/[^\s"'`<>)\]]+/gi;
  urlReGlobal.lastIndex = 0;
  let urlMatch = null;
  while ((urlMatch = urlReGlobal.exec(sans)) !== null) {
    let token = urlMatch[0].replace(/[.,;:!?}]+$/g, '');
    if (!allowedSet.has(token)) {
      throw new Error('private/absolute URL detected in ' + label + ': ' + token.slice(0, 80));
    }
  }
}

export const RELEASE_DATA_HEADER = '// Generated by tools/build-site.mjs. Do not edit.\n';
const RELEASE_DATA_PREFIXES = [
  'window.__QR_CHECK_RELEASE__ = ',
  'window.__MAKER_RELEASE__ = ',
  'window.__MAKER_RUNTIME_FILES__ = ',
];

export function buildReleaseDataBody(manifest, verified) {
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
  return (
    RELEASE_DATA_HEADER +
    RELEASE_DATA_PREFIXES[0] + safeJson(qr) + ';\n' +
    RELEASE_DATA_PREFIXES[1] + safeJson(makerRelease) + ';\n' +
    RELEASE_DATA_PREFIXES[2] + safeJson(runtimeFiles) + ';\n'
  );
}

// Parses the generated wrapper exactly as generated, without executing it.
// Rejects malformed wrappers and injected trailing code.
export function parseReleaseDataBody(content) {
  if (typeof content !== 'string' || !content.startsWith(RELEASE_DATA_HEADER)) {
    throw new Error('malformed release-data.js (bad header)');
  }
  const rest = content.slice(RELEASE_DATA_HEADER.length);
  let pos = 0;
  const sections = [];
  for (let i = 0; i < RELEASE_DATA_PREFIXES.length; i += 1) {
    const pre = RELEASE_DATA_PREFIXES[i];
    if (!rest.startsWith(pre, pos)) {
      throw new Error('malformed release-data.js (bad wrapper prefix)');
    }
    pos += pre.length;
    const end = rest.indexOf(';\n', pos);
    if (end === -1) {
      throw new Error('malformed release-data.js (missing terminator)');
    }
    const jsonText = rest.slice(pos, end);
    if (!jsonText.trim()) {
      throw new Error('malformed release-data.js (empty section)');
    }
    let parsed = null;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('malformed release-data.js (invalid JSON section)');
    }
    sections.push({ jsonText, parsed });
    pos = end + 2;
  }
  if (pos !== rest.length) {
    throw new Error('malformed release-data.js (trailing code)');
  }
  return { qr: sections[0].parsed, makerRelease: sections[1].parsed, runtimeFiles: sections[2].parsed };
}

// Validates generated wrapper bytes exactly (no bypass via filename alone):
// byte-equality against expected output plus structural parse plus split scanning
// (metadata strictly, decoded runtime sources via runtime scanner).
export function validateGeneratedReleaseData(content, manifest, verified) {
  const expected = buildReleaseDataBody(manifest, verified);
  if (content !== expected) {
    throw new Error('release-data.js mismatch (tampered or stale; expected bytes differ)');
  }
  const parsed = parseReleaseDataBody(content);
  if (!parsed.qr || typeof parsed.qr !== 'object' || Array.isArray(parsed.qr)) {
    throw new Error('malformed release-data.js (bad qr section)');
  }
  if (
    parsed.qr.status !== 'published' ||
    parsed.qr.app_version !== manifest.app_version ||
    parsed.qr.source_commit !== manifest.source_commit ||
    parsed.qr.built_at !== manifest.built_at ||
    parsed.qr.runtime_file_count !== verified.length
  ) {
    throw new Error('release-data.js qr mismatch (tampered)');
  }
  if (parsed.makerRelease !== manifest.app_version) {
    throw new Error('release-data.js maker release mismatch (tampered)');
  }
  if (!Array.isArray(parsed.runtimeFiles) || parsed.runtimeFiles.length !== verified.length) {
    throw new Error('release-data.js runtime files mismatch (tampered)');
  }
  for (let i = 0; i < verified.length; i += 1) {
    const exp = verified[i];
    const got = parsed.runtimeFiles[i];
    if (
      !got || typeof got !== 'object' || Array.isArray(got) ||
      got.name !== exp.name || typeof got.source !== 'string' || got.source !== exp.source
    ) {
      throw new Error('release-data.js runtime file mismatch (tampered): ' + String(exp && exp.name ? exp.name : i));
    }
    if (typeof got.name !== 'string' || !isSimpleBasename(got.name)) {
      throw new Error('invalid runtime file name in wrapper: ' + String(got.name));
    }
  }
  scanText('release-data.js#qr', JSON.stringify(parsed.qr));
  scanText('release-data.js#maker', JSON.stringify(parsed.makerRelease));
  for (const f of parsed.runtimeFiles) {
    scanRuntimeSource('release-data.js#' + f.name, f.source);
  }
  return parsed;
}

function scanOutputWithRuntime(resolvedOut, manifest, verified) {
  for (const rel of ALLOWLIST) {
    if (rel === 'release-data.js') continue;
    const full = path.resolve(resolvedOut, rel);
    if (!isInside(resolvedOut, full) && full !== resolvedOut) {
      throw new Error('refusing path outside output during scan: ' + rel);
    }
    const otherContent = fs.readFileSync(full, 'utf8');
    if (otherContent.includes('sourceMappingURL')) throw new Error('source map detected in output ' + rel);
    scanText(rel, otherContent);
  }
  const dest = path.resolve(resolvedOut, 'release-data.js');
  if (!isInside(resolvedOut, dest)) throw new Error('refusing path outside output for release-data.js');
  const wrapperContent = fs.readFileSync(dest, 'utf8');
  validateGeneratedReleaseData(wrapperContent, manifest, verified);
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

const REQUIRED_ADMIN_NAMES = [
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
  'Auth.gs',
  'Admin.gs',
  'Api.gs',
  'DesktopSync.gs',
  'AdminView.html',
  'WebApp.html',
];

const STRICT_SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const FULL_COMMIT_RE = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
const CANONICAL_BUILT_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ADMIN_SHA_RE = /^[0-9a-fA-F]{64}$/;
const ANCHORED_APP_VERSION_RE = /^[ \t]*const[ \t]+APP_VERSION[ \t]*=[ \t]*(['"])([^'"]*)\1[ \t]*;?[ \t]*(?:\/\/.*)?$/gm;

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
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('invalid runtime manifest shape');
  }
  const { app_version, source_commit, built_at, source_dirty, bundles } = manifest;
  if (typeof app_version !== 'string' || !STRICT_SEMVER_RE.test(app_version)) {
    throw new Error('invalid manifest app_version');
  }
  if (typeof source_commit !== 'string' || !FULL_COMMIT_RE.test(source_commit)) {
    throw new Error('invalid manifest source_commit');
  }
  if (typeof built_at !== 'string' || !CANONICAL_BUILT_AT_RE.test(built_at) || Number.isNaN(Date.parse(built_at))) {
    throw new Error('invalid manifest built_at');
  }
  try {
    if (new Date(built_at).toISOString() !== built_at) {
      throw new Error('invalid manifest built_at');
    }
  } catch (err) {
    if (err && err.message === 'invalid manifest built_at') throw err;
    throw new Error('invalid manifest built_at');
  }
  if (source_dirty !== false) throw new Error('refusing dirty runtime source (source_dirty must be false)');
  if (!bundles || typeof bundles !== 'object' || Array.isArray(bundles) || !Array.isArray(bundles.admin)) {
    throw new Error('invalid manifest bundles.admin (must be nonempty)');
  }
  if (bundles.admin.length !== REQUIRED_ADMIN_NAMES.length) {
    throw new Error('invalid manifest bundles.admin (must list exactly 18 required runtime files)');
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
  const requiredSet = new Set(REQUIRED_ADMIN_NAMES);
  const seenManifest = new Set();
  for (const entry of bundles.admin) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('invalid manifest admin entry shape');
    }
    const { name, bytes, sha256 } = entry;
    if (typeof name !== 'string' || !isSimpleBasename(name)) {
      throw new Error('invalid admin entry name (must be simple basename): ' + String(name));
    }
    if (name !== name.trim() || name.includes('..')) {
      throw new Error('invalid admin entry name (must be simple basename): ' + String(name));
    }
    if (seenManifest.has(name)) {
      throw new Error('duplicate manifest admin entry: ' + name);
    }
    seenManifest.add(name);
    if (!Number.isInteger(bytes) || bytes < 0) throw new Error('invalid admin entry bytes: ' + name);
    if (typeof sha256 !== 'string' || !ADMIN_SHA_RE.test(sha256)) {
      throw new Error('invalid admin entry sha256: ' + name);
    }
    const full = path.resolve(adminDir, name);
    if (full !== adminDir && !isInside(adminDir, full)) {
      throw new Error('refusing admin path outside runtime/admin: ' + name);
    }
  }
  for (const required of REQUIRED_ADMIN_NAMES) {
    if (!seenManifest.has(required)) {
      throw new Error('missing manifest admin entry: ' + required);
    }
  }
  for (const name of seenManifest) {
    if (!requiredSet.has(name)) {
      throw new Error('extra manifest admin entry: ' + name);
    }
  }
  const physNames = fs.readdirSync(adminDir);
  if (physNames.length !== REQUIRED_ADMIN_NAMES.length) {
    throw new Error('runtime admin dir must contain exactly 18 files (found ' + physNames.length + ')');
  }
  const seenPhysical = new Set();
  for (const phys of physNames) {
    if (typeof phys !== 'string' || !isSimpleBasename(phys)) {
      throw new Error('invalid file in runtime admin dir: ' + String(phys));
    }
    if (phys !== phys.trim() || phys.includes('..')) {
      throw new Error('invalid file in runtime admin dir: ' + String(phys));
    }
    if (seenPhysical.has(phys)) {
      throw new Error('duplicate file in runtime admin dir: ' + phys);
    }
    seenPhysical.add(phys);
    if (!requiredSet.has(phys)) {
      throw new Error('extra file in runtime admin dir: ' + phys);
    }
    const physFull = path.join(adminDir, phys);
    const resolvedPhys = path.resolve(adminDir, phys);
    if (resolvedPhys !== physFull && !isInside(adminDir, resolvedPhys)) {
      throw new Error('refusing admin path outside runtime/admin: ' + phys);
    }
    const pst = fs.lstatSync(physFull);
    if (pst.isSymbolicLink()) throw new Error('refusing symlinked runtime file: ' + phys);
    if (pst.isDirectory()) throw new Error('unexpected directory in runtime admin dir: ' + phys);
    if (!pst.isFile()) throw new Error('runtime admin entry is not a regular file: ' + phys);
  }
  for (const required of REQUIRED_ADMIN_NAMES) {
    if (!seenPhysical.has(required)) {
      throw new Error('runtime admin file missing: ' + required);
    }
  }
  const verified = [];
  for (const entry of bundles.admin) {
    const { name, bytes, sha256 } = entry;
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
    const source = buf.toString('utf8');
    if (!source.trim()) {
      throw new Error('blank runtime source: ' + name);
    }
    verified.push({ name, source });
  }
  const byName = new Map();
  for (const v of verified) byName.set(v.name, v.source);
  const codeSource = byName.get('Code.gs');
  if (typeof codeSource !== 'string' || !codeSource.trim()) {
    throw new Error('runtime admin file missing: Code.gs');
  }
  ANCHORED_APP_VERSION_RE.lastIndex = 0;
  const codeMatches = [...codeSource.matchAll(ANCHORED_APP_VERSION_RE)];
  ANCHORED_APP_VERSION_RE.lastIndex = 0;
  if (codeMatches.length !== 1) {
    throw new Error('Code.gs must contain exactly one const APP_VERSION assignment');
  }
  if (codeMatches[0][2] !== app_version) {
    throw new Error('Code.gs APP_VERSION mismatch: expected ' + app_version);
  }
  const appsSource = byName.get('appsscript.json');
  if (typeof appsSource !== 'string' || !appsSource.trim()) {
    throw new Error('runtime admin file missing: appsscript.json');
  }
  let appsObj = null;
  try {
    appsObj = JSON.parse(appsSource);
  } catch {
    throw new Error('invalid appsscript.json JSON');
  }
  if (!appsObj || typeof appsObj !== 'object' || Array.isArray(appsObj)) {
    throw new Error('invalid appsscript.json shape');
  }
  const webapp = appsObj.webapp;
  if (!webapp || typeof webapp !== 'object' || Array.isArray(webapp)) {
    throw new Error('invalid appsscript.json webapp');
  }
  if (webapp.executeAs !== 'USER_DEPLOYING' || webapp.access !== 'ANYONE_ANONYMOUS') {
    throw new Error('invalid appsscript.json webapp (must be USER_DEPLOYING/ANYONE_ANONYMOUS)');
  }
  return { manifest, verified };
}

function generateReleaseData(resolvedOut, manifest, verified) {
  for (const v of verified) {
    scanRuntimeSource('runtime/admin/' + v.name, v.source);
  }
  const body = buildReleaseDataBody(manifest, verified);
  const parsed = validateGeneratedReleaseData(body, manifest, verified);
  const dest = path.resolve(resolvedOut, 'release-data.js');
  if (!isInside(resolvedOut, dest)) throw new Error('refusing path outside output for release-data.js');
  fs.writeFileSync(dest, body, 'utf8');
  const written = fs.readFileSync(dest, 'utf8');
  if (written !== body) throw new Error('release-data.js write mismatch');
  return { qr: parsed.qr, makerRelease: parsed.makerRelease, runtimeFiles: parsed.runtimeFiles };
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
    // Generated wrapper is validated structurally (byte-equality + JSON parse without
    // execution + split scanning), not with the strict installer scanText.
    verifyOutputExact(resolvedOut);
    scanOutputWithRuntime(resolvedOut, manifest, verified);
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

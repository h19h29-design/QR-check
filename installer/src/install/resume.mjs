// Go Muse Contributor/xhigh; public synthetic only.
import { STATES, resumeInfo } from './state-machine.mjs';
import { names } from '../google/resources.mjs';

const TOP_KEYS = ['schema_version', 'source_commit', 'install_id', 'account_email', 'release', 'state', 'resources'];
const ID_RE = /^[A-Za-z0-9_-]+$/;
const COMMIT_RE = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
const URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VER_RE = /^[1-9][0-9]*$/;
const RANK = Object.fromEntries(STATES.map((s, i) => [s, i]));

function fail() {
  throw new Error('invalid envelope');
}
function isPlain(v) {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}
function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}
function checkId(v, max) {
  if (typeof v !== 'string') fail();
  if (v.length < 1 || v.length > max) fail();
  if (!ID_RE.test(v)) fail();
}
function checkCommit(v) {
  if (typeof v !== 'string') fail();
  if (!COMMIT_RE.test(v)) fail();
}
function normEmail(v) {
  if (typeof v !== 'string') fail();
  const n = v.trim().toLowerCase();
  if (!n || !EMAIL_RE.test(n)) fail();
  return n;
}
function checkPrefix(v) {
  if (typeof v !== 'string') fail();
  const t = v.trim();
  if (t.length < 1 || t.length > 100) fail();
}
function checkVersion(v) {
  if (typeof v !== 'string') fail();
  if (!VER_RE.test(v)) fail();
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) fail();
}
function checkUrl(v) {
  if (typeof v !== 'string') fail();
  if (!URL_RE.test(v)) fail();
}
function allowedFor(state) {
  const r = RANK[state];
  if (r <= RANK.OAUTH_READY) return ['install_prefix'];
  if (state === 'API_ACCESS_READY') return ['install_prefix', 'folder_id', 'spreadsheet_id'];
  if (state === 'STORAGE_CREATED' || state === 'SCRIPT_CREATED') return ['install_prefix', 'folder_id', 'spreadsheet_id', 'script_id'];
  return ['install_prefix', 'folder_id', 'spreadsheet_id', 'script_id', 'version_number', 'deployment_id', 'web_app_url'];
}
function checkResources(resources, state, allowPending) {
  if (!isPlain(resources)) fail();
  if (hasOwn(resources, '__proto__') || hasOwn(resources, 'constructor') || hasOwn(resources, 'prototype')) fail();
  const keys = Object.keys(resources);
  const allowed = allowedFor(state);
  for (const k of keys) {
    if (k === 'operation_pending') {
      if (!allowPending) fail();
      const v = resources[k];
      if (typeof v !== 'string') fail();
      if (v.length < 1) fail();
      continue;
    }
    if (!allowed.includes(k)) fail();
    const v = resources[k];
    if (typeof v !== 'string') fail();
    if (k === 'install_prefix') checkPrefix(v);
    else if (k === 'version_number') checkVersion(v);
    else if (k === 'web_app_url') checkUrl(v);
    else checkId(v, 256);
  }
  const need = (k) => { if (!hasOwn(resources, k)) fail(); };
  const r = RANK[state];
  if (r >= RANK.API_ACCESS_READY) { need('install_prefix'); need('folder_id'); }
  if (r >= RANK.STORAGE_CREATED) need('spreadsheet_id');
  if (r >= RANK.SCRIPT_CREATED) need('script_id');
  if (r >= RANK.DEPLOYED) { need('version_number'); need('deployment_id'); need('web_app_url'); }
  if (state === 'CODE_UPLOADED') {
    const hd = hasOwn(resources, 'deployment_id');
    const hu = hasOwn(resources, 'web_app_url');
    const hv = hasOwn(resources, 'version_number');
    if (hd || hu) { if (!hd || !hu || !hv) fail(); }
  }
}
function checkTop(env) {
  if (!isPlain(env)) fail();
  if (hasOwn(env, '__proto__') || hasOwn(env, 'constructor') || hasOwn(env, 'prototype')) fail();
  const keys = Object.keys(env);
  if (keys.length !== TOP_KEYS.length) fail();
  for (const k of TOP_KEYS) { if (!hasOwn(env, k)) fail(); }
  for (const k of keys) { if (!TOP_KEYS.includes(k)) fail(); }
  if (env.schema_version !== 1) fail();
}

export function createResumeEnvelope(install, sourceCommit) {
  checkCommit(sourceCommit);
  if (!isPlain(install)) fail();
  const info = resumeInfo(install);
  if (!isPlain(info)) fail();
  const res = { ...(info.resources || {}) };
  if (!isPlain(res)) fail();
  if (hasOwn(res, 'operation_pending')) {
    if (typeof res.operation_pending !== 'string') fail();
    if (res.operation_pending === '') delete res.operation_pending;
  }
  const env = {
    schema_version: 1,
    source_commit: sourceCommit,
    install_id: info.install_id,
    account_email: info.account_email,
    release: info.release,
    state: info.state,
    resources: res,
  };
  checkTop(env);
  checkCommit(env.source_commit);
  if (typeof env.install_id !== 'string') fail();
  checkId(env.install_id, 128);
  normEmail(env.account_email);
  if (typeof env.release !== 'string' || env.release.length < 1) fail();
  if (typeof env.state !== 'string' || !STATES.includes(env.state)) fail();
  checkResources(env.resources, env.state, true);
  return {
    schema_version: 1,
    source_commit: env.source_commit,
    install_id: env.install_id,
    account_email: env.account_email,
    release: env.release,
    state: env.state,
    resources: { ...env.resources },
  };
}

export function parseResumeEnvelope(text, ctx) {
  if (typeof text !== 'string') fail();
  if (text.length > 16384) fail();
  let env;
  try {
    env = JSON.parse(text);
  } catch {
    fail();
  }
  checkTop(env);
  checkCommit(env.source_commit);
  if (typeof env.install_id !== 'string') fail();
  checkId(env.install_id, 128);
  if (typeof env.account_email !== 'string') fail();
  if (typeof env.release !== 'string' || env.release.length < 1) fail();
  if (typeof env.state !== 'string' || !STATES.includes(env.state)) fail();
  if (!ctx || typeof ctx !== 'object') fail();
  const { accountEmail, release, sourceCommit } = ctx;
  checkCommit(sourceCommit);
  if (env.source_commit !== sourceCommit) fail();
  normEmail(accountEmail);
  if (typeof release !== 'string' || release.length < 1) fail();
  if (env.release !== release) fail();
  const gotMail = normEmail(env.account_email);
  if (gotMail !== normEmail(accountEmail)) fail();
  if (!isPlain(env.resources)) fail();
  if (hasOwn(env.resources, 'operation_pending')) fail();
  checkResources(env.resources, env.state, false);
  return {
    schema_version: 1,
    source_commit: env.source_commit,
    install_id: env.install_id,
    account_email: env.account_email,
    release: env.release,
    state: env.state,
    resources: { ...env.resources },
  };
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

function restoreFail() {
  throw new Error('invalid snapshot');
}

function isObj(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toExpectedRuntime(runtimeFiles) {
  if (!Array.isArray(runtimeFiles) || runtimeFiles.length === 0) restoreFail();
  const out = [];
  const seen = new Set();
  for (const e of runtimeFiles) {
    if (!isObj(e)) restoreFail();
    const n = e.name;
    const s = e.source;
    if (typeof n !== 'string' || n.length < 1) restoreFail();
    if (typeof s !== 'string') restoreFail();
    let cname = '';
    let ctype = '';
    if (n === 'appsscript.json') {
      cname = 'appsscript';
      ctype = 'JSON';
    } else if (n.endsWith('.gs')) {
      cname = n.slice(0, -3);
      ctype = 'SERVER_JS';
    } else if (n.endsWith('.html')) {
      cname = n.slice(0, -5);
      ctype = 'HTML';
    } else {
      restoreFail();
    }
    if (cname.length < 1) restoreFail();
    if (seen.has(cname)) restoreFail();
    seen.add(cname);
    out.push({ name: cname, type: ctype, source: s });
  }
  return out;
}

function checkFilesMatch(actual, expected) {
  if (!Array.isArray(actual)) restoreFail();
  if (actual.length !== expected.length) restoreFail();
  if (actual.length === 0) restoreFail();
  const seen = new Set();
  for (const f of actual) {
    if (!isObj(f)) restoreFail();
    if (typeof f.name !== 'string' || typeof f.type !== 'string' || typeof f.source !== 'string') restoreFail();
    if (f.name.length < 1) restoreFail();
    if (seen.has(f.name)) restoreFail();
    seen.add(f.name);
  }
  const used = new Array(actual.length).fill(false);
  for (const exp of expected) {
    let found = -1;
    for (let i = 0; i < actual.length; i++) {
      if (used[i]) continue;
      const got = actual[i];
      if (got.name === exp.name && got.type === exp.type && got.source.replace(/\r\n?/g, '\n') === exp.source.replace(/\r\n?/g, '\n')) {
        found = i;
        break;
      }
    }
    if (found === -1) restoreFail();
    used[found] = true;
  }
}

function normalizeRestoredState(s) {
  if (s === 'DRAFT' || s === 'OAUTH_READY') return 'DRAFT';
  if (s === 'DEPLOYED' || s === 'AWAITING_SCHOOL_AUTH' || s === 'VERIFIED' || s === 'COMPLETE') {
    return 'AWAITING_SCHOOL_AUTH';
  }
  return s;
}

async function restoreInner(input) {
  if (!isObj(input)) restoreFail();
  const { text, accountEmail, release, sourceCommit, res, runtimeFiles } = input;
  const env = parseResumeEnvelope(text, { accountEmail, release, sourceCommit });
  if (!res || typeof res !== 'object') restoreFail();
  const state = env.state;
  const resources = env.resources;
  const rank = RANK[state];
  const needParent = rank >= RANK.STORAGE_CREATED;

  let expectedNames = null;
  const hasDriveId =
    hasOwn(resources, 'folder_id') || hasOwn(resources, 'spreadsheet_id') || hasOwn(resources, 'script_id');
  if (hasDriveId) {
    const prefix = resources.install_prefix;
    if (typeof prefix !== 'string') restoreFail();
    expectedNames = names(prefix);
    if (!isObj(expectedNames)) restoreFail();
  }

  let trusted = null;
  const needCode = rank >= RANK.CODE_UPLOADED;
  const needVersion = hasOwn(resources, 'version_number');
  const needDeploy = hasOwn(resources, 'deployment_id');
  if (needCode || needVersion || needDeploy) {
    trusted = toExpectedRuntime(runtimeFiles);
  }

  if (hasOwn(resources, 'folder_id')) {
    if (typeof res.getFileMetadata !== 'function') restoreFail();
    const m = await res.getFileMetadata(resources.folder_id);
    if (!isObj(m)) restoreFail();
    if (m.id !== resources.folder_id) restoreFail();
    if (m.name !== expectedNames.folder) restoreFail();
    if (m.mimeType !== FOLDER_MIME) restoreFail();
    if (m.ownedByMe !== true) restoreFail();
    if (m.trashed !== false) restoreFail();
  }

  if (hasOwn(resources, 'spreadsheet_id')) {
    if (typeof res.getFileMetadata !== 'function') restoreFail();
    const m = await res.getFileMetadata(resources.spreadsheet_id);
    if (!isObj(m)) restoreFail();
    if (m.id !== resources.spreadsheet_id) restoreFail();
    if (m.name !== expectedNames.sheet) restoreFail();
    if (m.mimeType !== SHEET_MIME) restoreFail();
    if (m.ownedByMe !== true) restoreFail();
    if (m.trashed !== false) restoreFail();
    if (needParent) {
      if (!hasOwn(resources, 'folder_id')) restoreFail();
      if (!Array.isArray(m.parents)) restoreFail();
      if (!m.parents.includes(resources.folder_id)) restoreFail();
    }
  }

  if (hasOwn(resources, 'script_id')) {
    if (typeof res.getProject !== 'function') restoreFail();
    const project = await res.getProject(resources.script_id);
    if (!isObj(project)) restoreFail();
    if (project.scriptId !== resources.script_id) restoreFail();
    if (project.title !== expectedNames.script) restoreFail();
    if (!isObj(project.creator)) restoreFail();
    if (normEmail(project.creator.email) !== normEmail(env.account_email)) restoreFail();

    if (typeof res.getContent !== 'function') restoreFail();
    const head = await res.getContent(resources.script_id);
    if (!isObj(head)) restoreFail();
    if (head.scriptId !== resources.script_id) restoreFail();
    if (!Array.isArray(head.files)) restoreFail();
    if (rank < RANK.CODE_UPLOADED) {
      if (head.files.length === 0) {
        // empty allowed
      } else if (head.files.length === 1) {
        const f = head.files[0];
        if (!isObj(f)) restoreFail();
        if (f.name !== 'appsscript' || f.type !== 'JSON') restoreFail();
        if (typeof f.source !== 'string') restoreFail();
        let parsed;
        try {
          parsed = JSON.parse(f.source);
        } catch {
          restoreFail();
        }
        if (!isPlain(parsed)) restoreFail();
      } else {
        restoreFail();
      }
    } else {
      if (!trusted) trusted = toExpectedRuntime(runtimeFiles);
      checkFilesMatch(head.files, trusted);
    }
  }

  if (needVersion) {
    if (!hasOwn(resources, 'script_id')) restoreFail();
    if (typeof res.getContent !== 'function') restoreFail();
    const vnum = Number(resources.version_number);
    if (!Number.isSafeInteger(vnum) || vnum <= 0) restoreFail();
    if (!trusted) trusted = toExpectedRuntime(runtimeFiles);
    const ver = await res.getContent(resources.script_id, vnum);
    if (!isObj(ver)) restoreFail();
    if (ver.scriptId !== resources.script_id) restoreFail();
    if (!Array.isArray(ver.files)) restoreFail();
    checkFilesMatch(ver.files, trusted);
  }

  if (needDeploy) {
    if (!hasOwn(resources, 'script_id') || !hasOwn(resources, 'version_number')) restoreFail();
    if (!hasOwn(resources, 'web_app_url')) restoreFail();
    if (typeof res.getDeployment !== 'function') restoreFail();
    const dep = await res.getDeployment(resources.script_id, resources.deployment_id);
    if (!isObj(dep)) restoreFail();
    if (dep.deploymentId !== resources.deployment_id) restoreFail();
    const cfg = dep.deploymentConfig;
    if (!isObj(cfg)) restoreFail();
    if (cfg.scriptId !== resources.script_id) restoreFail();
    if (typeof cfg.versionNumber !== 'number') restoreFail();
    if (!Number.isSafeInteger(cfg.versionNumber) || cfg.versionNumber <= 0) restoreFail();
    const savedV = Number(resources.version_number);
    if (!Number.isSafeInteger(savedV) || savedV <= 0) restoreFail();
    if (cfg.versionNumber !== savedV) restoreFail();
    if (cfg.manifestFileName !== 'appsscript') restoreFail();
    if (!Array.isArray(dep.entryPoints) || dep.entryPoints.length === 0) restoreFail();
    let ok = false;
    for (const e of dep.entryPoints) {
      if (!isObj(e)) continue;
      if (e.entryPointType !== 'WEB_APP') continue;
      const wa = e.webApp;
      if (!isObj(wa)) continue;
      if (wa.url === resources.web_app_url) {
        ok = true;
        break;
      }
    }
    if (!ok) restoreFail();
  }

  const account = normEmail(env.account_email);
  return {
    install_id: env.install_id,
    account_email: account,
    release: env.release,
    state: normalizeRestoredState(state),
    resources: { ...resources },
    stage_completed_at: {},
  };
}

export async function restoreInstallFromSnapshot(input) {
  try {
    return await restoreInner(input);
  } catch {
    throw new Error('invalid snapshot');
  }
}

// installer/tests/maker-release-gate.test.mjs — TESTS ONLY.
// Run: node --test installer/tests/maker-release-gate.test.mjs (auto-reruns with --experimental-vm-modules).
// Desired release gates for owner-only pilot; negatives fail until gates land.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerDir = path.resolve(here, '..');
const makerPath = path.join(installerDir, 'maker', 'maker.js');
const authPath = path.join(installerDir, 'src', 'auth', 'google-auth.mjs');
const restPath = path.join(installerDir, 'src', 'google', 'rest.mjs');
const resourcesPath = path.join(installerDir, 'src', 'google', 'resources.mjs');
const stateMachinePath = path.join(installerDir, 'src', 'install', 'state-machine.mjs');
const orchestratorPath = path.join(installerDir, 'src', 'install', 'orchestrator.mjs');
const resumePath = path.join(installerDir, 'src', 'install', 'resume.mjs');

const TEST_CLIENT_ID = 'synthetic-test-client-123.apps.googleusercontent.com';
const OWNER_EMAIL = 'owner@school.kr';

const ADMIN_RUNTIME_NAMES = [
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

const VALID_SEMVER = '0.1.0';
const VALID_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const VALID_DATE_ISO = '2026-09-01T00:00:00.000Z';

function validAppsScriptJson() {
  return JSON.stringify({
    timeZone: 'Asia/Seoul',
    runtimeVersion: 'V8',
    oauthScopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' },
    exceptionLogging: 'STACKDRIVER',
  });
}

function makeValidRuntimeFiles() {
  return ADMIN_RUNTIME_NAMES.map((name) => {
    if (name === 'appsscript.json') return { name, source: validAppsScriptJson() };
    return { name, source: `// synthetic fixture for ${name}\nconst SYNTHETIC = 1;\n` };
  });
}

function makeValidQrRelease() {
  return {
    status: 'published',
    app_version: VALID_SEMVER,
    source_commit: VALID_COMMIT,
    built_at: VALID_DATE_ISO,
    runtime_file_count: 18,
  };
}

const KNOWN_IDS = [
  'maker-status',
  'school-name',
  'school-admin-email',
  'admin-email',
  'account-email',
  'connect-btn',
  'permission-status',
  'create-btn',
  'retry-btn',
  'admin-url',
  'verify-btn',
  'owner-steps',
  'resume-info',
  'complete-btn',
  'maker-release',
  'maker-release-note',
  'wizard-stage-label',
  'resume-input',
  'resume-btn',
];

function makeDom() {
  const elements = new Map();
  for (const id of KNOWN_IDS) {
    elements.set(id, {
      id,
      value: '',
      textContent: '',
      disabled: true,
      hidden: id === 'admin-url',
      href: '',
      _clickHandlers: [],
      addEventListener(type, fn) {
        if (type === 'click' && typeof fn === 'function') this._clickHandlers.push(fn);
      },
      getAttribute() { return null; },
      setAttribute() {},
      removeAttribute() {},
    });
  }
  const doc = {
    readyState: 'complete',
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  return { doc, elements };
}

function makeTracker() {
  return {
    gisInitCalls: 0,
    gisRequestCalls: 0,
    lastClientId: '',
    fetchCalls: 0,
    fetchUrls: [],
    firstWriteUrl: '',
    writeCount: 0,
  };
}

function makeGis(tracker) {
  return {
    accounts: {
      oauth2: {
        initTokenClient(opts) {
          tracker.gisInitCalls += 1;
          tracker.lastClientId = opts && opts.client_id ? String(opts.client_id) : '';
          return {
            requestAccessToken() {
              tracker.gisRequestCalls += 1;
              opts.callback({
                access_token: 'synthetic-token-abc',
                expires_in: 3600,
                scope: opts.scope || '',
              });
            },
          };
        },
        revoke() {},
      },
    },
  };
}

function okResponse(json) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(json),
  };
}

function forbiddenResponse() {
  return {
    ok: false,
    status: 403,
    text: async () => JSON.stringify({ error: { code: 403, message: 'synthetic-stop-forbidden' } }),
  };
}

function makeFetch(tracker) {
  return async (url, opts = {}) => {
    tracker.fetchCalls += 1;
    const method = String(opts.method || 'GET').toUpperCase();
    const u = String(url);
    tracker.fetchUrls.push(`${method} ${u}`);
    if (u.includes('/drive/v3/about')) {
      return okResponse({ user: { emailAddress: OWNER_EMAIL } });
    }
    if (method === 'GET') {
      if (u.includes('/drive/v3/files')) return okResponse({ files: [] });
      return okResponse({});
    }
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      tracker.writeCount += 1;
      if (!tracker.firstWriteUrl) tracker.firstWriteUrl = `${method} ${u}`;
      return forbiddenResponse();
    }
    return okResponse({});
  };
}

async function clickAndSettle(el, bound = 40) {
  const handlers = [...(el._clickHandlers || [])];
  for (const h of handlers) {
    try { h({ preventDefault() {} }); } catch { /* handler reports via DOM */ }
  }
  for (let i = 0; i < bound; i++) {
    await new Promise((r) => setImmediate(r));
    await Promise.resolve();
  }
}

async function loadBootMaker() {
  const makerCode = readFileSync(makerPath, 'utf8');
  const authCode = readFileSync(authPath, 'utf8');
  const restCode = readFileSync(restPath, 'utf8');
  const resourcesCode = readFileSync(resourcesPath, 'utf8');
  const smCode = readFileSync(stateMachinePath, 'utf8');
  const orchCode = readFileSync(orchestratorPath, 'utf8');
  const resumeCode = readFileSync(resumePath, 'utf8');
  const syntheticConfig = `export const GOOGLE_OAUTH_CLIENT_ID = ${JSON.stringify(TEST_CLIENT_ID)};\nexport const INSTALL_SCOPES = ['openid','email','profile','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/script.projects','https://www.googleapis.com/auth/script.deployments'];\n`;

  const sandbox = {
    console, Math, Date, URL, URLSearchParams,
    Array, String, Number, Boolean, Error, RegExp, Promise, Map, Set,
    encodeURIComponent, decodeURIComponent,
    setImmediate, clearImmediate, queueMicrotask,
    setTimeout, clearTimeout,
    fetch: async () => { throw Object.assign(new Error('harness defect: global fetch must not be used'), { kind: 'SYNTHETIC_STOP' }); },
  };
  sandbox.crypto = { randomUUID: () => '00000000-0000-4000-8000-synthetic001' };
  const context = vm.createContext(sandbox);
  const cache = new Map();

  function toModule(code, identifier) {
    if (cache.has(identifier)) return cache.get(identifier);
    const m = new vm.SourceTextModule(code, { context, identifier });
    cache.set(identifier, m);
    return m;
  }

  const linker = async (specifier) => {
    if (specifier.endsWith('config.js')) return toModule(syntheticConfig, 'synthetic-config.js');
    if (specifier.includes('google-auth.mjs')) return toModule(authCode, 'google-auth.mjs');
    if (specifier.includes('resources.mjs')) return toModule(resourcesCode, 'resources.mjs');
    if (specifier.includes('rest.mjs')) return toModule(restCode, 'rest.mjs');
    if (specifier.includes('state-machine.mjs')) return toModule(smCode, 'state-machine.mjs');
    if (specifier.includes('orchestrator.mjs')) return toModule(orchCode, 'orchestrator.mjs');
    if (specifier.includes('resume.mjs')) return toModule(resumeCode, 'resume.mjs');
    throw new Error(`unexpected import specifier in test linker: ${specifier}`);
  };

  const entry = new vm.SourceTextModule(makerCode, { context, identifier: 'maker.js' });
  await entry.link(linker);
  await entry.evaluate();
  assert.equal(typeof entry.namespace.bootMaker, 'function', 'import failed: bootMaker missing');
  return { context, bootMaker: entry.namespace.bootMaker };
}

async function bootAndClickConnectThenCreate({ domReleaseValue = '', winRelease = '', qrRelease = null, runtimeFiles = null } = {}) {
  const { context, bootMaker } = await loadBootMaker();
  const { doc, elements } = makeDom();
  const tracker = makeTracker();
  const mockWin = {
    __MAKER_RELEASE__: winRelease,
    __QR_CHECK_RELEASE__: qrRelease,
    __MAKER_RUNTIME_FILES__: runtimeFiles,
    fetch: makeFetch(tracker),
    google: makeGis(tracker),
    dispatchEvent() {},
    CustomEvent: function CustomEvent() {},
  };
  context.window = mockWin;
  context.document = doc;
  context.__bootFn = bootMaker;
  vm.runInContext('__bootFn();', context);

  elements.get('school-name').value = 'OO초등학교';
  elements.get('school-admin-email').value = OWNER_EMAIL;
  elements.get('admin-email').value = OWNER_EMAIL;
  elements.get('account-email').value = OWNER_EMAIL;
  elements.get('maker-release').value = domReleaseValue;
  await clickAndSettle(elements.get('connect-btn'));
  await clickAndSettle(elements.get('create-btn'));
  return { elements, tracker, mockWin };
}

function resourceWrites(tracker) {
  return tracker.fetchUrls.filter((u) => u.startsWith('POST ') || u.startsWith('PUT ') || u.startsWith('PATCH '));
}

// --- resume-import helpers (synthetic only, bounded) ---
const RESUME_PREFIX_API = 'QR_OO초등학교_resume01_';
const RESUME_FOLDER_API = 'folder-synth-resume01';
const RESUME_INSTALL_API = 'install-synth-resume01';
const RESUME_PREFIX_COMP = 'QR_OO초등학교_comp01_';
const RESUME_FOLDER_COMP = 'folder-synth-comp01';
const RESUME_SHEET_COMP = 'sheet-synth-comp01';
const RESUME_SCRIPT_COMP = 'script-synth-comp01';
const RESUME_DEPLOY_COMP = 'deploy-synth-comp01';
const RESUME_VERSION_COMP = '3';
const RESUME_WEBAPP_COMP = 'https://script.google.com/macros/s/synthDeployComp01/exec';
const RESUME_INSTALL_COMP = 'install-synth-comp01';
const FORBIDDEN_SNAPSHOT_KEYS = ['access_token', 'refresh_token', 'id_token', 'admin_token', 'sync_key', 'submit_token', 'setup_key'];

function makeApiReadyEnvelope() {
  // Equals createResumeEnvelope({API_ACCESS_READY + folder}, VALID_COMMIT) shape.
  return {
    schema_version: 1,
    source_commit: VALID_COMMIT,
    install_id: RESUME_INSTALL_API,
    account_email: OWNER_EMAIL,
    release: VALID_SEMVER,
    state: 'API_ACCESS_READY',
    resources: { install_prefix: RESUME_PREFIX_API, folder_id: RESUME_FOLDER_API },
  };
}

function makeCompleteEnvelope() {
  // Equals createResumeEnvelope({COMPLETE + full resources}, VALID_COMMIT) shape.
  return {
    schema_version: 1,
    source_commit: VALID_COMMIT,
    install_id: RESUME_INSTALL_COMP,
    account_email: OWNER_EMAIL,
    release: VALID_SEMVER,
    state: 'COMPLETE',
    resources: {
      install_prefix: RESUME_PREFIX_COMP,
      folder_id: RESUME_FOLDER_COMP,
      spreadsheet_id: RESUME_SHEET_COMP,
      script_id: RESUME_SCRIPT_COMP,
      version_number: RESUME_VERSION_COMP,
      deployment_id: RESUME_DEPLOY_COMP,
      web_app_url: RESUME_WEBAPP_COMP,
    },
  };
}

function toGasExpected(runtimeFiles) {
  return runtimeFiles.map((f) => {
    if (f.name === 'appsscript.json') return { name: 'appsscript', type: 'JSON', source: f.source };
    if (f.name.endsWith('.gs')) return { name: f.name.slice(0, -3), type: 'SERVER_JS', source: f.source };
    return { name: f.name.slice(0, -5), type: 'HTML', source: f.source };
  });
}

function parseResumeInfoJson(text) {
  const s = String(text || '');
  const idx = s.indexOf('{');
  assert.ok(idx >= 0, `resume-info must contain JSON-only export, got ${s.slice(0, 300)}`);
  return JSON.parse(s.slice(idx));
}

function assertNoSecretsInSnapshot(text) {
  const low = String(text || '').toLowerCase();
  for (const k of FORBIDDEN_SNAPSHOT_KEYS) assert.ok(!low.includes(k), `snapshot must not contain credentials (${k})`);
}

function makeVerifyFetch(tracker, { metas = {}, heads = {}, versions = {}, deploys = {}, failSubstrings = [] } = {}) {
  const base = makeFetch(tracker);
  return async (url, opts = {}) => {
    const method = String(opts.method || 'GET').toUpperCase();
    const u = String(url);
    for (const s of failSubstrings) {
      if (u.includes(s)) {
        tracker.fetchCalls += 1;
        tracker.fetchUrls.push(`${method} ${u}`);
        return { ok: false, status: 403, text: async () => JSON.stringify({ error: { code: 403, message: 'synthetic-stop-forbidden' } }) };
      }
    }
    if (method === 'GET') {
      for (const [id, meta] of Object.entries(metas)) {
        if (u.includes(`/drive/v3/files/${encodeURIComponent(id)}`) || u.includes(`/drive/v3/files/${id}`)) {
          tracker.fetchCalls += 1;
          tracker.fetchUrls.push(`${method} ${u}`);
          return okResponse(meta);
        }
      }
      if (u.includes('/script.googleapis.com/v1/projects/') && u.includes('/content')) {
        const m = u.match(/\/projects\/([^/?]+)\/content/);
        const sid = m ? decodeURIComponent(m[1]) : '';
        tracker.fetchCalls += 1;
        tracker.fetchUrls.push(`${method} ${u}`);
        if (u.includes('versionNumber=')) {
          const vm = u.match(/versionNumber=([0-9]+)/);
          const key = `${sid}:${vm ? vm[1] : ''}`;
          if (versions[key]) return okResponse(versions[key]);
          return { ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 404 } }) };
        }
        if (heads[sid]) return okResponse(heads[sid]);
        return { ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 404 } }) };
      }
      if (u.includes('/script.googleapis.com/v1/projects/') && u.includes('/deployments/')) {
        const m = u.match(/\/projects\/([^/?]+)\/deployments\/([^/?]+)/);
        const sid = m ? decodeURIComponent(m[1]) : '';
        const did = m ? decodeURIComponent(String(m[2]).split('?')[0]) : '';
        tracker.fetchCalls += 1;
        tracker.fetchUrls.push(`${method} ${u}`);
        const key = `${sid}:${did}`;
        if (deploys[key]) return okResponse(deploys[key]);
        return { ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 404 } }) };
      }
    }
    return base(url, opts);
  };
}

async function bootConnectedForResume({ fetchBuilder = null, qrRelease = null, runtimeFiles = null } = {}) {
  const { context, bootMaker } = await loadBootMaker();
  const { doc, elements } = makeDom();
  const tracker = makeTracker();
  const fetchFn = fetchBuilder ? fetchBuilder(tracker) : makeFetch(tracker);
  const mockWin = {
    __MAKER_RELEASE__: VALID_SEMVER,
    __QR_CHECK_RELEASE__: qrRelease || makeValidQrRelease(),
    __MAKER_RUNTIME_FILES__: runtimeFiles || makeValidRuntimeFiles(),
    fetch: fetchFn,
    google: makeGis(tracker),
    dispatchEvent() {},
    CustomEvent: function CustomEvent() {},
  };
  context.window = mockWin;
  context.document = doc;
  context.__bootFn = bootMaker;
  vm.runInContext('__bootFn();', context);
  elements.get('school-name').value = 'OO초등학교';
  elements.get('school-admin-email').value = OWNER_EMAIL;
  elements.get('admin-email').value = OWNER_EMAIL;
  elements.get('account-email').value = OWNER_EMAIL;
  elements.get('maker-release').value = '';
  await clickAndSettle(elements.get('connect-btn'));
  return { elements, tracker, mockWin };
}

const hasVmModules = typeof vm.SourceTextModule === 'function';

if (!hasVmModules) {
  describe('maker release gate (wraps with --experimental-vm-modules)', () => {
    it('reruns itself once with flag and passes', () => {
      const self = fileURLToPath(import.meta.url);
      const r = spawnSync(process.execPath, ['--experimental-vm-modules', '--test', self], { encoding: 'utf8', timeout: 120000 });
      const out = String(r.stdout || '') + '\n' + String(r.stderr || '');
      assert.equal(r.status, 0, `flagged rerun failed:\n${out.slice(-4000)}`);
      assert.match(String(r.stdout || ''), /pass/i, `flagged rerun produced no pass output:\n${out.slice(-4000)}`);
    });
  });
} else {
  describe('maker release gate (real bootMaker via vm, synthetic fixtures only)', () => {
    it('positive control: valid published fixture reaches account read and exactly one Drive files POST', async () => {
      const { tracker } = await bootAndClickConnectThenCreate({
        domReleaseValue: '',
        winRelease: VALID_SEMVER,
        qrRelease: makeValidQrRelease(),
        runtimeFiles: makeValidRuntimeFiles(),
      });
      assert.equal(tracker.gisInitCalls, 1, `valid fixture should OAuth once at connect, got ${tracker.gisInitCalls}`);
      assert.equal(tracker.gisRequestCalls, 1, `valid fixture should request token once, got ${tracker.gisRequestCalls}`);
      assert.equal(tracker.lastClientId, TEST_CLIENT_ID, 'vm client id was not injected');
      assert.ok(tracker.fetchUrls.some((u) => u.includes('/drive/v3/about')), `valid fixture should read account, got ${tracker.fetchUrls.join(';')}`);
      const writes = resourceWrites(tracker);
      assert.equal(writes.length, 1, `valid fixture should attempt exactly one resource POST, got ${writes.join(';')}`);
      assert.ok(writes[0].startsWith('POST https://www.googleapis.com/drive/v3/files'), `first resource URL must be www.googleapis.com/drive/v3/files, got ${writes[0]}`);
      assert.equal(tracker.firstWriteUrl, writes[0]);
    });

    it('unpublished/manual release with nonempty runtime must block before OAuth and fetch', async () => {
      const { tracker, elements } = await bootAndClickConnectThenCreate({
        domReleaseValue: 'manual-test-string',
        winRelease: '',
        qrRelease: null,
        runtimeFiles: makeValidRuntimeFiles(),
      });
      assert.equal(tracker.gisInitCalls, 0, `gate defect: unpublished/manual must block before OAuth but gis=${tracker.gisInitCalls}`);
      assert.equal(tracker.fetchCalls, 0, `gate defect: unpublished/manual must block before fetch but fetch=${tracker.fetchCalls} urls=${tracker.fetchUrls.join(';')}`);
      assert.equal(resourceWrites(tracker).length, 0);
      assert.equal(elements.get('resume-info').textContent || '', '', 'gate defect: blocked fixture must leave no installation snapshot');
    });

    it('published malformed semver/hash/date and release mismatch must block (table)', async () => {
      const cases = [
        { name: 'bad semver', mutate: (m) => { m.app_version = 'not-semver'; }, release: 'not-semver' },
        { name: 'bad semver short', mutate: (m) => { m.app_version = '1'; }, release: '1' },
        { name: 'bad prerelease leading zero', mutate: (m) => { m.app_version = '1.2.3-01'; }, release: '1.2.3-01' },
        { name: 'bad prerelease empty identifiers', mutate: (m) => { m.app_version = '1.2.3-..'; }, release: '1.2.3-..' },
        { name: 'bad hash short', mutate: (m) => { m.source_commit = 'abc'; }, release: VALID_SEMVER },
        { name: 'bad hash unknown', mutate: (m) => { m.source_commit = 'unknown'; }, release: VALID_SEMVER },
        { name: 'bad date', mutate: (m) => { m.built_at = 'not-a-date'; }, release: VALID_SEMVER },
        { name: 'bad date Feb30', mutate: (m) => { m.built_at = '2026-02-30T00:00:00.000Z'; }, release: VALID_SEMVER },
        { name: 'mismatch release vs manifest', mutate: (m) => { m.app_version = '0.1.0'; }, release: '0.2.0' },
      ];
      for (const c of cases) {
        const qr = makeValidQrRelease();
        c.mutate(qr);
        const { tracker, elements } = await bootAndClickConnectThenCreate({
          domReleaseValue: '',
          winRelease: c.release,
          qrRelease: qr,
          runtimeFiles: makeValidRuntimeFiles(),
        });
        assert.equal(tracker.gisInitCalls, 0, `gate defect [${c.name}]: must block before OAuth but gis=${tracker.gisInitCalls}`);
        assert.equal(tracker.fetchCalls, 0, `gate defect [${c.name}]: must block before fetch but fetch=${tracker.fetchCalls}`);
        assert.equal(elements.get('resume-info').textContent || '', '', `gate defect [${c.name}]: must leave no snapshot`);
      }
    });

    it('runtime count/duplicate/missing/manifest must block (table)', async () => {
      {
        const { tracker, elements } = await bootAndClickConnectThenCreate({
          domReleaseValue: '',
          winRelease: VALID_SEMVER,
          qrRelease: makeValidQrRelease(),
          runtimeFiles: [],
        });
        assert.equal(resourceWrites(tracker).length, 0, 'zero files must never write');
        assert.equal(tracker.gisInitCalls, 0, `gate defect [zero files]: must block before OAuth but gis=${tracker.gisInitCalls}`);
        assert.equal(tracker.fetchCalls, 0, `gate defect [zero files]: must block before fetch but fetch=${tracker.fetchCalls} urls=${tracker.fetchUrls.join(';')}`);
        assert.equal(elements.get('resume-info').textContent || '', '', 'gate defect [zero files]: must leave no snapshot');
        assert.ok((elements.get('maker-status').textContent || '').includes('게시된 실행 파일이 없어'), 'zero files should show blocked-no-runtime state');
      }
      const valid = () => makeValidRuntimeFiles();
      const wrongAccess = JSON.stringify({
        timeZone: 'Asia/Seoul',
        runtimeVersion: 'V8',
        oauthScopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        webapp: { executeAs: 'USER_DEPLOYING', access: 'MYSELF' },
        exceptionLogging: 'STACKDRIVER',
      });
      const cases = [
        { name: 'mismatch count 5 with all18 retained', files: valid(), qrMutate: (qr) => { qr.runtime_file_count = 5; } },
        { name: 'extra file beyond required', files: (() => { const f = valid(); f.push({ name: '../evil.gs', source: '// synthetic extra\n' }); return f; })(), qrMutate: (qr) => { qr.runtime_file_count = 19; } },
        { name: 'duplicate filenames', files: (() => { const f = valid(); f[1] = { ...f[0] }; return f; })() },
        { name: 'missing appsscript.json', files: valid().filter((f) => f.name !== 'appsscript.json') },
        { name: 'missing Code.gs', files: valid().filter((f) => f.name !== 'Code.gs') },
        { name: 'appsscript.json invalid JSON', files: valid().map((f) => (f.name === 'appsscript.json' ? { name: f.name, source: '{not json' } : f)) },
        { name: 'appsscript.json wrong webapp access', files: valid().map((f) => (f.name === 'appsscript.json' ? { name: f.name, source: wrongAccess } : f)) },
      ];
      for (const c of cases) {
        const qr = makeValidQrRelease();
        if (c.qrMutate) c.qrMutate(qr);
        const { tracker, elements } = await bootAndClickConnectThenCreate({
          domReleaseValue: '',
          winRelease: VALID_SEMVER,
          qrRelease: qr,
          runtimeFiles: c.files,
        });
        assert.equal(tracker.gisInitCalls, 0, `gate defect [${c.name}]: must block before OAuth but gis=${tracker.gisInitCalls}`);
        assert.equal(tracker.fetchCalls, 0, `gate defect [${c.name}]: must block before fetch but fetch=${tracker.fetchCalls} urls=${tracker.fetchUrls.join(';')}`);
        assert.equal(elements.get('resume-info').textContent || '', '', `gate defect [${c.name}]: must leave no snapshot`);
      }
    });

    it('empty release must block before OAuth/fetch with no snapshot', async () => {
      const { tracker, elements } = await bootAndClickConnectThenCreate({
        domReleaseValue: '',
        winRelease: '',
        qrRelease: null,
        runtimeFiles: makeValidRuntimeFiles(),
      });
      assert.equal(tracker.gisInitCalls, 0, `gate defect: empty release must block before OAuth but gis=${tracker.gisInitCalls}`);
      assert.equal(tracker.fetchCalls, 0, `gate defect: empty release must block before fetch but fetch=${tracker.fetchCalls}`);
      assert.equal(elements.get('resume-info').textContent || '', '', 'gate defect: empty release must leave no snapshot');
    });

    it('unpublished status despite valid metadata must block before OAuth/fetch', async () => {
      const qr = makeValidQrRelease();
      qr.status = 'unpublished';
      const { tracker, elements } = await bootAndClickConnectThenCreate({
        domReleaseValue: '',
        winRelease: VALID_SEMVER,
        qrRelease: qr,
        runtimeFiles: makeValidRuntimeFiles(),
      });
      assert.equal(tracker.gisInitCalls, 0, `gate defect [unpublished]: must block before OAuth but gis=${tracker.gisInitCalls}`);
      assert.equal(tracker.fetchCalls, 0, `gate defect [unpublished]: must block before fetch but fetch=${tracker.fetchCalls}`);
      assert.equal(elements.get('resume-info').textContent || '', '', 'gate defect [unpublished]: must leave no snapshot');
    });

    it('dom override with valid manifest must not change install release', async () => {
      const { tracker, elements } = await bootAndClickConnectThenCreate({
        domReleaseValue: '9.9.9-manual',
        winRelease: VALID_SEMVER,
        qrRelease: makeValidQrRelease(),
        runtimeFiles: makeValidRuntimeFiles(),
      });
      assert.equal(tracker.gisInitCalls, 1, `valid manifest must ignore DOM override and OAuth once, got ${tracker.gisInitCalls}`);
      const snapText = elements.get('resume-info').textContent || '';
      assert.ok(snapText.includes(VALID_SEMVER), `snapshot must retain install release 0.1.0, got ${snapText.slice(0, 500)}`);
      assert.ok(!snapText.includes('9.9.9-manual'), `DOM override must not change install release, got ${snapText.slice(0, 500)}`);
    });

    it('pilot latch: pending GIS callback allows exactly one init, zero fetch, disabled buttons; resolve unblocks', async () => {
      const { context, bootMaker } = await loadBootMaker();
      const { doc, elements } = makeDom();
      const tracker = makeTracker();
      const pendingCallbacks = [];
      let holdInitCalls = 0;
      let holdRequestCalls = 0;
      let capturedScope = '';
      const holdingGis = {
        accounts: {
          oauth2: {
            initTokenClient(opts) {
              holdInitCalls += 1;
              tracker.gisInitCalls += 1;
              capturedScope = opts && opts.scope ? String(opts.scope) : '';
              pendingCallbacks.push(opts.callback);
              return {
                requestAccessToken() {
                  holdRequestCalls += 1;
                  tracker.gisRequestCalls += 1;
                },
              };
            },
            revoke() {},
          },
        },
      };
      const mockWin = {
        __MAKER_RELEASE__: VALID_SEMVER,
        __QR_CHECK_RELEASE__: makeValidQrRelease(),
        __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
        fetch: makeFetch(tracker),
        google: holdingGis,
        dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
      };
      context.window = mockWin;
      context.document = doc;
      context.__bootFn = bootMaker;
      vm.runInContext('__bootFn();', context);
      elements.get('school-name').value = 'OO초등학교';
      elements.get('school-admin-email').value = OWNER_EMAIL;
      elements.get('admin-email').value = OWNER_EMAIL;
      elements.get('account-email').value = OWNER_EMAIL;
      elements.get('maker-release').value = '';
      await clickAndSettle(elements.get('connect-btn'));
      assert.equal(holdInitCalls, 1, `pending latch must init once, got ${holdInitCalls}`);
      assert.equal(tracker.fetchCalls, 0, `pending latch must have zero fetch, got ${tracker.fetchUrls.join(';')}`);
      assert.equal(elements.get('connect-btn').disabled, true, 'connect must be disabled while pending');
      assert.equal(elements.get('create-btn').disabled, true, 'create must be disabled while pending');
      assert.equal(elements.get('verify-btn').disabled, true, 'verify must be disabled while pending');
      assert.equal(elements.get('complete-btn').disabled, true, 'complete must be disabled while pending');
      assert.equal(elements.get('retry-btn').disabled, true, 'retry must be disabled while pending');
      assert.equal(elements.get('school-name').disabled, true, 'school-name input must be disabled while busy');
      assert.equal(elements.get('school-admin-email').disabled, true, 'school-admin-email input must be disabled while busy');
      assert.equal(elements.get('account-email').disabled, true, 'account-email input must be disabled while busy');
      await clickAndSettle(elements.get('connect-btn'));
      await clickAndSettle(elements.get('create-btn'));
      await clickAndSettle(elements.get('retry-btn'));
      assert.equal(holdInitCalls, 1, `concurrent clicks while pending must not re-init, got ${holdInitCalls}`);
      assert.equal(tracker.fetchCalls, 0, `concurrent clicks while pending must keep zero fetch, got ${tracker.fetchUrls.join(';')}`);
      assert.ok(pendingCallbacks.length >= 1, 'holding GIS must have pending callback');
      assert.ok(capturedScope.length > 0, `fixture must capture full grant scope, got '${capturedScope}'`);
      for (const cb of pendingCallbacks) cb({ access_token: 'synthetic-token-abc', expires_in: 3600, scope: capturedScope });
      for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r));
      assert.ok(tracker.fetchUrls.some((u) => u.includes('/drive/v3/about')), `real account GET must occur after grant resolution, got ${tracker.fetchUrls.join(';')}`);
      const beforeResolve = holdInitCalls;
      await clickAndSettle(elements.get('connect-btn'));
      assert.equal(holdInitCalls, beforeResolve + 1, 'after resolve, later connect must be allowed (no permanent busy lock)');
    });

    it('pilot mutation latch: concurrent create/retry while POST pending issues exactly one POST; 403 allows exactly one retry', async () => {
      const { context, bootMaker } = await loadBootMaker();
      const { doc, elements } = makeDom();
      const tracker = makeTracker();
      const baseFetch = makeFetch(tracker);
      const pendingPosts = [];
      let allowImmediate403 = false;
      let postCount = 0;
      const holdingFetch = async (url, opts = {}) => {
        const method = String(opts.method || 'GET').toUpperCase();
        const u = String(url);
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          postCount += 1;
          tracker.fetchCalls += 1;
          tracker.fetchUrls.push(`${method} ${u}`);
          tracker.writeCount += 1;
          if (!tracker.firstWriteUrl) tracker.firstWriteUrl = `${method} ${u}`;
          if (allowImmediate403) return forbiddenResponse();
          return new Promise((resolve) => { pendingPosts.push(() => resolve(forbiddenResponse())); });
        }
        return baseFetch(url, opts);
      };
      const mockWin = {
        __MAKER_RELEASE__: VALID_SEMVER,
        __QR_CHECK_RELEASE__: makeValidQrRelease(),
        __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
        fetch: holdingFetch,
        google: makeGis(tracker),
        dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
      };
      context.window = mockWin;
      context.document = doc;
      context.__bootFn = bootMaker;
      vm.runInContext('__bootFn();', context);
      elements.get('school-name').value = 'OO초등학교';
      elements.get('school-admin-email').value = OWNER_EMAIL;
      elements.get('admin-email').value = OWNER_EMAIL;
      elements.get('account-email').value = OWNER_EMAIL;
      elements.get('maker-release').value = '';
      await clickAndSettle(elements.get('connect-btn'));
      assert.ok(tracker.fetchUrls.some((u) => u.includes('/drive/v3/about')), 'connect must read verified account');
      assert.equal(postCount, 0, 'connect must not mutate');
      await clickAndSettle(elements.get('create-btn'));
      await clickAndSettle(elements.get('create-btn'));
      await clickAndSettle(elements.get('retry-btn'));
      assert.equal(postCount, 1, `concurrent create/retry while POST pending must issue exactly one POST, got ${postCount} urls=${tracker.fetchUrls.join(';')}`);
      for (const r of pendingPosts) r();
      pendingPosts.length = 0;
      allowImmediate403 = true;
      for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r));
      const snapAfter403 = elements.get('resume-info').textContent || '';
      assert.ok(!snapAfter403.includes('COMPLETE'), '403 failure must not advance to COMPLETE');
      assert.equal(postCount, 1, `first round must be exactly one POST, got ${postCount}`);
      await clickAndSettle(elements.get('create-btn'));
      assert.equal(postCount, 2, `after known 403, retry must be allowed exactly once, got extra ${postCount - 1}`);
    });

    it('pilot ambiguous latch: HTTP500 at creation marks uncertain pending and blocks further mutations', async () => {
      const { context, bootMaker } = await loadBootMaker();
      const { doc, elements } = makeDom();
      const tracker = makeTracker();
      const baseFetch = makeFetch(tracker);
      let postTotal = 0;
      const failingFetch = async (url, opts = {}) => {
        const method = String(opts.method || 'GET').toUpperCase();
        const u = String(url);
        if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && u.includes('googleapis.com')) {
          postTotal += 1;
          tracker.fetchCalls += 1;
          const entry = `${method} ${u}`;
          tracker.fetchUrls.push(entry);
          tracker.writeCount += 1;
          if (!tracker.firstWriteUrl) tracker.firstWriteUrl = entry;
          return { ok: false, status: 500, text: async () => JSON.stringify({ error: { code: 500, message: 'synthetic-stop-500' } }) };
        }
        return baseFetch(url, opts);
      };
      const mockWin = {
        __MAKER_RELEASE__: VALID_SEMVER,
        __QR_CHECK_RELEASE__: makeValidQrRelease(),
        __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
        fetch: failingFetch,
        google: makeGis(tracker),
        dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
      };
      context.window = mockWin;
      context.document = doc;
      context.__bootFn = bootMaker;
      vm.runInContext('__bootFn();', context);
      elements.get('school-name').value = 'OO초등학교';
      elements.get('school-admin-email').value = OWNER_EMAIL;
      elements.get('admin-email').value = OWNER_EMAIL;
      elements.get('account-email').value = OWNER_EMAIL;
      elements.get('maker-release').value = '';
      await clickAndSettle(elements.get('connect-btn'));
      await clickAndSettle(elements.get('create-btn'));
      for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r));
      assert.equal(postTotal, 1, `first creation must issue exactly one mutation before unknown latch, got ${postTotal}`);
      const snap = elements.get('resume-info').textContent || '';
      assert.ok(snap.includes('operation_pending'), `500 must leave safe pending marker, got ${snap.slice(0, 800)}`);
      assert.ok(!snap.includes('COMPLETE'), 'uncertain operation must not claim complete');
      await clickAndSettle(elements.get('create-btn'));
      await clickAndSettle(elements.get('retry-btn'));
      await clickAndSettle(elements.get('connect-btn'));
      for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
      assert.equal(postTotal, 1, `after OUTCOME_UNKNOWN, further create/retry/connect must not issue another mutation, got extra ${postTotal - 1}`);
    });

    it('owner-only pilot: verified OWNER with different school-admin blocks mutation with readable mismatch', async () => {
      const { context, bootMaker } = await loadBootMaker();
      const { doc, elements } = makeDom();
      const tracker = makeTracker();
      const mockWin = {
        __MAKER_RELEASE__: VALID_SEMVER,
        __QR_CHECK_RELEASE__: makeValidQrRelease(),
        __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
        fetch: makeFetch(tracker),
        google: makeGis(tracker),
        dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
      };
      context.window = mockWin;
      context.document = doc;
      context.__bootFn = bootMaker;
      vm.runInContext('__bootFn();', context);
      elements.get('school-name').value = 'OO초등학교';
      elements.get('school-admin-email').value = 'admin@school.kr';
      elements.get('admin-email').value = 'admin@school.kr';
      elements.get('account-email').value = OWNER_EMAIL;
      elements.get('maker-release').value = '';
      await clickAndSettle(elements.get('connect-btn'));
      assert.ok(tracker.fetchUrls.some((u) => u.includes('/drive/v3/about')), 'must verify actual API identity before decision');
      await clickAndSettle(elements.get('create-btn'));
      const writes = tracker.fetchUrls.filter((u) => u.startsWith('POST ') || u.startsWith('PUT ') || u.startsWith('PATCH '));
      assert.equal(writes.length, 0, `owner mismatch must cause zero mutations, got ${writes.join(';')}`);
      const status = (elements.get('maker-status').textContent || '') + '\n' + (elements.get('permission-status').textContent || '');
      assert.ok(/다릅니다|관리자|mismatch|일치/i.test(status), `mismatch must be readable, got ${status.slice(0, 500)}`);
    });
  });

  describe('maker resume import (real boot + real resume parser, synthetic only)', () => {
    it('resume requires published release and GIS before any fetch', async () => {
      {
        const { context, bootMaker } = await loadBootMaker();
        const { doc, elements } = makeDom();
        const tracker = makeTracker();
        const mockWin = {
          __MAKER_RELEASE__: '',
          __QR_CHECK_RELEASE__: null,
          __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
          fetch: makeFetch(tracker),
          google: makeGis(tracker),
          dispatchEvent() {},
          CustomEvent: function CustomEvent() {},
        };
        context.window = mockWin;
        context.document = doc;
        context.__bootFn = bootMaker;
        vm.runInContext('__bootFn();', context);
        elements.get('resume-input').value = JSON.stringify(makeApiReadyEnvelope());
        await clickAndSettle(elements.get('resume-btn'));
        assert.equal(tracker.gisInitCalls, 0, 'invalid release must block resume before OAuth');
        assert.equal(tracker.fetchCalls, 0, 'invalid release must block resume before fetch');
        assert.equal(elements.get('resume-info').textContent || '', '', 'invalid release must leave no snapshot');
      }
      {
        const { context, bootMaker } = await loadBootMaker();
        const { doc, elements } = makeDom();
        const tracker = makeTracker();
        const mockWin = {
          __MAKER_RELEASE__: VALID_SEMVER,
          __QR_CHECK_RELEASE__: makeValidQrRelease(),
          __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
          fetch: makeFetch(tracker),
          google: undefined,
          dispatchEvent() {},
          CustomEvent: function CustomEvent() {},
        };
        context.window = mockWin;
        context.document = doc;
        context.__bootFn = bootMaker;
        vm.runInContext('__bootFn();', context);
        elements.get('resume-input').value = JSON.stringify(makeApiReadyEnvelope());
        await clickAndSettle(elements.get('resume-btn'));
        assert.equal(tracker.fetchCalls, 0, 'missing GIS must block resume before fetch');
        assert.equal(elements.get('resume-info').textContent || '', '', 'missing GIS must leave no snapshot');
      }
    });

    it('resume requires connect first (no restore, no writes, Korean guidance)', async () => {
      const { context, bootMaker } = await loadBootMaker();
      const { doc, elements } = makeDom();
      const tracker = makeTracker();
      const folderName = RESUME_PREFIX_API + 'QR보안점검표';
      const fetchFn = makeVerifyFetch(tracker, {
        metas: { [RESUME_FOLDER_API]: { id: RESUME_FOLDER_API, name: folderName, mimeType: 'application/vnd.google-apps.folder', ownedByMe: true, trashed: false } },
      });
      const mockWin = {
        __MAKER_RELEASE__: VALID_SEMVER,
        __QR_CHECK_RELEASE__: makeValidQrRelease(),
        __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
        fetch: fetchFn,
        google: makeGis(tracker),
        dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
      };
      context.window = mockWin;
      context.document = doc;
      context.__bootFn = bootMaker;
      vm.runInContext('__bootFn();', context);
      elements.get('resume-input').value = JSON.stringify(makeApiReadyEnvelope());
      await clickAndSettle(elements.get('resume-btn'));
      assert.equal(resourceWrites(tracker).length, 0, 'resume without connect must not write');
      assert.equal(elements.get('resume-info').textContent || '', '', 'resume without connect must not create snapshot');
      const status = (elements.get('maker-status').textContent || '') + '\n' + (elements.get('permission-status').textContent || '');
      assert.ok(/이어하기/.test(status), `connect-first must guide in Korean with 이어하기, got ${status.slice(0, 500)}`);
      assertNoSecretsInSnapshot(status);
    });

    it('resume restores API_ACCESS_READY envelope with matching Drive metadata and no writes', async () => {
      const envelope = makeApiReadyEnvelope();
      const folderName = RESUME_PREFIX_API + 'QR보안점검표';
      const { elements, tracker, mockWin } = await bootConnectedForResume({
        fetchBuilder: (t) => makeVerifyFetch(t, {
          metas: { [RESUME_FOLDER_API]: { id: RESUME_FOLDER_API, name: folderName, mimeType: 'application/vnd.google-apps.folder', ownedByMe: true, trashed: false } },
        }),
      });
      assert.ok(!('localStorage' in mockWin) || mockWin.localStorage == null, 'no auto storage');
      const before = elements.get('resume-info').textContent || '';
      assert.ok(before.length > 0, 'connect must leave DRAFT snapshot');
      elements.get('resume-input').value = JSON.stringify(envelope);
      await clickAndSettle(elements.get('resume-btn'));
      assert.equal(resourceWrites(tracker).length, 0, `restore must be read-only, got ${tracker.fetchUrls.join(';')}`);
      assert.ok(tracker.fetchUrls.some((u) => u.includes(RESUME_FOLDER_API)), `restore must read actual Drive metadata, got ${tracker.fetchUrls.join(';')}`);
      const after = elements.get('resume-info').textContent || '';
      assertNoSecretsInSnapshot(after);
      const parsed = parseResumeInfoJson(after);
      assert.equal(parsed.install_id, envelope.install_id, 'restored install_id must match envelope');
      assert.equal(parsed.state, envelope.state, 'API_ACCESS_READY must restore same state');
      assert.deepEqual(parsed.resources, envelope.resources, 'restored resources must match envelope');
      const status = elements.get('maker-status').textContent || '';
      assert.ok(/이어하기|복원|가져오/.test(status), `restore success must show Korean guidance, got ${status.slice(0, 500)}`);
    });

    it('resume mismatches preserve DRAFT snapshot with no writes and safe Korean status', async () => {
      const folderName = RESUME_PREFIX_API + 'QR보안점검표';
      const validMeta = { id: RESUME_FOLDER_API, name: folderName, mimeType: 'application/vnd.google-apps.folder', ownedByMe: true, trashed: false };
      const cases = [
        { name: 'ownership mismatch', metas: { [RESUME_FOLDER_API]: { ...validMeta, ownedByMe: false } }, mutate: null },
        { name: 'metadata error', metas: {}, failSubstrings: [RESUME_FOLDER_API], mutate: null },
        { name: 'pending envelope', metas: { [RESUME_FOLDER_API]: validMeta }, mutate: (e) => { e.resources = { ...e.resources, operation_pending: 'synthetic-pending-op' }; } },
        { name: 'foreign account', metas: { [RESUME_FOLDER_API]: validMeta }, mutate: (e) => { e.account_email = 'other@school.kr'; } },
      ];
      for (const c of cases) {
        const { elements, tracker } = await bootConnectedForResume({
          fetchBuilder: (t) => makeVerifyFetch(t, { metas: c.metas || {}, failSubstrings: c.failSubstrings || [] }),
        });
        const draftSnap = elements.get('resume-info').textContent || '';
        assert.ok(draftSnap.length > 0, `[${c.name}] connect must leave DRAFT snapshot`);
        const env = makeApiReadyEnvelope();
        if (c.mutate) c.mutate(env);
        elements.get('resume-input').value = JSON.stringify(env);
        await clickAndSettle(elements.get('resume-btn'));
        assert.equal(resourceWrites(tracker).length, 0, `[${c.name}] mismatch must cause zero writes, got ${tracker.fetchUrls.join(';')}`);
        assert.equal(elements.get('resume-info').textContent || '', draftSnap, `[${c.name}] mismatch must preserve previous DRAFT snapshot`);
        const status = (elements.get('maker-status').textContent || '') + '\n' + (elements.get('permission-status').textContent || '');
        assert.ok(/이어하기|복원/.test(status), `[${c.name}] must show safe Korean resume guidance, got ${status.slice(0, 500)}`);
        assertNoSecretsInSnapshot(status + '\n' + (elements.get('resume-info').textContent || ''));
        assert.ok(!/access_token|refresh_token/i.test(status), `[${c.name}] status must not leak credentials`);
      }
    });

    it('restored COMPLETE resets to AWAITING_SCHOOL_AUTH and complete stays disabled', async () => {
      const runtimeFiles = makeValidRuntimeFiles();
      const gasFiles = toGasExpected(runtimeFiles);
      const folderName = RESUME_PREFIX_COMP + 'QR보안점검표';
      const sheetName = RESUME_PREFIX_COMP + '점검기록';
      const scriptName = RESUME_PREFIX_COMP + 'QR보안점검표-앱';
      const envelope = makeCompleteEnvelope();
      const { elements, tracker } = await bootConnectedForResume({
        runtimeFiles,
        fetchBuilder: (t) => makeVerifyFetch(t, {
          metas: {
            [RESUME_FOLDER_COMP]: { id: RESUME_FOLDER_COMP, name: folderName, mimeType: 'application/vnd.google-apps.folder', ownedByMe: true, trashed: false },
            [RESUME_SHEET_COMP]: { id: RESUME_SHEET_COMP, name: sheetName, mimeType: 'application/vnd.google-apps.spreadsheet', ownedByMe: true, trashed: false, parents: [RESUME_FOLDER_COMP] },
            [RESUME_SCRIPT_COMP]: { id: RESUME_SCRIPT_COMP, name: scriptName, mimeType: 'application/vnd.google-apps.script', ownedByMe: true, trashed: false },
          },
          heads: { [RESUME_SCRIPT_COMP]: { scriptId: RESUME_SCRIPT_COMP, files: gasFiles } },
          versions: { [`${RESUME_SCRIPT_COMP}:${RESUME_VERSION_COMP}`]: { scriptId: RESUME_SCRIPT_COMP, files: gasFiles } },
          deploys: { [`${RESUME_SCRIPT_COMP}:${RESUME_DEPLOY_COMP}`]: { deploymentId: RESUME_DEPLOY_COMP, deploymentConfig: { scriptId: RESUME_SCRIPT_COMP, versionNumber: Number(RESUME_VERSION_COMP), manifestFileName: 'appsscript' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: RESUME_WEBAPP_COMP } }] } },
        }),
      });
      elements.get('resume-input').value = JSON.stringify(envelope);
      await clickAndSettle(elements.get('resume-btn'));
      assert.equal(resourceWrites(tracker).length, 0, 'COMPLETE restore must be read-only');
      const after = elements.get('resume-info').textContent || '';
      const parsed = parseResumeInfoJson(after);
      assert.equal(parsed.install_id, envelope.install_id, 'COMPLETE restore must keep install_id');
      assert.deepEqual(parsed.resources, envelope.resources, 'COMPLETE restore must keep resources');
      assert.equal(parsed.state, 'AWAITING_SCHOOL_AUTH', `COMPLETE must reset to AWAITING_SCHOOL_AUTH, got ${parsed.state}`);
      assertNoSecretsInSnapshot(after);
      assert.equal(elements.get('complete-btn').disabled, true, 'complete must stay disabled until fresh verification');
      const status = elements.get('maker-status').textContent || '';
      assert.ok(/이어하기|초기 설정|연결 검사/.test(status), `COMPLETE reset must guide fresh verification in Korean, got ${status.slice(0, 500)}`);
      await clickAndSettle(elements.get('complete-btn'));
      assert.equal(elements.get('complete-btn').disabled, true, 'complete must remain disabled without fresh verification');
    });

    it('resume busy latch: double click while reads pending issues single metadata read', async () => {
      const { context, bootMaker } = await loadBootMaker();
      const { doc, elements } = makeDom();
      const tracker = makeTracker();
      const base = makeFetch(tracker);
      let metaCalls = 0;
      const hangingFetch = async (url, opts = {}) => {
        const method = String(opts.method || 'GET').toUpperCase();
        const u = String(url);
        if (method === 'GET' && u.includes(RESUME_FOLDER_API)) {
          metaCalls += 1;
          tracker.fetchCalls += 1;
          tracker.fetchUrls.push(`${method} ${u}`);
          return new Promise(() => {});
        }
        return base(url, opts);
      };
      const folderName = RESUME_PREFIX_API + 'QR보안점검표';
      void folderName;
      const mockWin = {
        __MAKER_RELEASE__: VALID_SEMVER,
        __QR_CHECK_RELEASE__: makeValidQrRelease(),
        __MAKER_RUNTIME_FILES__: makeValidRuntimeFiles(),
        fetch: hangingFetch,
        google: makeGis(tracker),
        dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
      };
      context.window = mockWin;
      context.document = doc;
      context.__bootFn = bootMaker;
      vm.runInContext('__bootFn();', context);
      elements.get('school-name').value = 'OO초등학교';
      elements.get('school-admin-email').value = OWNER_EMAIL;
      elements.get('admin-email').value = OWNER_EMAIL;
      elements.get('account-email').value = OWNER_EMAIL;
      elements.get('maker-release').value = '';
      await clickAndSettle(elements.get('connect-btn'));
      elements.get('resume-input').value = JSON.stringify(makeApiReadyEnvelope());
      const btn = elements.get('resume-btn');
      const handlers = [...(btn._clickHandlers || [])];
      assert.ok(handlers.length > 0, 'resume-btn must be wired for manual validate/import');
      for (const h of handlers) { try { h({ preventDefault() {} }); } catch {} }
      for (const h of handlers) { try { h({ preventDefault() {} }); } catch {} }
      for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
      assert.equal(metaCalls, 1, `concurrent resume clicks must latch to single metadata read, got ${metaCalls}`);
      assert.equal(resourceWrites(tracker).length, 0, 'latched resume must not write');
    });
  });
}

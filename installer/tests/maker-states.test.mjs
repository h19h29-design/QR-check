import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makerAvailability,
  completionAvailability,
  safeResumeSnapshot,
  humanError,
  hasRequiredInstallInput,
  missingInstallInputMessage,
  resolveVerifiedEmail,
  isGisAvailable,
  releaseNoteText,
  retryTargetForState,
  displayStageForState,
  BLOCKED_NO_CLIENT_ID,
  BLOCKED_NO_RUNTIME,
  BLOCKED_GIS_UNAVAILABLE,
} from '../maker/maker.js';
import {
  createInstall,
  advance,
  resumeInfo,
  canComplete,
  STATES,
} from '../src/install/state-machine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, '../maker/index.html');
const jsPath = path.join(here, '../maker/maker.js');
const html = readFileSync(htmlPath, 'utf8');
const js = readFileSync(jsPath, 'utf8');

const BLOCKED_COPY = '설치센터 Google 연결 정보가 준비되지 않았습니다';
const FORBIDDEN_KEYS = [
  'access_token',
  'refresh_token',
  'id_token',
  'admin_token',
  'sync_key',
  'submit_token',
  'setup_key',
  'secret',
];
const GIS_URL = 'https://accounts.google.com/gsi/client';

function makeInstall() {
  return createInstall({
    installId: 'install-test-1',
    accountEmail: 'school-account@school.kr',
    release: 'maker-1',
  });
}

function toVerified() {
  const install = makeInstall();
  const pathToVerified = [
    'OAUTH_READY',
    'API_ACCESS_READY',
    'STORAGE_CREATED',
    'SCRIPT_CREATED',
    'CODE_UPLOADED',
    'DEPLOYED',
    'AWAITING_SCHOOL_AUTH',
    'VERIFIED',
  ];
  for (const s of pathToVerified) advance(install, s, {});
  return install;
}

describe('makerAvailability gating', () => {
  it('empty client id is blocked with exact copy and all actions false', () => {
    const a = makerAvailability('', true);
    assert.equal(a.blocked, true);
    assert.equal(a.status, BLOCKED_COPY);
    assert.equal(a.status, BLOCKED_NO_CLIENT_ID);
    assert.equal(a.reason, 'NO_CLIENT_ID');
    assert.equal(a.canConnect, false);
    assert.equal(a.canCreate, false);
    assert.equal(a.canVerify, false);
    assert.equal(a.canComplete, false);
  });

  it('client id present but GIS missing is blocked', () => {
    for (const gis of [false, undefined, null, 0, '']) {
      const a = makerAvailability('client-123', gis);
      assert.equal(a.blocked, true);
      assert.equal(a.reason, 'GIS_UNAVAILABLE');
      assert.equal(a.canConnect, false);
      assert.equal(a.canCreate, false);
      assert.equal(a.canVerify, false);
      assert.equal(a.canComplete, false);
    }
    assert.equal(BLOCKED_GIS_UNAVAILABLE.length > 0, true);
  });

  it('both present is ready', () => {
    const a = makerAvailability('client-123', true);
    assert.equal(a.blocked, false);
    assert.equal(a.reason, 'READY');
    assert.equal(a.canConnect, true);
    assert.equal(a.canCreate, true);
    assert.equal(a.canVerify, true);
    assert.equal(a.canComplete, false);
  });
});

describe('completionAvailability + VERIFIED -> COMPLETE', () => {
  it('disabled before VERIFIED', () => {
    const draft = makeInstall();
    assert.equal(completionAvailability(draft).enabled, false);
    assert.equal(canComplete(draft), false);
    const mid = makeInstall();
    advance(mid, 'OAUTH_READY', {});
    assert.equal(completionAvailability(mid).enabled, false);
  });

  it('enabled only for a VERIFIED install and can advance to COMPLETE', () => {
    const install = toVerified();
    assert.equal(install.state, 'VERIFIED');
    assert.equal(canComplete(install), true);
    const c = completionAvailability(install);
    assert.equal(c.enabled, true);
    advance(install, 'COMPLETE', {});
    assert.equal(install.state, 'COMPLETE');
    assert.equal(STATES.includes('COMPLETE'), true);
    assert.equal(completionAvailability(install).enabled, false);
  });
});

describe('safeResumeSnapshot', () => {
  it('contains only safe structure and never forbidden keys', () => {
    const install = makeInstall();
    advance(install, 'OAUTH_READY', {});
    const r = safeResumeSnapshot(install);
    assert.equal(r.ok, true);
    const snap = r.snapshot;
    const allowed = new Set(['install_id', 'account_email', 'release', 'state', 'resources']);
    for (const k of Object.keys(snap)) assert.ok(allowed.has(k), `unexpected key ${k}`);
    assert.equal(snap.install_id, install.install_id);
    assert.equal(snap.release, install.release);
    assert.equal(snap.state, install.state);
    assert.deepEqual(snap.resources, install.resources ?? {});
    const blob = JSON.stringify(snap).toLowerCase();
    for (const f of FORBIDDEN_KEYS) assert.equal(blob.includes(f), false);
    const direct = resumeInfo(install);
    assert.deepEqual(snap, direct);
  });

  it('null is rejected', () => {
    const r = safeResumeSnapshot(null);
    assert.equal(r.ok, false);
    assert.equal(typeof r.message, 'string');
  });
});

describe('required-input helpers', () => {
  it('hasRequiredInstallInput needs all three', () => {
    assert.equal(
      hasRequiredInstallInput({
        schoolName: 'OO초등학교',
        adminEmail: 'admin@school.kr',
        accountEmail: 'school-account@school.kr',
      }),
      true,
    );
    assert.equal(
      hasRequiredInstallInput({ schoolName: '', adminEmail: 'a@b.kr', accountEmail: 'c@d.kr' }),
      false,
    );
    assert.equal(
      hasRequiredInstallInput({ schoolName: 'S', adminEmail: '   ', accountEmail: 'c@d.kr' }),
      false,
    );
    assert.equal(
      hasRequiredInstallInput({ schoolName: 'S', adminEmail: 'a@b.kr', accountEmail: '' }),
      false,
    );
  });

  it('missingInstallInputMessage points at first missing field', () => {
    assert.equal(
      missingInstallInputMessage({ schoolName: '', adminEmail: 'a@b.kr', accountEmail: 'c@d.kr' }),
      '학교명을 입력하세요.',
    );
    assert.equal(
      missingInstallInputMessage({ schoolName: 'S', adminEmail: '', accountEmail: 'c@d.kr' }),
      '관리자 이메일을 입력하세요.',
    );
    assert.equal(
      missingInstallInputMessage({ schoolName: 'S', adminEmail: 'a@b.kr', accountEmail: '' }),
      '설치용 Google 계정 이메일을 입력하세요.',
    );
    assert.equal(
      missingInstallInputMessage({
        schoolName: 'S',
        adminEmail: 'a@b.kr',
        accountEmail: 'c@d.kr',
      }),
      '',
    );
  });
});

describe('humanError mapping', () => {
  it('denial', () => {
    assert.equal(
      humanError(new Error('access denied')),
      'Google 권한이 거부되었습니다. 설치를 계속하려면 권한을 허용하세요.',
    );
  });

  it('NO_TOKEN / 401', () => {
    assert.equal(
      humanError({ kind: 'NO_TOKEN', message: 'missing' }),
      'Google 연결이 만료되었습니다. 다시 연결하세요.',
    );
    assert.equal(
      humanError(new Error('401 unauthorized')),
      'Google 연결이 만료되었습니다. 다시 연결하세요.',
    );
  });

  it('SCRIPT_API_DISABLED', () => {
    assert.equal(
      humanError({ kind: 'SCRIPT_API_DISABLED', message: 'x' }),
      'Google에서 프로그램 설치 권한을 한 번 허용해야 합니다. 설정에서 허용한 뒤 다시 확인하세요.',
    );
  });

  it('RATE_LIMITED / SERVER_ERROR', () => {
    const expected = 'Google 서버가 바쁘거나 연결이 불안정합니다. 잠시 뒤 다시 시도 버튼을 눌러주세요.';
    assert.equal(humanError({ kind: 'RATE_LIMITED', message: '429' }), expected);
    assert.equal(humanError({ kind: 'SERVER_ERROR', message: '500' }), expected);
  });

  it('account mismatch', () => {
    assert.equal(
      humanError(new Error('설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.')),
      '설치를 시작한 Google 계정과 다릅니다. 처음 계정으로 다시 로그인하세요.',
    );
  });

  it('no-runtime passthrough', () => {
    assert.equal(
      humanError(new Error('게시된 실행 파일이 없어 설치를 시작할 수 없습니다')),
      BLOCKED_NO_RUNTIME,
    );
  });
});

describe('maker HTML contract', () => {
  it('includes all controller IDs', () => {
    const ids = [
      'maker-status',
      'school-name',
      'school-admin-email',
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
    ];
    for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing id ${id}`);
  });

  it('shows 4 presentation stages plus all real required controls', () => {
    for (const n of ['1', '2', '3', '4']) {
      assert.ok(html.includes(`data-display-stage="${n}"`), `missing presentation stage ${n}`);
    }
    for (const id of ['maker-status', 'school-name', 'school-admin-email', 'account-email', 'connect-btn', 'permission-status', 'create-btn', 'retry-btn', 'admin-url', 'verify-btn', 'owner-steps', 'resume-info', 'complete-btn', 'maker-release']) {
      assert.ok(html.includes(`id="${id}"`), `missing required control ${id}`);
    }
  });

  it('exact blocked copy present', () => {
    assert.ok(html.includes(BLOCKED_COPY));
  });

  it('initial disabled connect/create/verify/complete', () => {
    for (const id of ['connect-btn', 'create-btn', 'verify-btn', 'complete-btn']) {
      const re = new RegExp(`<button[^>]*id="${id}"[^>]*disabled|<button[^>]*disabled[^>]*id="${id}"`);
      assert.ok(re.test(html), `${id} should start disabled`);
    }
  });

  it('hidden admin-url with no fake href', () => {
    const m = html.match(/<a[^>]*id="admin-url"[^>]*>/);
    assert.ok(m, 'admin-url anchor missing');
    assert.ok(/hidden/.test(m[0]), 'admin-url should be hidden initially');
    assert.ok(!/href\s*=\s*"https?:/.test(m[0]), 'admin-url must not carry a fake href');
  });

  it('relative shared assets/nav', () => {
    assert.ok(html.includes('../assets/site.css'));
    assert.ok(html.includes('../assets/site.js'));
    assert.ok(html.includes('href="../index.html"') || html.includes('href="../"'), 'missing home route link');
    assert.ok(html.includes('../maker/index.html') || html.includes('href="../maker/"'), 'missing maker route link');
  });
});

describe('external resource + GIS ordering', () => {
  it('official GIS URL is the only external resource', () => {
    assert.ok(html.includes(GIS_URL));
    const urls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0].replace(/[).,;]*$/, ''));
    const external = urls.filter((u) => !u.startsWith(GIS_URL));
    assert.deepEqual(external, []);
  });

  it('flags async GIS script (needs deterministic boot ordering)', () => {
    const gisTag = html.match(/<script[^>]*accounts\.google\.com\/gsi\/client[^>]*>/);
    assert.ok(gisTag, 'GIS script tag missing');
    assert.ok(
      !/\basync\b/.test(gisTag[0]),
      'async GIS script is nondeterministic: maker.js snapshots GIS availability at boot, load GIS without async for deterministic ordering',
    );
  });
});

describe('maker.js static contract', () => {
  it('contains required imports/calls', () => {
    const must = [
      '../src/auth/config.js',
      'GOOGLE_OAUTH_CLIENT_ID',
      '../src/auth/google-auth.mjs',
      'createMemoryTokenStore',
      'createGoogleAuth',
      '../src/google/rest.mjs',
      'createRestClient',
      '../src/google/resources.mjs',
      'createResourceClients',
      '../src/install/state-machine.mjs',
      'createInstall',
      'advance',
      'resumeInfo',
      'canComplete',
      '../src/install/orchestrator.mjs',
      'runToStorage',
      'runToDeployed',
      'checkSchoolVerified',
      'ownerSteps',
    ];
    for (const s of must) assert.ok(js.includes(s), `maker.js missing ${s}`);
  });

  it('contains no forbidden storage/timer/fabricated-URL/fake-progress', () => {
    for (const s of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      assert.ok(!js.includes(s), `maker.js must not contain ${s}`);
    }
    assert.ok(!/\bsetTimeout\b/.test(js), 'maker.js must not contain setTimeout');
    assert.ok(!/\bsetInterval\b/.test(js), 'maker.js must not contain setInterval');
    assert.ok(!js.includes('https://'), 'maker.js must not fabricate an https admin URL');
    assert.ok(!js.includes('http://'), 'maker.js must not fabricate an http admin URL');
    const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/진행률|progress|prozent/i.test(jsCode), 'maker.js must not contain automatic fake progress');
  });
});

describe('resolveVerifiedEmail', () => {
  it('normalized owner match succeeds', () => {
    assert.equal(
      resolveVerifiedEmail({ typedEmail: '  Owner@School.kr ', verifiedEmail: 'owner@school.kr' }),
      'owner@school.kr',
    );
  });

  it('typed owner vs verified attacker throws account mismatch', () => {
    assert.throws(
      () => resolveVerifiedEmail({ typedEmail: 'owner@school.kr', verifiedEmail: 'attacker@evil.kr' }),
      /설치를 시작한 Google 계정과 다릅니다/,
    );
  });
});

describe('isGisAvailable', () => {
  it('false then true after assigning window.google.accounts.oauth2', () => {
    const win = {};
    assert.equal(isGisAvailable(win), false);
    win.google = { accounts: { oauth2: {} } };
    assert.equal(isGisAvailable(win), true);
  });
});

describe('releaseNoteText', () => {
  it('published note includes version and blank note says unavailable', () => {
    assert.ok(releaseNoteText('maker-1').includes('maker-1'));
    assert.ok(releaseNoteText('').includes('없습니다'));
  });
});

describe('displayStageForState mapping', () => {
  it('maps every real install state to one of four presentation stages', () => {
    assert.equal(displayStageForState(''), 1);
    assert.equal(displayStageForState('DRAFT'), 1);
    assert.equal(displayStageForState('OAUTH_READY'), 2);
    assert.equal(displayStageForState('API_ACCESS_READY'), 2);
    assert.equal(displayStageForState('STORAGE_CREATED'), 3);
    assert.equal(displayStageForState('SCRIPT_CREATED'), 3);
    assert.equal(displayStageForState('CODE_UPLOADED'), 3);
    assert.equal(displayStageForState('DEPLOYED'), 3);
    assert.equal(displayStageForState('AWAITING_SCHOOL_AUTH'), 4);
    assert.equal(displayStageForState('VERIFIED'), 4);
    assert.equal(displayStageForState('COMPLETE'), 4);
  });

  it('never skips VERIFIED: completion still requires the real state machine', () => {
    assert.equal(displayStageForState('VERIFIED'), 4);
    assert.equal(displayStageForState('DEPLOYED'), 3);
  });
});

describe('retryTargetForState', () => {
  it('maps states to retry targets', () => {
    assert.equal(retryTargetForState('DRAFT'), 'create');
    assert.equal(retryTargetForState('SCRIPT_CREATED'), 'create');
    assert.equal(retryTargetForState('AWAITING_SCHOOL_AUTH'), 'verify');
    assert.equal(retryTargetForState('VERIFIED'), 'complete');
  });
});

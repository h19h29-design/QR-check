// Client.js.html 내 <script> 구문 검증 (DOM 실행 아님 — live 브라우저 검증은 별도)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(
  path.resolve(here, '..', '..', 'apps-script', 'Client.js.html'),
  'utf8',
);
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test('Client.js.html 스크립트가 파싱된다', () => {
  assert.ok(blocks.length >= 1);
  for (const code of blocks) new vm.Script(code, { filename: 'Client.js.html' });
});

test('제출 초기화 Promise 거부를 점검 화면에 표시한다', async () => {
  const removedClasses = [];
  const offlineBox = {
    classList: { remove: (name) => removedClasses.push(name) },
    textContent: '',
  };
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : null),
    },
    Promise,
  });
  for (const code of blocks) new vm.Script(code, { filename: 'Client.js.html' }).runInContext(context);
  const startSubmitPage = vm.runInContext(
    'typeof startSubmitPage_ === "function" ? startSubmitPage_ : null',
    context,
  );
  assert.notEqual(startSubmitPage, null, '초기화 거부를 화면에 연결하는 진입점이 필요하다');

  await startSubmitPage(() => Promise.reject(new Error('synthetic init failure')));

  assert.ok(removedClasses.includes('hidden'));
  assert.match(offlineBox.textContent, /synthetic init failure/);
});

test('UTC 날짜 계산이 남아 있지 않다', () => {
  assert.ok(!html.includes('toISOString().slice(0, 10)'), 'KST 계산으로 대체되어야 한다');
});

test('명시적 전체 정상 버튼이 있다', () => {
  assert.ok(html.includes('전체 이상 없음으로 표시'));
});

test('미선택 기본값이 남아 있지 않다', () => {
  assert.ok(!html.includes('normal.checked = true'));
});

test('제출 주소는 서버 공개 URL 우선, iframe 주소 경고가 있다', () => {
  assert.ok(html.includes('__EXEC_URL__'));
  assert.ok(html.includes('1회용'));
  assert.ok(!html.includes('return String(window.location.href).split'), 'iframe 주소로 fallback하면 안 된다');
});

// --- appended: submitForm/resendPending behavioral tests (synthetic only, no credentials) ---
function makeVmBox() {
  const box = {
    _children: [],
    get firstChild() { return this._children[0] || null; },
    appendChild(c) { this._children.push(c); return c; },
    removeChild(c) {
      const i = this._children.indexOf(c);
      if (i >= 0) this._children.splice(i, 1);
      return c;
    },
    classList: {
      removed: [],
      added: [],
      remove(n) { this.removed.push(n); },
      add(n) { this.added.push(n); },
      toggle() {},
    },
    textContent: '',
  };
  return box;
}
function makeVmEl(tag) {
  return {
    tag,
    children: [],
    textContent: '',
    className: '',
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    classList: {
      removed: [],
      added: [],
      remove(n) { this.removed.push(n); },
      add(n) { this.added.push(n); },
      toggle() {},
    },
    addEventListener() {},
    setAttribute() {},
    querySelector() { return null; },
  };
}
function makeVmStorage(initial, opts) {
  const s = {};
  Object.defineProperties(s, {
    getItem: {
      value(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; },
      enumerable: false, writable: true, configurable: true,
    },
    setItem: {
      value(k, v) {
        if (opts && opts.throwOnSet) throw new Error('QUOTA_EXCEEDED_ERR: synthetic quota');
        this[k] = String(v);
      },
      enumerable: false, writable: true, configurable: true,
    },
    removeItem: {
      value(k) { delete this[k]; },
      enumerable: false, writable: true, configurable: true,
    },
  });
  for (const [k, v] of Object.entries(initial || {})) s[k] = v;
  return s;
}
function vmBoxText(box) {
  return (box._children || []).map((c) => String(c.textContent || '')).join('\n');
}
function runClientBlocks(context) {
  for (const code of blocks) new vm.Script(code, { filename: 'Client.js.html' }).runInContext(context);
}

test('submitForm review_required: 관리자 안내 + review_required 보관, showDone 미호출', async () => {
  const offlineBox = makeVmBox();
  const submitBtn = { disabled: false, textContent: 'synthetic submit' };
  const submitFormEl = {
    querySelector: () => submitBtn,
    classList: { added: [], removed: [], add(n) { this.added.push(n); }, remove(n) { this.removed.push(n); } },
    addEventListener() {},
  };
  const alertCalls = [];
  const payload = { record_id: 'rec_synth_review_1', room_id: 'room_s', submit_token: 'tok_s' };
  const storage = makeVmStorage({});
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : id === 'submitForm' ? submitFormEl : null),
      createElement: (tag) => makeVmEl(tag),
      createTextNode: (t) => ({ textContent: String(t), text: String(t) }),
      getElementsByName: () => [],
      body: makeVmEl('body'),
    },
    window: { __PARAMS__: {}, __BOOTSTRAP__: { items: [] }, confirm: () => false },
    navigator: { userAgent: 'synthetic' },
    localStorage: storage,
    alert: (m) => alertCalls.push(String(m)),
    Promise,
    __gasCalls: [],
    __showDoneCalls: [],
    __testPayload: payload,
  });
  runClientBlocks(context);
  vm.runInContext('buildSubmitPayload_ = function() { return Promise.resolve(__testPayload); };', context);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.reject(new Error("[SUBMISSION_REVIEW_REQUIRED] synthetic review")); };', context);
  vm.runInContext('showDone = function() { __showDoneCalls.push(Array.prototype.slice.call(arguments)); };', context);
  await vm.runInContext('submitForm({ preventDefault: function() {} })', context);
  assert.equal(vm.runInContext('__showDoneCalls.length', context), 0);
  const raw = vm.runInContext('localStorage.getItem("qr_pending_rec_synth_review_1")', context);
  assert.ok(raw, 'review 항목이 보관되어야 한다');
  const stored = JSON.parse(raw);
  assert.equal(stored.review_required, true);
  assert.equal(stored.payload.record_id, 'rec_synth_review_1');
  assert.deepEqual(stored.payload, payload);
  const text = vmBoxText(offlineBox);
  assert.match(text, /관리자/);
  assert.match(alertCalls.join('\n'), /관리자/);
});

test('submitForm review + 저장 quota 실패에도 관리자 안내 (일반 재전송 안내 아님)', async () => {
  const offlineBox = makeVmBox();
  const submitBtn = { disabled: false, textContent: 'synthetic submit' };
  const submitFormEl = {
    querySelector: () => submitBtn,
    classList: { added: [], removed: [], add(n) { this.added.push(n); }, remove(n) { this.removed.push(n); } },
    addEventListener() {},
  };
  const alertCalls = [];
  const payload = { record_id: 'rec_synth_quota_1', room_id: 'room_s', submit_token: 'tok_s' };
  const storage = makeVmStorage({}, { throwOnSet: true });
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : id === 'submitForm' ? submitFormEl : null),
      createElement: (tag) => makeVmEl(tag),
      createTextNode: (t) => ({ textContent: String(t), text: String(t) }),
      getElementsByName: () => [],
      body: makeVmEl('body'),
    },
    window: { __PARAMS__: {}, __BOOTSTRAP__: { items: [] }, confirm: () => false },
    navigator: { userAgent: 'synthetic' },
    localStorage: storage,
    alert: (m) => alertCalls.push(String(m)),
    Promise,
    __gasCalls: [],
    __showDoneCalls: [],
    __testPayload: payload,
  });
  runClientBlocks(context);
  vm.runInContext('buildSubmitPayload_ = function() { return Promise.resolve(__testPayload); };', context);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.reject(new Error("[SUBMISSION_REVIEW_REQUIRED] synthetic review")); };', context);
  vm.runInContext('showDone = function() { __showDoneCalls.push(Array.prototype.slice.call(arguments)); };', context);
  await vm.runInContext('submitForm({ preventDefault: function() {} })', context);
  assert.equal(vm.runInContext('__showDoneCalls.length', context), 0);
  const text = vmBoxText(offlineBox);
  assert.match(text, /관리자/);
  assert.match(alertCalls.join('\n'), /관리자/);
  assert.doesNotMatch(alertCalls.join('\n'), /임시 저장/);
});

test('표시된 review 항목 재전송 시 gas 0회 호출', async () => {
  const offlineBox = makeVmBox();
  const key = 'qr_pending_rec_synth_marked_1';
  const storage = makeVmStorage({
    [key]: JSON.stringify({
      saved_at: '2026-01-01T00:00:00.000Z',
      expires_at: Date.now() + 3600000,
      payload: { record_id: 'rec_synth_marked_1' },
      review_required: true,
    }),
  });
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : null),
      createElement: (tag) => makeVmEl(tag),
      createTextNode: (t) => ({ textContent: String(t), text: String(t) }),
      getElementsByName: () => [],
      body: makeVmEl('body'),
    },
    window: { confirm: () => false },
    navigator: { userAgent: 'synthetic' },
    localStorage: storage,
    alert: () => {},
    Promise,
    __gasCalls: [],
  });
  runClientBlocks(context);
  assert.deepEqual(Array.from(vm.runInContext('Object.keys(localStorage)', context)).sort(), [key]);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); };', context);
  await vm.runInContext('resendPending()', context);
  assert.equal(vm.runInContext('__gasCalls.length', context), 0);
  assert.ok(vm.runInContext('localStorage.getItem("' + key + '")', context), '표시 항목은 삭제되지 않아야 한다');
  assert.match(vmBoxText(offlineBox), /관리자 확인이 필요한 제출/);
});

test('첫 재시도 review 전환은 표시 보관 + 만료 유지, 이후 호출 gas 0회', async () => {
  const offlineBox = makeVmBox();
  const key = 'qr_pending_rec_synth_retry_1';
  const expiresAt = Date.now() + 7200000;
  const storage = makeVmStorage({
    [key]: JSON.stringify({
      saved_at: '2026-01-01T00:00:00.000Z',
      expires_at: expiresAt,
      payload: { record_id: 'rec_synth_retry_1' },
    }),
  });
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : null),
      createElement: (tag) => makeVmEl(tag),
      createTextNode: (t) => ({ textContent: String(t), text: String(t) }),
      getElementsByName: () => [],
      body: makeVmEl('body'),
    },
    window: { confirm: () => false },
    navigator: { userAgent: 'synthetic' },
    localStorage: storage,
    alert: () => {},
    Promise,
    __gasCalls: [],
  });
  runClientBlocks(context);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.reject(new Error("[SUBMISSION_REVIEW_REQUIRED] synthetic review")); };', context);
  await vm.runInContext('resendPending()', context);
  assert.equal(vm.runInContext('__gasCalls.length', context), 1);
  const stored = JSON.parse(vm.runInContext('localStorage.getItem("' + key + '")', context));
  assert.equal(stored.review_required, true);
  assert.equal(Number(stored.expires_at), expiresAt);
  assert.equal(stored.payload.record_id, 'rec_synth_retry_1');
  vm.runInContext('__gasCalls.length = 0;', context);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); };', context);
  await vm.runInContext('resendPending()', context);
  assert.equal(vm.runInContext('__gasCalls.length', context), 0);
});

test('네트워크 오류 항목은 보관 유지 + 재시도 가능', async () => {
  const offlineBox = makeVmBox();
  const key = 'qr_pending_rec_synth_net_1';
  const storage = makeVmStorage({
    [key]: JSON.stringify({
      saved_at: '2026-01-01T00:00:00.000Z',
      expires_at: Date.now() + 3600000,
      payload: { record_id: 'rec_synth_net_1' },
    }),
  });
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : null),
      createElement: (tag) => makeVmEl(tag),
      createTextNode: (t) => ({ textContent: String(t), text: String(t) }),
      getElementsByName: () => [],
      body: makeVmEl('body'),
    },
    window: { confirm: () => false },
    navigator: { userAgent: 'synthetic' },
    localStorage: storage,
    alert: () => {},
    Promise,
    __gasCalls: [],
  });
  runClientBlocks(context);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.reject(new Error("synthetic network failure")); };', context);
  await vm.runInContext('resendPending()', context);
  assert.equal(vm.runInContext('__gasCalls.length', context), 1);
  assert.ok(vm.runInContext('localStorage.getItem("' + key + '")', context), '네트워크 실패 항목은 보관되어야 한다');
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); };', context);
  await vm.runInContext('resendPending()', context);
  assert.equal(vm.runInContext('localStorage.getItem("' + key + '")', context), null);
});

test('만료 review 항목은 신규 제출로 안내하지 않는다', async () => {
  const offlineBox = makeVmBox();
  const key = 'qr_pending_rec_synth_expired_1';
  const storage = makeVmStorage({
    [key]: JSON.stringify({
      saved_at: '2026-01-01T00:00:00.000Z',
      expires_at: Date.now() - 1000,
      payload: { record_id: 'rec_synth_expired_1' },
      review_required: true,
    }),
  });
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === 'offlineBox' ? offlineBox : null),
      createElement: (tag) => makeVmEl(tag),
      createTextNode: (t) => ({ textContent: String(t), text: String(t) }),
      getElementsByName: () => [],
      body: makeVmEl('body'),
    },
    window: { confirm: () => false },
    navigator: { userAgent: 'synthetic' },
    localStorage: storage,
    alert: () => {},
    Promise,
    __gasCalls: [],
  });
  runClientBlocks(context);
  vm.runInContext('gas = function() { __gasCalls.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); };', context);
  await vm.runInContext('resendPending()', context);
  assert.equal(vm.runInContext('localStorage.getItem("' + key + '")', context), null);
  const text = vmBoxText(offlineBox);
  assert.match(text, /관리자/);
  assert.doesNotMatch(text, /다시 제출하세요/);
});

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
});

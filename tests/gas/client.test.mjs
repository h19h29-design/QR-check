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

test('Client.js.html 스크립트가 파싱된다', () => {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  for (const code of blocks) new vm.Script(code, { filename: 'Client.js.html' });
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

// 공개 exec URL (QR·제출 주소용) 회귀 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGas } from './loader.mjs';

test('publicExecUrl_은 /exec 주소를 반환한다', () => {
  const { api } = loadGas({});
  assert.equal(api.publicExecUrl_(), 'https://script.google.com/macros/s/TESTEXEC/exec');
});

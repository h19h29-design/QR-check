import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('public pages distinguish published OAuth from completed scope verification', () => {
  for (const page of ['index.html', 'maker/index.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /테스트 사용자로 등록된 계정|OAuth 앱이 테스트\(미검증\)/);
    assert.match(html, /외부 프로덕션/);
    assert.match(html, /권한 심사/);
    assert.match(html, /Workspace/);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  setupUrlFromWebAppUrl,
  scriptEditorUrlFromId,
} from '../maker/maker.js';

test('설치 완료 안내는 관리자보다 초기 설정 주소를 직접 제공한다', () => {
  const webApp = 'https://script.google.com/macros/s/Abc_123-xyz/exec?stale=1';
  assert.equal(
    setupUrlFromWebAppUrl(webApp),
    'https://script.google.com/macros/s/Abc_123-xyz/exec?page=setup',
  );
});

test('Apps Script 프로젝트 ID로 편집기 주소를 안전하게 만든다', () => {
  assert.equal(
    scriptEditorUrlFromId('Script_123-xyz'),
    'https://script.google.com/home/projects/Script_123-xyz/edit',
  );
  assert.equal(scriptEditorUrlFromId('bad/id'), '');
});

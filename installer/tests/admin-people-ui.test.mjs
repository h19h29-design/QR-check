import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('관리자 웹은 담당자·당직자 추가와 목록 관리를 제공한다', () => {
  const view = read('apps-script/AdminView.html');
  const client = read('apps-script/Client.js.html');
  const api = read('apps-script/Api.gs');

  for (const id of ['personName', 'personRole', 'personRoom', 'peopleTable']) {
    assert.match(view, new RegExp(`id=["']${id}["']`), `${id} control must ship in AdminView`);
  }
  assert.match(client, /function\s+loadPeople\s*\(/);
  assert.match(client, /function\s+savePerson\s*\(/);
  assert.match(client, /function\s+renderAdminPeople\s*\(/);
  assert.match(client, /adminSavePersonForUi/);
  assert.match(api, /function\s+adminPeopleForUi\s*\(/);
  assert.match(api, /function\s+adminSavePersonForUi\s*\(/);
});

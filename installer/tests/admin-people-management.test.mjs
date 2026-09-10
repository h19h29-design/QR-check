import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminSource = fs.readFileSync(path.join(here, '..', '..', 'apps-script', 'Admin.gs'), 'utf8');

function loadAdmin(overrides = {}) {
  const rows = {
    settings_people: [],
    settings_rooms: [{ room_id: 'room-1', room_name: '행정실', active: true, room_order: 10 }],
  };
  const audits = [];
  const context = vm.createContext({
    Object,
    String,
    Number,
    Error,
    verifyAdmin_: () => ({ actor: 'owner@example.com' }),
    nowIso_: () => '2026-09-10T10:30:00+09:00',
    today_: () => '2026-09-10',
    uuid_: () => 'person-generated-1',
    cleanText_: (value, maxLength) => {
      const text = String(value == null ? '' : value).trim();
      if (text.length > maxLength) throw new Error('입력값이 너무 깁니다.');
      return text;
    },
    readTable_: (name) => rows[name] || [],
    findBy_: (name, key, value) => (rows[name] || []).find((row) => String(row[key]) === String(value)) || null,
    upsertObject_: (name, row, key) => {
      const index = (rows[name] || []).findIndex((item) => String(item[key]) === String(row[key]));
      if (index >= 0) rows[name][index] = { ...row };
      else rows[name].push({ ...row });
    },
    logAudit_: (...args) => audits.push(args),
    activeRow_: (row) => row.active === true,
    ...overrides,
  });
  vm.runInContext(adminSource, context);
  return { context, rows, audits };
}

test('학교 관리자는 웹 관리자에서 담당자를 추가하고 목록에서 확인할 수 있다', () => {
  const { context, rows, audits } = loadAdmin();

  const saved = vm.runInContext(`savePersonFromAdmin_({
    person_name: '  검증 담당자  ',
    role_type: 'responsible',
    room_id: 'room-1'
  })`, context);
  const listed = vm.runInContext('adminListPeople_({})', context);

  assert.equal(saved.person.person_id, 'person-generated-1');
  assert.equal(saved.person.person_name, '검증 담당자');
  assert.equal(saved.person.role_type, 'responsible');
  assert.equal(saved.person.room_id, 'room-1');
  assert.equal(saved.person.active, true);
  assert.equal(rows.settings_people.length, 1);
  assert.equal(listed.people.length, 1);
  assert.equal(listed.people[0].person_name, '검증 담당자');
  assert.equal(audits[0][1], 'admin_save_person');
});

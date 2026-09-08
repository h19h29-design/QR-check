import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGas, seedSchool } from './loader.mjs';

const ADMIN = 'owner201@test.example';

function containsDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return true;
  if (Array.isArray(value)) return value.some(containsDate);
  if (value && typeof value === 'object') return Object.values(value).some(containsDate);
  return false;
}

test('google.script.run 관리자 응답에는 Sheets Date 객체가 남지 않는다', () => {
  const { ctx, api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });

  const room = api.findBy_('settings_rooms', 'room_id', seed.room.room.room_id);
  room.created_at = new Date('2026-09-08T00:00:00Z');
  room.updated_at = new Date('2026-09-08T00:00:00Z');
  api.upsertObject_('settings_rooms', room, 'room_id');

  api.upsertObject_('submissions', {
    record_id: 'rec_ui_date_1',
    submitted_at: new Date('2026-09-08T03:30:00Z'),
    inspection_date: new Date('2026-09-08T00:00:00Z'),
    room_id: room.room_id,
    room_name: room.room_name,
    person_id: seed.personId,
    person_name: '당직자',
    role_type: 'duty',
    status_json: '{}',
    abnormal: false,
    save_state: 'COMMITTED',
    created_at: new Date('2026-09-08T03:30:00Z'),
    updated_at: new Date('2026-09-08T03:30:00Z'),
  }, 'record_id');

  const result = ctx.adminListForUi({ start_date: '2026-09-08', end_date: '2026-09-08' });
  assert.equal(containsDate(result), false);
  assert.equal(typeof result.submissions[0].submitted_at, 'string');

  const detail = ctx.adminDetailForUi({ record_id: 'rec_ui_date_1' });
  assert.equal(containsDate(detail), false);
  assert.equal(typeof detail.record.created_at, 'string');
});

test('UI 직렬화는 null을 보존하고 손상된 Date는 null로 격리한다', () => {
  const { ctx } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  assert.equal(ctx.clientSafeValue_(null), null);
  assert.equal(ctx.clientSafeValue_(new Date('invalid')), null);
});

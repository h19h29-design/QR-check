// PARTIAL 복구 경로 (Phase 7)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGas, seedSchool } from './loader.mjs';

const ADMIN = 'owner201@test.example';

function freshPartial() {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  const items = api.readTable_('settings_check_items');
  const status = {};
  for (const it of items) status[String(it.item_key)] = '이상 무';
  api.submitInspection_({
    record_id: 'rec_partial_1',
    room_id: seed.room.room.room_id,
    submit_token: seed.room.submitToken,
    person_id: seed.personId,
    role_type: 'duty',
    status_json: status,
    remarks: '',
    attachments: {},
  });
  // 부가 저장 실패 상황을 시뮬레이션: 확정 행을 PARTIAL로 표시
  const row = api.findBy_('submissions', 'record_id', 'rec_partial_1');
  row.save_state = 'PARTIAL';
  row.updated_at = api.nowIso_();
  api.upsertObject_('submissions', row, 'record_id');
  return { api, seed };
}

test('PARTIAL 목록에 잡히고 일반 조회에는 그대로 보인다', () => {
  const { api } = freshPartial();
  const list = api.adminListPartials_({});
  assert.equal(list.partials.length, 1);
  assert.equal(list.partials[0].record_id, 'rec_partial_1');
});

test('복구 확정하면 COMMITTED로 돌아간다', () => {
  const { api } = freshPartial();
  const res = api.adminReconcileRecord_({ record_id: 'rec_partial_1' });
  assert.equal(res.save_state, 'COMMITTED');
  assert.equal(res.changed, true);
  assert.equal(api.adminListPartials_({}).partials.length, 0);
});

test('이미 COMMITTED면 복구는 no-op', () => {
  const { api } = freshPartial();
  api.adminReconcileRecord_({ record_id: 'rec_partial_1' });
  const res = api.adminReconcileRecord_({ record_id: 'rec_partial_1' });
  assert.equal(res.changed, false);
});

test('정리는 confirm 없이 거부, 확정 기록은 정리 불가', () => {
  const { api } = freshPartial();
  assert.throws(() => api.adminDiscardPartial_({ record_id: 'rec_partial_1' }), /confirm/);
  const res = api.adminDiscardPartial_({ record_id: 'rec_partial_1', confirm: true });
  assert.equal(res.save_state, 'DISCARDED');
  // 일반 목록에서 제외
  const list = api.adminListSubmissions_({ state: '' });
  assert.ok(!list.submissions.some((r) => String(r.record_id) === 'rec_partial_1'));
  // 확정 기록 정리는 거부
  const { api: api2 } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed2 = seedSchool(api2, { adminEmail: ADMIN });
  const items = api2.readTable_('settings_check_items');
  const status = {};
  for (const it of items) status[String(it.item_key)] = '이상 무';
  api2.submitInspection_({
    record_id: 'rec_ok_1', room_id: seed2.room.room.room_id, submit_token: seed2.room.submitToken,
    person_id: seed2.personId, role_type: 'duty', status_json: status, remarks: '', attachments: {},
  });
  assert.throws(() => api2.adminDiscardPartial_({ record_id: 'rec_ok_1', confirm: true }), /확정/);
});

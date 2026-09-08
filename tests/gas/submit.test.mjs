// 제출 엄격 검증 + 멱등/충돌 + 부분실패 + snapshot (TDD: 먼저 실패 확인 후 구현 검증)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGas, seedSchool } from './loader.mjs';

const ADMIN = 'owner201@test.example';

function fresh() {
  const { api, stubs } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  return { api, stubs, seed };
}

function fullStatus(api) {
  const items = api.readTable_('settings_check_items').filter((r) => String(r.active) === 'true' || r.active === true);
  const status = {};
  for (const it of items) status[String(it.item_key)] = '이상 무';
  return status;
}

function basePayload(seed, overrides = {}) {
  return {
    record_id: 'rec_test_001',
    room_id: seed.room.room.room_id,
    submit_token: seed.room.submitToken,
    person_id: seed.personId,
    role_type: 'duty',
    status_json: {},
    remarks: '',
    attachments: {},
    ...overrides,
  };
}

test('누락 항목은 정상으로 바뀌지 않고 거부된다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  p.status_json = { cleaning: '이상 무' }; // 일부만
  assert.throws(() => api.prepareSubmission_(p), /선택하지 않은 항목/);
});

test('잘못된 JSON 문자열 상태값은 실패한다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  p.status_json = '{broken';
  assert.throws(() => api.prepareSubmission_(p), /해석할 수 없습니다/);
});

test('알 수 없는 항목 키는 거부된다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  const s = fullStatus(api);
  s.no_such_item = '이상 무';
  p.status_json = s;
  assert.throws(() => api.prepareSubmission_(p), /알 수 없는 점검항목/);
});

test('유효하지 않은 상태값은 거부된다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  const s = fullStatus(api);
  s[Object.keys(s)[0]] = '모름';
  p.status_json = s;
  assert.throws(() => api.prepareSubmission_(p), /올바르지 않은/);
});

test('정상 제출은 COMMITTED + snapshot + digest를 남긴다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  p.status_json = fullStatus(api);
  const res = api.submitInspection_(p);
  assert.equal(res.duplicate, false);
  assert.equal(res.save_state, 'COMMITTED');
  const row = api.findBy_('submissions', 'record_id', 'rec_test_001');
  assert.ok(row);
  assert.ok(String(row.payload_digest).length >= 16);
  assert.ok(String(row.submit_snapshot).includes('3-1반'));
  assert.equal(row.inspection_date, api.today_());
});

test('같은 요청 재전송은 1건으로 멱등 처리된다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  p.status_json = fullStatus(api);
  api.submitInspection_(p);
  const res2 = api.submitInspection_({ ...p });
  assert.equal(res2.duplicate, true);
  const rows = api.readTable_('submissions').filter((r) => String(r.record_id) === 'rec_test_001');
  assert.equal(rows.length, 1);
});

test('같은 요청번호에 다른 내용은 충돌로 거부된다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  p.status_json = fullStatus(api);
  api.submitInspection_(p);
  const p2 = { ...p, remarks: '전혀 다른 내용' };
  assert.throws(() => api.submitInspection_(p2), /충돌/);
});

test('관찰시간이 있으면 점검일이 관찰일 기준, 형식 오류는 거부', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed);
  p.status_json = fullStatus(api);
  p.record_id = 'rec_obs_1';
  p.observed_at = '2026-09-01T08:40';
  api.submitInspection_(p);
  const row = api.findBy_('submissions', 'record_id', 'rec_obs_1');
  assert.equal(row.inspection_date, '2026-09-01');

  const bad = basePayload(seed, { record_id: 'rec_obs_2', observed_at: 'yesterday-ish' });
  bad.status_json = fullStatus(api);
  assert.throws(() => api.prepareSubmission_(bad), /관찰시간 형식/);
});

test('담당자·당직자 중복 선택은 서버에서 거부된다', () => {
  const { api, seed } = fresh();
  // 사람을 responsible로 등록된 사람으로 바꿔 역할 불일치 유발
  const p = basePayload(seed);
  p.status_json = fullStatus(api);
  p.role_type = 'responsible'; // 등록은 duty
  assert.throws(() => api.prepareSubmission_(p), /역할/);
});

test('같은 요청번호에 관찰시간이 다르면 충돌하고 원본이 보존된다', () => {
  const { api, seed } = fresh();
  const p = basePayload(seed, { record_id: 'rec_obs_conflict', observed_at: '2026-09-01T08:40' });
  p.status_json = fullStatus(api);
  api.submitInspection_(p);
  const p2 = basePayload(seed, { record_id: 'rec_obs_conflict', observed_at: '2026-09-02T09:15' });
  p2.status_json = fullStatus(api);
  assert.throws(() => api.submitInspection_(p2), /충돌/);
  const rows = api.readTable_('submissions').filter((r) => String(r.record_id) === 'rec_obs_conflict');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].observed_at, '2026-09-01T08:40');
});

test('첨부 동일 재전송은 멱등, 동길이 변경분은 충돌한다', () => {
  const { api, seed } = fresh();
  const firstKey = Object.keys(fullStatus(api))[0];
  const att = (b64) => ({ file_name: 'synthetic.gif', mime_type: 'image/gif', file_size: 12, base64: b64 });
  const p = basePayload(seed, { record_id: 'rec_att_1', attachments: { [firstKey]: att('R0lGODlhaGVsbG8x') } });
  p.status_json = fullStatus(api);
  api.submitInspection_(p);
  const same = basePayload(seed, { record_id: 'rec_att_1', attachments: { [firstKey]: att('R0lGODlhaGVsbG8x') } });
  same.status_json = fullStatus(api);
  assert.equal(api.submitInspection_(same).duplicate, true);
  const before = api.findBy_('submissions', 'record_id', 'rec_att_1');
  const changed = basePayload(seed, { record_id: 'rec_att_1', attachments: { [firstKey]: att('R0lGODlhaGVsbG8y') } });
  changed.status_json = fullStatus(api);
  assert.throws(() => api.submitInspection_(changed), /충돌/);
  const rows = api.readTable_('submissions').filter((r) => String(r.record_id) === 'rec_att_1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload_digest, before.payload_digest);
});

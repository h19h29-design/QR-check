// HMAC QR 토큰: 재인쇄·이름유지·재발급·레거시 fallback
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGas, seedSchool } from './loader.mjs';

const ADMIN = 'owner201@test.example';

function fullStatus(api) {
  const items = api.readTable_('settings_check_items');
  const status = {};
  for (const it of items) status[String(it.item_key)] = '이상 무';
  return status;
}

function submitWith(api, seed, roomId, token, recordId) {
  return api.submitInspection_({
    record_id: recordId,
    room_id: roomId,
    submit_token: token,
    person_id: seed.personId,
    role_type: 'duty',
    status_json: fullStatus(api),
    remarks: '',
    attachments: {},
  });
}

test('재인쇄한 토큰(재계산)으로 제출된다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  const roomId = seed.room.room.room_id;
  const reprinted = api.roomToken_(roomId, 1);
  assert.equal(reprinted, seed.room.submitToken);
  const res = submitWith(api, seed, roomId, reprinted, 'rec_qr_1');
  assert.equal(res.duplicate, false);
});

test('이름 변경 후 같은 QR로 제출된다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  const roomId = seed.room.room.room_id;
  api.saveRoomFromAdmin_({ room_id: roomId, room_name: '행정지원실' });
  const res = submitWith(api, seed, roomId, seed.room.submitToken, 'rec_qr_2');
  assert.equal(res.duplicate, false);
});

test('재발급하면 이전 QR은 실패, 새 QR은 성공', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  const roomId = seed.room.room.room_id;
  const re = api.reissueRoomTokenFromAdmin_({ room_id: roomId });
  assert.equal(re.token_version, 2);
  assert.notEqual(re.submitToken, seed.room.submitToken);
  assert.throws(() => submitWith(api, seed, roomId, seed.room.submitToken, 'rec_qr_3'), /유효하지 않은 QR/);
  const res = submitWith(api, seed, roomId, re.submitToken, 'rec_qr_4');
  assert.equal(res.duplicate, false);
});

test('레거시 랜덤 토큰 hash도 fallback으로 인정된다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  // 구버전 방식으로 저장된 실을 직접 기록
  const legacyId = 'room_legacy_1';
  api.upsertObject_('settings_rooms', {
    room_id: legacyId,
    room_name: '구실',
    room_order: 50,
    submit_token_hash: api.hashToken_('legacy-plain-token', legacyId),
    active: true,
    created_at: api.nowIso_(),
    updated_at: api.nowIso_(),
    token_version: 1,
  }, 'room_id');
  api.upsertObject_('settings_people', {
    person_id: 'person_legacy_1', person_name: '구실담당', role_type: 'responsible',
    room_id: legacyId, active: true, sort_order: 10,
    created_at: api.nowIso_(), updated_at: api.nowIso_(),
  }, 'person_id');
  const res = api.submitInspection_({
    record_id: 'rec_qr_5',
    room_id: legacyId,
    submit_token: 'legacy-plain-token',
    person_id: 'person_legacy_1',
    role_type: 'responsible',
    status_json: fullStatus(api),
    remarks: '',
    attachments: {},
  });
  assert.equal(res.duplicate, false);
});

test('초기 설정에서 장소를 함께 만들면 토큰이 1회 반환된다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  api.ensureSheets_();
  api.seedDefaults_();
  const key = api.createInitialSetupKey();
  const setup = api.initializeSchoolStorage_({
    setupKey: key,
    school_name: 'QR체크 테스트학교',
    admin_email: ADMIN,
    admin_name: '관리자',
    rooms: ['행정실', '교무실', '도서실'],
  });
  assert.equal(setup.rooms.length, 3);
  assert.ok(setup.rooms[0].submit_token);
  const rooms = api.adminListRooms_({});
  assert.equal(rooms.rooms.length, 3);
  assert.equal(rooms.rooms[0].submit_token, setup.rooms[0].submit_token);
});

test('관리자 실 목록 토큰으로 실제 제출된다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  const rooms = api.adminListRooms_({});
  const first = rooms.rooms[0];
  const res = submitWith(api, seed, first.room_id, first.submit_token, 'rec_qr_6');
  assert.equal(res.duplicate, false);
});

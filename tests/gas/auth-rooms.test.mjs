// 인증 + 실/QR 분리 + 스키마 버전 (TDD)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGas, seedSchool } from './loader.mjs';

const ADMIN = 'owner201@test.example';
const OTHER = 'stranger@test.example';

test('testBootstrap 플래그로 초기 설정 인증을 우회할 수 없다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  assert.throws(
    () => api.initializeSchoolStorage_({
      testBootstrap: true,
      school_name: '테스트학교',
      admin_email: ADMIN,
    }),
    /초기 설정 키/,
  );
});

test('신규 설치 기본 모드는 google_only, 토큰 fallback이 거부된다', () => {
  const { api, stubs } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  assert.equal(api.adminAuthMode_(), 'google_only');
  // 비관리자 이메일 + 유효 토큰 → 토큰 무시, 거부
  stubs.setEmails(OTHER, OTHER);
  assert.throws(() => api.verifyAdmin_({ adminToken: seed.setup.adminToken }), /관리자 목록/);
  // 빈 신원 + 유효 토큰 → 거부 + 해결 안내
  stubs.setEmails('', '');
  assert.throws(() => api.verifyAdmin_({ adminToken: seed.setup.adminToken }), /Google 계정/);
});

test('빈 신원은 거부되고 안내 메시지를 준다', () => {
  const loaded = loadGas({ activeEmail: '', effectiveEmail: '' });
  assert.throws(() => loaded.api.requireAdmin_({}), /Google 계정을 확인/);
});

test('비관리자는 거부된다', () => {
  const { api, stubs } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  seedSchool(api, { adminEmail: ADMIN });
  stubs.setEmails(OTHER, OTHER);
  assert.throws(() => api.requireAdmin_({}), /관리자 목록/);
});

test('소유자는 성공한다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  seedSchool(api, { adminEmail: ADMIN });
  const auth = api.requireAdmin_({});
  assert.equal(auth.actor, ADMIN);
  assert.equal(auth.method, 'google_email');
});

test('실 이름 수정은 QR을 유지하고 재발급만 토큰을 바꾼다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  const seed = seedSchool(api, { adminEmail: ADMIN });
  const roomId = seed.room.room.room_id;
  const oldToken = seed.room.submitToken;

  const renamed = api.saveRoomFromAdmin_({ room_id: roomId, room_name: '3-2반' });
  assert.equal(renamed.token_kept, true);
  assert.equal(renamed.submitToken, oldToken); // HMAC 결정적 토큰: 이름 변경 후 동일
  // 기존 QR 토큰으로 제출 가능
  const items = api.readTable_('settings_check_items');
  const status = {};
  for (const it of items) status[String(it.item_key)] = '이상 무';
  const res = api.submitInspection_({
    record_id: 'rec_rename_1',
    room_id: roomId,
    submit_token: oldToken,
    person_id: seed.personId,
    role_type: 'duty',
    status_json: status,
    remarks: '',
    attachments: {},
  });
  assert.equal(res.duplicate, false);

  // 명시적 재발급: 버전 증가 + 이전 토큰 무효
  const re = api.reissueRoomTokenFromAdmin_({ room_id: roomId });
  assert.equal(re.token_version, 2);
  assert.throws(
    () =>
      api.submitInspection_({
        record_id: 'rec_rename_2',
        room_id: roomId,
        submit_token: oldToken,
        person_id: seed.personId,
        role_type: 'duty',
        status_json: status,
        remarks: '',
        attachments: {},
      }),
    /유효하지 않은 QR/,
  );
});

test('스키마 버전·school_id가 기록된다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  seedSchool(api, { adminEmail: ADMIN });
  assert.equal(api.setting_('schema_version', ''), '1.1.0');
  assert.match(api.setting_('school_id', ''), /^school_/);
});

test('소유자 키 발급 함수는 키 문자열을 반환한다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  api.ensureSheets_();
  api.seedDefaults_();
  const key = api.showSetupKeyForOwner();
  assert.match(key, /^[0-9a-f]{40,}$/);
});

test('바인딩 ID가 잘못되면 명확한 오류를 낸다', () => {
  const { api } = loadGas({ activeEmail: ADMIN, effectiveEmail: ADMIN });
  seedSchool(api, { adminEmail: ADMIN });
  api.setSchoolProp_('spreadsheet_id', 'ss_missing');
  assert.throws(() => api.ss_(), /바인딩 ID 오류/);
});

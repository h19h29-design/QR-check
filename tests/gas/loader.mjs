// tests/gas/loader.mjs — apps-script/*.gs를 vm 컨텍스트에 적재
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createGasContext } from './stubs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(here, '..', '..', 'apps-script');

const LOAD_ORDER = [
  'Code.gs',
  'SchoolConfig.gs',
  'SchemaMigrations.gs',
  'Sheets.gs',
  'Auth.gs',
  'DriveFiles.gs',
  'Submit.gs',
  'QrTokens.gs',
  'Admin.gs',
  'Api.gs',
  'DesktopSync.gs',
  'Templates.gs',
];

/** GAS 컨텍스트를 만들고 .gs 전부를 실행한 뒤 { ctx, api } 반환 */
export function loadGas(options) {
  const sandbox = createGasContext(options);
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const name of LOAD_ORDER) {
    const code = fs.readFileSync(path.join(APP_DIR, name), 'utf8');
    vm.runInContext(code, ctx, { filename: name });
  }
  const api = vm.runInContext(
    `({
      // Sheets/Config
      ensureSheets_, seedDefaults_, ss_, getSpreadsheet_, setSchoolProp_,
      readTable_, appendObject_, upsertObject_, findBy_, setting_, setSetting_,
      ensureSchemaVersion_, saveState_, tokenVersion_, canonicalJson_, submissionDigest_,
      // Auth
      activeEmail_, isAdminEmail_, verifyAdmin_, requireAdmin_, adminAuthMode_,
      createInitialSetupKey, hashToken_,
      // Submit
      submitInspection_, prepareSubmission_, normalizeStatus_, validateRoomToken_,
      roomToken_, ensureQrSecret_,
      // Admin
      saveRoomFromAdmin_, reissueRoomTokenFromAdmin_, adminListRooms_,
      adminListSubmissions_, adminVerifyRecord_,
      adminListPartials_, adminReconcileRecord_, adminDiscardPartial_,
      // Api
      initializeSchoolStorage_,
      // misc
      nowIso_, today_, uuid_
    })`,
    ctx,
  );
  return { ctx, api, stubs: sandbox.__stubs };
}

/** 관리자 1명 + 실 1곳 + 담당자 1명의 최소 운영 상태로 만든다 */
export function seedSchool(api, { adminEmail = 'owner201@test.example', roomName = '3-1반' } = {}) {
  api.ensureSheets_();
  api.seedDefaults_();
  const key = api.createInitialSetupKey();
  const setup = api.initializeSchoolStorage_({
    setupKey: key,
    school_name: '테스트학교',
    admin_email: adminEmail,
    admin_name: '관리자',
  });
  const room = api.saveRoomFromAdmin_({ room_name: roomName, room_order: 10 });
  const personId = 'person_duty_1';
  api.upsertObject_(
    'settings_people',
    {
      person_id: personId, person_name: '당직자', role_type: 'duty',
      room_id: room.room.room_id, active: true, sort_order: 10,
      created_at: api.nowIso_(), updated_at: api.nowIso_(),
    },
    'person_id',
  );
  return { setup, room, personId };
}

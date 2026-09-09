// tests/gas/setup-binding-safety.test.mjs
// Owner-only first-setup binding safety (synthetic in-memory fixtures only, no live Google).
// Loader uses only ./stubs.mjs + real apps-script/*.gs via node:vm. Mocks GAS boundaries only.
// Fresh synthetic setup keys are generated in memory and never printed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createGasContext } from './stubs.mjs';

const OWNER = 'owner@example.com';
const ATTACKER = 'attacker@example.com';
const ACTIVE_ID = 'ss_active_1';

const GS_FILES = [
  'Code.gs',
  'Auth.gs',
  'SchoolConfig.gs',
  'Sheets.gs',
  'DriveFiles.gs',
  'QrTokens.gs',
  'SchemaMigrations.gs',
  'Api.gs',
];

function loadGas({ activeEmail = '', effectiveEmail = '', driveOwners = {}, failLock = false } = {}) {
  const sandbox = createGasContext({ activeEmail, effectiveEmail });
  const origGetFileById = sandbox.DriveApp.getFileById;
  // Fixture override solely to implement documented getOwner().getEmail for synthetic sheets.
  sandbox.DriveApp.getFileById = (id) => {
    if (Object.prototype.hasOwnProperty.call(driveOwners, id)) {
      const v = driveOwners[id];
      if (v && typeof v === 'object' && v.__inaccessible) {
        throw new Error('Drive file inaccessible: ' + id);
      }
      if (v === null || v === undefined) {
        return {
          getId: () => id,
          getUrl: () => 'https://drive.google.com/file/d/' + id + '/view',
          setTrashed: () => {},
          getOwner: () => null,
        };
      }
      return {
        getId: () => id,
        getUrl: () => 'https://drive.google.com/file/d/' + id + '/view',
        setTrashed: () => {},
        getOwner: () => ({ getEmail: () => v }),
      };
    }
    return origGetFileById(id);
  };
  if (failLock) {
    sandbox.LockService.getScriptLock = () => ({
      waitLock: () => { throw new Error('lock timeout: simulated contention'); },
      releaseLock: () => {},
    });
  }
  const ctx = vm.createContext(sandbox);
  for (const f of GS_FILES) {
    const code = fs.readFileSync(new URL(`../../apps-script/${f}`, import.meta.url), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  assert.equal(typeof sandbox.initializeSchoolStorage_, 'function', 'loader must expose real initializeSchoolStorage_');
  return sandbox;
}

function snapshotState(sandbox) {
  const props = Object.fromEntries([...sandbox.__stubs.props.entries()]);
  const sheets = {};
  for (const [id, ss] of sandbox.__stubs.spreadsheets.entries()) {
    const names = [...ss.sheets.keys()].sort();
    const grids = {};
    for (const [name, sheet] of ss.sheets.entries()) {
      grids[name] = JSON.parse(JSON.stringify(sheet.grid || []));
    }
    sheets[id] = { names, grids };
  }
  const folderIds = [...sandbox.__stubs.folders.keys()].sort();
  const folderNames = {};
  for (const [id, f] of sandbox.__stubs.folders.entries()) {
    try { folderNames[id] = f.getName(); } catch { folderNames[id] = ''; }
  }
  return { props, sheets, folderIds, folderNames };
}

function mintSetupKey(sandbox, owner) {
  sandbox.__stubs.setEmails(owner, owner);
  const key = sandbox.createInitialSetupKey();
  assert.ok(key && typeof key === 'string' && key.length > 16);
  return key;
}

function validPayload({ setupKey, adminEmail = OWNER, schoolName = '테스트학교', spreadsheetId, rooms } = {}) {
  const p = {};
  if (setupKey !== undefined) p.setupKey = setupKey;
  if (adminEmail !== undefined) p.admin_email = adminEmail;
  if (schoolName !== undefined) p.school_name = schoolName;
  if (spreadsheetId !== undefined) p.spreadsheet_id = spreadsheetId;
  if (rooms !== undefined) p.rooms = rooms;
  else p.rooms = ['회의실1'];
  return p;
}

function sheetNamesOf(sandbox, id) {
  const ss = sandbox.__stubs.spreadsheets.get(id);
  if (!ss) return null;
  return [...ss.sheets.keys()].sort();
}

function seedBoundCompleted(sandbox, boundId) {
  // Minimal existing deployment: bound sheet claims setup_completed=true.
  let ss = sandbox.__stubs.spreadsheets.get(boundId);
  if (!ss) ss = sandbox.SpreadsheetApp.__createSpreadsheet(boundId);
  let sheet = ss.getSheetByName('settings_school');
  if (!sheet) sheet = ss.insertSheet('settings_school');
  sheet.grid = [['key', 'value'], ['setup_completed', 'true'], ['school_name', '기존학교']];
  let admins = ss.getSheetByName('settings_admins');
  if (!admins) admins = ss.insertSheet('settings_admins');
  if (admins.grid.length === 0) {
    admins.grid = [
      ['admin_id', 'email', 'name', 'role', 'active', 'created_at', 'updated_at'],
      ['admin_owner', OWNER, '관리자', 'owner', true, 't', 't'],
    ];
  }
  sandbox.__stubs.props.set('spreadsheet_id', boundId);
}

describe('setup binding safety (owner-only first-setup pilot)', () => {
  it('(1a) blank server identity with valid key is rejected with zero mutations', () => {
    const targetId = 'ss_target_1a';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails('', '');
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(키|소유|owner|admin|관리자|이메일|email|권한|계정|login|google)/i);
    const after = snapshotState(sb);
    assert.deepEqual(after.props, before.props, 'no property mutations on auth failure');
    assert.deepEqual(after.sheets, before.sheets, 'no tab/seed mutations on auth failure');
    assert.deepEqual(after.folderIds, before.folderIds, 'no folder mutations on auth failure');
  });

  it('(1b) non-owner server identity is rejected even with valid key and matching submitted admin', () => {
    const targetId = 'ss_target_1b';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    // Attacker-controlled server: active==effective==attacker, admin matches session but not file owner.
    sb.__stubs.setEmails(ATTACKER, ATTACKER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: ATTACKER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(키|소유|owner|admin|관리자|이메일|email|권한|바인딩|binding|drive|연결)/i);
    const after = snapshotState(sb);
    assert.deepEqual(after.props, before.props);
    assert.deepEqual(after.sheets, before.sheets);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(1c) owner session with mismatched submitted admin_email is rejected (never trust submitted email)', () => {
    const targetId = 'ss_target_1c';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: ATTACKER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(소유|owner|admin|관리자|이메일|email|권한|키|key)/i);
    const after = snapshotState(sb);
    assert.deepEqual(after.props, before.props);
    assert.deepEqual(after.sheets, before.sheets);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(1d) active != effective is rejected even with valid key', () => {
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER });
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, ATTACKER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(소유|owner|이메일|email|키|key|admin|관리자|권한|계정)/i);
    const after = snapshotState(sb);
    assert.deepEqual(after.props, before.props);
    assert.deepEqual(after.sheets, before.sheets);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(2) existing nonempty binding never changes via setup payload, even with valid regenerated key', () => {
    const boundId = 'ss_bound_2';
    const evilId = 'ss_evil_2';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [boundId]: OWNER, [evilId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(boundId);
    sb.SpreadsheetApp.__createSpreadsheet(evilId);
    seedBoundCompleted(sb, boundId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '새학교', spreadsheetId: evilId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(바인딩|binding|spreadsheet|시트|연결|소유|owner)/i);
    const after = snapshotState(sb);
    assert.equal(after.props['spreadsheet_id'], boundId, 'binding must remain original');
    assert.deepEqual(after.sheets[boundId], before.sheets[boundId], 'original sheet untouched');
    assert.deepEqual(after.sheets[evilId], before.sheets[evilId], 'requested sheet untouched');
    assert.deepEqual(after.folderIds, before.folderIds, 'no folders on binding rejection');
  });

  it('(3) lock acquisition failure happens before any binding mutation', () => {
    const targetId = 'ss_target_3';
    // Create target first without failing lock, then re-inject failing lock for the call.
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    sb.LockService.getScriptLock = () => ({
      waitLock: () => { throw new Error('lock timeout: simulated contention'); },
      releaseLock: () => {},
    });
    const before = snapshotState(sb);
    assert.ok(!before.props['spreadsheet_id'], 'precondition: no binding yet');
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(lock|잠금|timeout|획득)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id'], 'no binding persisted when lock fails');
    assert.deepEqual(after.props, before.props);
    assert.deepEqual(after.sheets, before.sheets);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(4a) missing school_name fails before tabs/folders/binding', () => {
    const targetId = 'ss_target_4a';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '', spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(학교|입력|필요|school)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id'], 'no binding on invalid input');
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId]);
    assert.deepEqual(after.sheets[ACTIVE_ID], before.sheets[ACTIVE_ID]);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(4b) malformed admin_email fails before tabs/folders/binding', () => {
    const targetId = 'ss_target_4b';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: 'not-an-email', schoolName: '테스트학교', spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(이메일|형식|입력|email|관리자)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id']);
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId]);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(4c) room name >80 fails before tabs/folders/binding', () => {
    const targetId = 'ss_target_4c';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId, rooms: ['x'.repeat(81)] });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(장소|80|입력|room)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id']);
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId]);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(5a) missing target spreadsheet is rejected with no binding', () => {
    const missingId = 'ss_missing_5a';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [missingId]: { __inaccessible: true } } });
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: missingId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(바인딩|binding|소유|owner|drive|시트|연결|spreadsheet|찾을|없)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id'], 'missing target must not bind');
    assert.deepEqual(after.folderIds, before.folderIds);
    assert.deepEqual(after.sheets, before.sheets);
  });

  it('(5b) target owned by someone else is rejected with no binding', () => {
    const targetId = 'ss_target_5b';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: ATTACKER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(소유|owner|바인딩|binding|drive|연결|권한)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id']);
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId], 'unowned target untouched');
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(5c) null-owner target is rejected with no binding', () => {
    const targetId = 'ss_target_5c';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: null } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(소유|owner|바인딩|binding|drive|연결)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id']);
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId]);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(5d) inaccessible Drive file for target is rejected with no binding', () => {
    const targetId = 'ss_target_5d';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: { __inaccessible: true } } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(소유|owner|바인딩|binding|drive|연결|시트)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id']);
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId]);
    assert.deepEqual(after.folderIds, before.folderIds);
  });

  it('(6) existing bound read failure fails closed even with valid key (no seed writes, no rebinding)', () => {
    const boundId = 'ss_bound_6';
    const otherId = 'ss_other_6';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [boundId]: OWNER, [otherId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(boundId);
    sb.SpreadsheetApp.__createSpreadsheet(otherId);
    seedBoundCompleted(sb, boundId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const origOpen = sb.SpreadsheetApp.openById;
    sb.SpreadsheetApp.openById = (id) => {
      if (id === boundId) throw new Error('school sheet unreadable (simulated bound read failure)');
      return origOpen(id);
    };
    const before = snapshotState(sb);
    // Valid key + valid owner/admin/input but existing binding is unreadable; must not fall back to first-setup.
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '새학교', spreadsheetId: otherId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(바인딩|binding|연결|시트|읽|연결|drive|소유)/i);
    const after = snapshotState(sb);
    assert.equal(after.props['spreadsheet_id'], boundId, 'must not rebind when existing bound read fails');
    // Other target untouched (no seed writes there either).
    assert.deepEqual(after.sheets[otherId], before.sheets[otherId], 'no seed writes to new target on fail-closed');
    assert.deepEqual(after.folderIds, before.folderIds, 'no folders on fail-closed');
  });

  it('(7) good standalone owner explicit target binds/populates that target only, clears key, returns setup_completed', () => {
    const targetId = 'ss_target_7';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const beforeActive = sheetNamesOf(sb, ACTIVE_ID);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '파일럿학교', spreadsheetId: targetId, rooms: ['회의실1', '회의실2'] });
    const res = sb.initializeSchoolStorage_(payload);
    assert.equal(res && res.setup_completed, true);
    assert.equal(sb.__stubs.props.get('spreadsheet_id'), targetId);
    assert.equal(sb.__stubs.props.get('initial_setup_key_hash'), undefined, 'initial key must be cleared');
    const targetNames = sheetNamesOf(sb, targetId);
    assert.ok(targetNames.includes('settings_school') && targetNames.includes('settings_admins'));
    const activeNames = sheetNamesOf(sb, ACTIVE_ID);
    assert.deepEqual(activeNames, beforeActive, 'active spreadsheet must stay untouched for standalone target');
    assert.ok(sb.__stubs.folders.size > 1, 'folders created on success');
  });

  it('(8a) container-active owner path still succeeds (legacy, no explicit id)', () => {
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER });
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '컨테이너학교' });
    const res = sb.initializeSchoolStorage_(payload);
    assert.equal(res && res.setup_completed, true);
    assert.equal(sb.__stubs.props.get('spreadsheet_id'), ACTIVE_ID);
    assert.equal(sb.__stubs.props.get('initial_setup_key_hash'), undefined);
    const names = sheetNamesOf(sb, ACTIVE_ID);
    assert.ok(names.includes('settings_school'));
  });

  it('(8b) existing authorized admin path is retained after setup (no setup key needed)', () => {
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER });
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const first = sb.initializeSchoolStorage_(validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '유지학교' }));
    assert.equal(first && first.setup_completed, true);
    // Second call as already-authorized admin without any setup key.
    sb.__stubs.setEmails(OWNER, OWNER);
    const foldersBefore = sb.__stubs.folders.size;
    const second = sb.initializeSchoolStorage_({ school_name: '유지학교2', admin_email: OWNER, rooms: [] });
    assert.equal(second && second.setup_completed, true);
    assert.equal(sb.__stubs.props.get('spreadsheet_id'), ACTIVE_ID, 'binding retained');
    assert.ok(sb.__stubs.folders.size >= foldersBefore);
  });

  it('(6b) bound same-ID transient read failure fails closed (fail-once getValues)', () => {
    const boundId = 'ss_bound_6b';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [boundId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(boundId);
    seedBoundCompleted(sb, boundId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const schoolSheet = sb.__stubs.spreadsheets.get(boundId).getSheetByName('settings_school');
    const origGetDataRange = schoolSheet.getDataRange.bind(schoolSheet);
    let getValuesCalls = 0;
    schoolSheet.getDataRange = () => {
      const range = origGetDataRange();
      const origGetValues = range.getValues.bind(range);
      range.getValues = () => {
        getValuesCalls += 1;
        if (getValuesCalls === 1) throw new Error('settings_school unreadable (simulated transient read failure)');
        return origGetValues();
      };
      return range;
    };
    const before = snapshotState(sb);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '새학교', spreadsheetId: boundId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(바인딩|binding|연결|시트|읽|read|실패|fail|drive|소유|owner)/i);
    const after = snapshotState(sb);
    assert.equal(after.props['spreadsheet_id'], boundId, 'binding must remain original on transient read failure');
    assert.deepEqual(after.props, before.props, 'no property mutations on fail-closed');
    assert.deepEqual(after.sheets, before.sheets, 'no sheet mutations on fail-closed');
    assert.deepEqual(after.folderIds, before.folderIds, 'no folders on fail-closed');
    assert.ok(Array.isArray(schoolSheet.getDataRange().getValues()), 'transient failure: subsequent read succeeds');
  });

  it('(9) unbound script must not adopt already-initialized owned target', () => {
    const targetId = 'ss_target_9';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    seedBoundCompleted(sb, targetId);
    sb.__stubs.props.delete('spreadsheet_id');
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const before = snapshotState(sb);
    assert.ok(!before.props['spreadsheet_id'], 'precondition: fresh unbound script');
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '새학교', spreadsheetId: targetId });
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(바인딩|binding|완료|completed|이미|already|초기|initial|소유|owner|연결|adopt)/i);
    const after = snapshotState(sb);
    assert.ok(!after.props['spreadsheet_id'], 'must not bind an already-initialized school');
    assert.deepEqual(after.props, before.props, 'no property mutations on adoption rejection');
    assert.deepEqual(after.sheets[targetId], before.sheets[targetId], 'initialized target untouched');
    assert.deepEqual(after.folderIds, before.folderIds, 'no folders on adoption rejection');
  });

  it('(10) container binding write failure must throw without clearing key or completing setup', () => {
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER });
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const origGetScriptProperties = sb.PropertiesService.getScriptProperties.bind(sb.PropertiesService);
    sb.PropertiesService.getScriptProperties = () => {
      const real = origGetScriptProperties();
      const origSetProperty = real.setProperty.bind(real);
      real.setProperty = (k, v) => {
        if (k === 'spreadsheet_id') throw new Error('synthetic binding write failure');
        return origSetProperty(k, v);
      };
      return real;
    };
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '테스트학교' });
    assert.throws(() => sb.initializeSchoolStorage_(payload));
    assert.ok(sb.__stubs.props.get('initial_setup_key_hash'), 'setup key hash must remain when binding write fails');
    const activeSs = sb.__stubs.spreadsheets.get(ACTIVE_ID);
    const schoolSheet = activeSs ? activeSs.sheets.get('settings_school') : undefined;
    let completed = false;
    if (schoolSheet && Array.isArray(schoolSheet.grid)) {
      for (const row of schoolSheet.grid) {
        if (row && row[0] === 'setup_completed' && String(row[1]).toLowerCase() === 'true') {
          completed = true;
          break;
        }
      }
    }
    assert.equal(completed, false, 'setup_completed must not be true when binding write fails');
  });
});

describe('setup replay/unknown-outcome latch (additive)', () => {
  it('(11) consumed initial key replay rejects with guidance and no mutations', () => {
    const targetId = 'ss_target_11';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, spreadsheetId: targetId, rooms: ['회의실1'] });
    const first = sb.initializeSchoolStorage_(payload);
    assert.equal(first && first.setup_completed, true);
    const completed = snapshotState(sb);
    assert.equal(sb.__stubs.props.get('initial_setup_key_hash'), undefined);
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(이미|완료|complete|already|키|key|초기|initial)/i);
    const after = snapshotState(sb);
    assert.deepEqual(after.props, completed.props);
    assert.deepEqual(after.sheets, completed.sheets);
    assert.deepEqual(after.folderIds, completed.folderIds);
  });
  it('(12) unknown transport outcome latches retry before further mutations (no rollback claim)', () => {
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER });
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const payload = validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '테스트학교' });
    const origCreate = sb.DriveApp.createFolder;
    let calls = 0;
    sb.DriveApp.createFolder = (name) => {
      calls += 1;
      const f = origCreate(name);
      if (calls === 1) throw new Error('synthetic transport outcome unknown: result uncertain');
      return f;
    };
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(synthetic|transport|unknown|uncertain|실패|전송|불확)/i);
    const afterFailure = snapshotState(sb);
    sb.DriveApp.createFolder = origCreate;
    sb.__stubs.setEmails(OWNER, OWNER);
    assert.throws(() => sb.initializeSchoolStorage_(payload), /(중단|알 수|unknown|uncertain|재시도|확인|초기|완료|실패|complete|interrupted)/i);
    const afterRetry = snapshotState(sb);
    assert.deepEqual(afterRetry.props, afterFailure.props);
    assert.deepEqual(afterRetry.sheets, afterFailure.sheets);
    assert.deepEqual(afterRetry.folderIds, afterFailure.folderIds);
  });
  it('(13) normal success leaves no blocker for authorized no-key reconfigure (standalone target)', () => {
    const targetId = 'ss_target_13';
    const sb = loadGas({ activeEmail: OWNER, effectiveEmail: OWNER, driveOwners: { [targetId]: OWNER } });
    sb.SpreadsheetApp.__createSpreadsheet(targetId);
    const key = mintSetupKey(sb, OWNER);
    sb.__stubs.setEmails(OWNER, OWNER);
    const first = sb.initializeSchoolStorage_(validPayload({ setupKey: key, adminEmail: OWNER, schoolName: '파일럿학교', spreadsheetId: targetId, rooms: ['회의실1'] }));
    assert.equal(first && first.setup_completed, true);
    sb.__stubs.setEmails(OWNER, OWNER);
    const second = sb.initializeSchoolStorage_({ school_name: '파일럿학교2', admin_email: OWNER, rooms: [] });
    assert.equal(second && second.setup_completed, true);
    assert.equal(sb.__stubs.props.get('spreadsheet_id'), targetId);
  });
});

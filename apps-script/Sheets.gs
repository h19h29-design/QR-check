const SHEET_SCHEMAS = {
  settings_school: ['key', 'value'],
  settings_admins: ['admin_id', 'email', 'name', 'role', 'active', 'created_at', 'updated_at'],
  settings_rooms: ['room_id', 'room_name', 'room_order', 'submit_token_hash', 'active', 'created_at', 'updated_at', 'token_version'],
  settings_people: ['person_id', 'person_name', 'role_type', 'room_id', 'active', 'sort_order', 'created_at', 'updated_at'],
  settings_check_items: ['item_id', 'item_key', 'item_name', 'sort_order', 'active', 'created_at', 'updated_at'],
  submissions: [
    'record_id', 'submitted_at', 'inspection_date', 'room_id', 'room_name', 'person_id', 'person_name',
    'role_type', 'status_json', 'abnormal', 'remarks', 'client_info', 'source', 'admin_verified',
    'admin_verified_by', 'admin_verified_at', 'admin_memo', 'desktop_synced', 'desktop_synced_at',
    'created_at', 'updated_at', 'payload_digest', 'observed_at', 'submit_snapshot', 'save_state'
  ],
  attachments: ['attachment_id', 'record_id', 'item_key', 'file_name', 'mime_type', 'file_size', 'drive_file_id', 'drive_url', 'created_at'],
  audit_log: ['log_id', 'created_at', 'actor', 'action', 'target_type', 'target_id', 'detail_json']
};

const DEFAULT_ITEMS = [
  ['item_document', 'document', '서류보관상태', 10, true],
  ['item_cleaning', 'cleaning', '청소상태', 20, true],
  ['item_lighting', 'lighting', '소등상태', 30, true],
  ['item_fire', 'fire', '화기단속상태', 40, true],
  ['item_door', 'door', '문단속상태', 50, true]
];

function ss_() {
  return getSpreadsheet_();
}

function ensureSheets_() {
  const ss = ss_();
  Object.keys(SHEET_SCHEMAS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = SHEET_SCHEMAS[name];
    const current = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
    let needsHeader = false;
    for (let i = 0; i < headers.length; i++) {
      if (current[i] !== headers[i]) needsHeader = true;
    }
    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function sheet_(name) {
  ensureSheets_();
  return ss_().getSheetByName(name);
}

function readTable_(name) {
  const sheet = sheet_(name);
  const headers = SHEET_SCHEMAS[name];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function(row) { return row.some(function(v) { return v !== ''; }); })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function appendObject_(name, obj) {
  const sheet = sheet_(name);
  const headers = SHEET_SCHEMAS[name];
  sheet.appendRow(headers.map(function(h) { return safeSheetCell_(obj[h]); }));
}

function upsertObject_(name, obj, keyName) {
  const sheet = sheet_(name);
  const headers = SHEET_SCHEMAS[name];
  const values = sheet.getDataRange().getValues();
  const keyIndex = headers.indexOf(keyName);
  if (keyIndex < 0) throw new Error('키 컬럼이 없습니다: ' + keyName);
  for (let r = 1; r < values.length; r++) {
    if (values[r][keyIndex] === obj[keyName]) {
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([headers.map(function(h) { return safeSheetCell_(obj[h]); })]);
      return;
    }
  }
  appendObject_(name, obj);
}

function safeSheetCell_(value) {
  if (value == null) return '';
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function findBy_(name, key, value) {
  return readTable_(name).find(function(row) { return String(row[key]) === String(value); }) || null;
}

function setting_(key, defaultValue) {
  const row = findBy_('settings_school', 'key', key);
  return row ? row.value : defaultValue;
}

function setSetting_(key, value) {
  upsertObject_('settings_school', { key: key, value: value }, 'key');
}

function seedDefaults_() {
  const now = nowIso_();
  const schoolDefaults = {
    school_name: '샘플학교',
    timezone: TIMEZONE,
    apps_script_version: APP_VERSION,
    drive_folder_id: '',
    uploads_folder_id: '',
    exports_folder_id: '',
    sync_key_hash: '',
    created_at: now,
    updated_at: now
  };
  Object.keys(schoolDefaults).forEach(function(key) {
    if (!findBy_('settings_school', 'key', key)) setSetting_(key, schoolDefaults[key]);
  });
  DEFAULT_ITEMS.forEach(function(item) {
    if (!findBy_('settings_check_items', 'item_key', item[1])) {
      appendObject_('settings_check_items', {
        item_id: item[0],
        item_key: item[1],
        item_name: item[2],
        sort_order: item[3],
        active: item[4],
        created_at: now,
        updated_at: now
      });
    }
  });
  ensureSchemaVersion_();
}

function bootstrapForClient_() {
  ensureSheets_();
  seedDefaults_();
  return {
    school: tableToSettings_(readTable_('settings_school')),
    server_date: today_(),
    server_time: nowIso_(),
    rooms: readTable_('settings_rooms').filter(activeRow_),
    people: readTable_('settings_people').filter(activeRow_),
    items: readTable_('settings_check_items').filter(activeRow_)
      .sort(function(a, b) { return Number(a.sort_order) - Number(b.sort_order); })
  };
}

function publicSchoolSettings_(settings) {
  settings = settings || {};
  return {
    school_name: settings.school_name || '',
    timezone: settings.timezone || TIMEZONE,
    apps_script_version: settings.apps_script_version || APP_VERSION
  };
}

function activeRow_(row) {
  return row.active === true || row.active === 'TRUE' || row.active === 'true' || row.active === 1 || row.active === '1';
}

function tableToSettings_(rows) {
  const obj = {};
  rows.forEach(function(row) { obj[row.key] = row.value; });
  return obj;
}

function logAudit_(actor, action, targetType, targetId, detail) {
  appendObject_('audit_log', {
    log_id: uuid_('log'),
    created_at: nowIso_(),
    actor: actor || '',
    action: action || '',
    target_type: targetType || '',
    target_id: targetId || '',
    detail_json: JSON.stringify(detail || {})
  });
}

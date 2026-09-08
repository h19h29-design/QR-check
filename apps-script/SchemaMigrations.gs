/**
 * SchemaMigrations.gs — 부가 변경(additive-only) 스키마 이관 (Phase 1)
 *
 * 원칙:
 * - 기존 컬럼 순서·데이터를 건드리지 않는다. 새 컬럼은 항상末尾(끝)에 추가한다.
 * - 기존 행의 빈 칸은 코드에서 기본값으로 해석한다(lazy default). 대량 backfill을 하지 않는다.
 * - ensureSchemaVersion_()은 버전 키가 다를 때만 가벼운 키 초기화를 수행한다.
 */

function ensureSchemaVersion_() {
  var current = setting_('schema_version', '');
  if (current === SCHEMA_VERSION) return { migrated: false, version: current };
  var now = nowIso_();
  if (!setting_('school_id', '')) {
    setSetting_('school_id', uuid_('school'));
  }
  if (!setting_('created_at', '')) setSetting_('created_at', now);
  setSetting_('updated_at', now);
  setSetting_('schema_version', SCHEMA_VERSION);
  // 신규 설치 기본값. 기존 설치는 verifyAdmin 호환 모드를 유지한다(ADR 결정 1).
  if (!setting_('admin_auth_mode', '')) {
    setSetting_('admin_auth_mode', setting_('setup_completed', '') === 'true' ? 'token_compat' : 'google_only');
  }
  return { migrated: true, from: current || '(none)', to: SCHEMA_VERSION };
}

/** submissions.save_state 빈 값의 해석. */
function saveState_(row) {
  var v = row && row.save_state ? String(row.save_state) : '';
  return v || 'COMMITTED';
}

/** settings_rooms.token_version 빈 값의 해석. */
function tokenVersion_(room) {
  var v = room && room.token_version != null && room.token_version !== '' ? Number(room.token_version) : 1;
  return isNaN(v) || v < 1 ? 1 : Math.floor(v);
}

/** 표준 JSON 정형화(키 정렬). payload digest·snapshot 공용. */
function canonicalJson_(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson_).join(',') + ']';
  }
  if (typeof value === 'object') {
    var keys = Object.keys(value).sort();
    return '{' + keys.map(function(k) { return JSON.stringify(k) + ':' + canonicalJson_(value[k]); }).join(',') + '}';
  }
  return JSON.stringify(value);
}

/** 제출 내용 다이제스트. 첨부 원문 식별은 content_sha256으로 계산한다. */
function submissionDigest_(parts) {
  return sha256_(canonicalJson_(parts || {}));
}

/** 첨부 base64 원문 식별용 SHA-256 hex (GAS 호환). sha256_ 재사용, 중복 정의 금지. */
function contentSha256Hex_(value) {
  var text = String(value == null ? '' : value);
  if (typeof sha256_ === 'function') return sha256_(text);
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

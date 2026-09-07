/**
 * SchoolConfig.gs — 학교별 바인딩 설정 (Phase 1)
 *
 * - 이 스크립트가 어떤 학교 Sheet에 묶여 있는지 ScriptProperties + settings_school로 고정한다.
 * - 요청마다 클라이언트가 보낸 임의 spreadsheet ID를 사용하지 않는다.
 * - getSpreadsheet_()가 ss_()를 대체한다. ss_()는 하위 호환용으로 남긴다.
 */

var SCHEMA_VERSION = '1.1.0';

function schoolProp_(key, defaultValue) {
  try {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    return value == null || value === '' ? defaultValue : value;
  } catch (err) {
    return defaultValue;
  }
}

function setSchoolProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value == null ? '' : value));
}

/**
 * 이 배포가 사용할 스프레드시트를 반환한다.
 * 바인딩 기준은 ScriptProperties.spreadsheet_id 하나뿐이다.
 * 요청 본문의 임의 ID, settings_school의 정보성 복사본으로는 시트를 열지 않는다.
 * (settings를 읽으려면 시트가 먼저 필요하므로 위치 특정에 쓸 수 없다.)
 */
function getSpreadsheet_() {
  var boundId = schoolProp_('spreadsheet_id', '');
  if (boundId) {
    try {
      return SpreadsheetApp.openById(boundId);
    } catch (err) {
      throw new Error('학교 데이터 시트에 연결할 수 없습니다. 관리자에게 문의하세요. (바인딩 ID 오류)');
    }
  }
  var active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    active = null;
  }
  if (active) return active;
  throw new Error('학교 데이터 시트가 연결되어 있지 않습니다. 설치를 먼저 완료하세요.');
}

/** 현재 바인딩 정보를 반환한다. 임의 ID 교체 요청은 받지 않는다. */
function describeBinding_() {
  return {
    has_bound_id: !!(schoolProp_('spreadsheet_id', '') || setting_('spreadsheet_id', '')),
    school_id: setting_('school_id', ''),
    schema_version: setting_('schema_version', ''),
    school_name: setting_('school_name', '')
  };
}

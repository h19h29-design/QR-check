/**
 * installer/demo/sample-store.mjs
 *
 * Pure in-memory synthetic demo store for sample体验 UI and tests.
 * - No DOM, network, storage, timers, randomness, or external packages.
 * - All records are explicitly fictional virtual data.
 * - Never triggers a download; CSV export returns a string only.
 * - Copy-in / copy-out so callers cannot mutate internal state.
 * - Deterministic IDs and timestamps: caller-supplied or deterministic defaults.
 */

/** Exact banner text required for the demo experience. */
export const SAMPLE_BANNER = `샘플 체험 — 실제 학교에 저장되지 않습니다`;

const SAMPLE_WARNING_CSV_LINE =
  `# 경고: 이 CSV는 샘플 체험용 가상 데이터이며 실제 학교에 저장되지 않습니다.`;

const DEFAULT_CREATED_AT = '2026-04-27T09:00:00+09:00';
const DEFAULT_CONFIRM_TIME = '2026-04-27T18:00:00+09:00';
const SEED_INSPECTION_DATE = '2026-04-26';

const ALLOWED_ROLES = ['responsible', 'duty'];
const ALLOWED_STATUS = ['OK', 'ISSUE'];
const MAX_NOTES_LENGTH = 1000;
const MAX_LABEL_LENGTH = 120;
const MAX_NAME_LENGTH = 100;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizePrefix(seed) {
  if (typeof seed !== 'string' || seed.trim() === '') {
    return 'sample';
  }
  const cleaned = seed.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  return cleaned === '' ? 'sample' : cleaned;
}

function pad2(n) {
  const s = String(n);
  return s.length >= 2 ? s : `0${s}`;
}

function cloneRecord(record) {
  return {
    id: record.id,
    inspectionDate: record.inspectionDate,
    placeId: record.placeId,
    placeName: record.placeName,
    personId: record.personId,
    personName: record.personName,
    role: record.role,
    status: record.status,
    checks: { ...record.checks },
    notes: record.notes,
    attachmentLabel: record.attachmentLabel,
    confirmed: record.confirmed,
    confirmedBy: record.confirmedBy,
    confirmedAt: record.confirmedAt,
    createdAt: record.createdAt,
    synthetic: true,
    source: 'sample',
  };
}

function neutralizeFormulaPrefix(text) {
  const s = String(text);
  if (/^[=+\-@]/.test(s) || /^\s*[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function quoteCsvCell(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  const text = neutralizeFormulaPrefix(raw);
  return `"${text.replace(/"/g, '""')}"`;
}

function validateDateString(value, fieldName) {
  if (!isNonEmptyString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`${fieldName}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return value.trim();
}

function validateRole(value) {
  if (!isNonEmptyString(value) || !ALLOWED_ROLES.includes(value.trim())) {
    throw new Error(`role은 ${ALLOWED_ROLES.join('/')} 중 하나여야 합니다.`);
  }
  return value.trim();
}

function validateStatus(value) {
  if (!isNonEmptyString(value) || !ALLOWED_STATUS.includes(value.trim())) {
    throw new Error(`status는 ${ALLOWED_STATUS.join('/')} 중 하나여야 합니다.`);
  }
  return value.trim();
}

function validateName(value, fieldName) {
  if (!isNonEmptyString(value) || value.trim().length > MAX_NAME_LENGTH) {
    throw new Error(`${fieldName}은 1-${MAX_NAME_LENGTH}자 문자열이어야 합니다.`);
  }
  return value.trim();
}

function validateNotes(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error('notes는 문자열이어야 합니다.');
  }
  if (value.length > MAX_NOTES_LENGTH) {
    throw new Error(`notes는 ${MAX_NOTES_LENGTH}자 이내여야 합니다.`);
  }
  return value;
}

function validateAttachmentLabel(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error('attachmentLabel은 업로드 없는 문자열 라벨만 허용됩니다.');
  }
  const label = value.trim();
  if (label.length > MAX_LABEL_LENGTH) {
    throw new Error(`attachmentLabel은 ${MAX_LABEL_LENGTH}자 이내여야 합니다.`);
  }
  const lowered = label.toLowerCase();
  if (
    lowered.startsWith('data:') ||
    lowered.includes(';base64') ||
    lowered.includes('base64,') ||
    /^[a-z0-9+/=\s]{200,}$/.test(lowered)
  ) {
    throw new Error('파일 내용·base64·바이너리는 저장하지 않습니다. 짧은 라벨만 입력하세요.');
  }
  return label;
}

function rejectBinaryPayload(input) {
  if (input === null || typeof input !== 'object') {
    return;
  }
  const forbiddenKeys = ['file', 'blob', 'binary', 'base64', 'dataUrl', 'arrayBuffer'];
  for (const key of forbiddenKeys) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
      throw new Error('File/Blob/base64/binary 업로드는 허용되지 않습니다.');
    }
  }
  for (const key of Object.keys(input)) {
    const v = input[key];
    if (v !== null && typeof v === 'object' && !(Array.isArray(v) === false && key === 'checks')) {
      if (key !== 'checks') {
        throw new Error('객체 형태의 첨부물은 허용되지 않습니다. 문자열 라벨만 사용하세요.');
      }
    }
  }
}

function buildSeedRecords(prefix) {
  return [
    {
      id: `${prefix}-rec-001`,
      inspectionDate: SEED_INSPECTION_DATE,
      placeId: `${prefix}-room-admin`,
      placeName: '샘플 행정실(가상)',
      personId: `${prefix}-person-manager`,
      personName: '샘플 책임자 A(가상)',
      role: 'responsible',
      status: 'OK',
      checks: {
        document: 'OK',
        cleaning: 'OK',
        lighting: 'OK',
        fire: 'OK',
        door: 'OK',
      },
      notes: '',
      attachmentLabel: '',
      confirmed: false,
      confirmedBy: '',
      confirmedAt: '',
      createdAt: '2026-04-26T09:10:00+09:00',
      synthetic: true,
      source: 'sample',
    },
    {
      id: `${prefix}-rec-002`,
      inspectionDate: SEED_INSPECTION_DATE,
      placeId: `${prefix}-room-print`,
      placeName: '샘플 인쇄실(가상)',
      personId: `${prefix}-person-duty`,
      personName: '샘플 당직자 B(가상)',
      role: 'duty',
      status: 'ISSUE',
      checks: {
        document: 'OK',
        cleaning: 'ISSUE',
        lighting: 'OK',
        fire: 'OK',
        door: 'OK',
      },
      notes: '샘플 청소 상태 확인 필요(가상 기록)',
      attachmentLabel: '샘플 선반 사진 메모(파일 아님)',
      confirmed: false,
      confirmedBy: '',
      confirmedAt: '',
      createdAt: '2026-04-26T18:40:00+09:00',
      synthetic: true,
      source: 'sample',
    },
  ];
}

/**
 * Create a fresh closure-backed synthetic sample store.
 *
 * @param {string} [seed] Optional deterministic prefix for generated IDs.
 * @returns {{
 *   listRecords: (filter?: { inspectionDate?: string, status?: string, confirmed?: boolean }) => Array<object>,
 *   getRecord: (id: string) => object | null,
 *   getDetail: (id: string) => object | null,
 *   submitRecord: (input: object) => object,
 *   confirmRecord: (id: string, options?: { confirmedBy?: string, confirmedAt?: string }) => object,
 *   batchConfirmOkRecords: (options?: { confirmedBy?: string }) => { confirmedIds: string[], skippedIssueIds: string[] },
 *   batchConfirmOk: (options?: { confirmedBy?: string }) => { confirmedIds: string[], skippedIssueIds: string[] },
 *   exportCsv: (filter?: { inspectionDate?: string, status?: string }) => string,
 *   exportSampleCsv: (filter?: { inspectionDate?: string, status?: string }) => string
 * }}
 *
 * Return shapes:
 * - listRecords returns cloned record objects sorted by inspectionDate then id.
 * - getRecord/getDetail returns a cloned record or null.
 * - submitRecord returns the cloned created record.
 * - confirmRecord returns the cloned confirmed record (OK and ISSUE both allowed).
 * - batchConfirmOkRecords confirms only unconfirmed OK records; ISSUE records are
 *   reported in skippedIssueIds and left unconfirmed.
 * - exportCsv returns a synthetic CSV string starting with a Korean warning line.
 */
export function createSampleStore(seed) {
  const prefix = sanitizePrefix(seed);
  const records = new Map();
  for (const rec of buildSeedRecords(prefix)) {
    records.set(rec.id, rec);
  }
  let nextSeq = 3;
  let confirmSeq = 0;

  function deterministicCreatedAt(seq) {
    return `2026-04-27T09:00:${pad2(seq % 60)}+09:00`;
  }

  function deterministicConfirmedAt() {
    confirmSeq += 1;
    return `2026-04-27T18:00:${pad2(confirmSeq % 60)}+09:00`;
  }

  function matchesFilter(record, filter) {
    if (!filter || typeof filter !== 'object') {
      return true;
    }
    if (filter.inspectionDate !== undefined && filter.inspectionDate !== '') {
      if (record.inspectionDate !== String(filter.inspectionDate).trim()) {
        return false;
      }
    }
    if (filter.status !== undefined && filter.status !== '') {
      if (record.status !== String(filter.status).trim()) {
        return false;
      }
    }
    if (filter.confirmed !== undefined && filter.confirmed !== null && filter.confirmed !== '') {
      if (record.confirmed !== Boolean(filter.confirmed)) {
        return false;
      }
    }
    return true;
  }

  function listRecords(filter) {
    const out = [];
    for (const record of records.values()) {
      if (matchesFilter(record, filter)) {
        out.push(cloneRecord(record));
      }
    }
    out.sort((a, b) => {
      if (a.inspectionDate !== b.inspectionDate) {
        return a.inspectionDate < b.inspectionDate ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }

  function getRecord(id) {
    if (!isNonEmptyString(id)) {
      return null;
    }
    const found = records.get(id.trim());
    return found ? cloneRecord(found) : null;
  }

  function submitRecord(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('submitRecord 입력 객체가 필요합니다.');
    }
    rejectBinaryPayload(input);

    const inspectionDate = validateDateString(input.inspectionDate || input.date, 'inspectionDate');
    const placeName = validateName(input.placeName || input.roomName || input.place, 'placeName');
    const personName = validateName(input.personName || input.name, 'personName');
    const role = validateRole(input.role || input.roleType);
    const status = validateStatus(input.status);
    const notes = validateNotes(input.notes !== undefined ? input.notes : input.remarks);
    const attachmentLabel = validateAttachmentLabel(
      input.attachmentLabel !== undefined ? input.attachmentLabel : input.attachment,
    );

    let placeId = `${prefix}-room-custom`;
    if (isNonEmptyString(input.placeId || input.roomId)) {
      placeId = String(input.placeId || input.roomId).trim().slice(0, MAX_NAME_LENGTH);
    }
    let personId = `${prefix}-person-custom`;
    if (isNonEmptyString(input.personId)) {
      personId = String(input.personId).trim().slice(0, MAX_NAME_LENGTH);
    }

    let checks = {
      document: status,
      cleaning: status,
      lighting: status,
      fire: status,
      door: status,
    };
    if (input.checks !== undefined && input.checks !== null) {
      if (typeof input.checks !== 'object') {
        throw new Error('checks는 객체여야 합니다.');
      }
      const next = { ...checks };
      for (const key of ['document', 'cleaning', 'lighting', 'fire', 'door']) {
        if (input.checks[key] !== undefined) {
          next[key] = validateStatus(input.checks[key]);
        }
      }
      checks = next;
    }

    let id;
    if (isNonEmptyString(input.id || input.recordId)) {
      id = String(input.id || input.recordId).trim().slice(0, 80);
      if (records.has(id)) {
        throw new Error('이미 존재하는 샘플 ID입니다.');
      }
    } else {
      id = `${prefix}-rec-${String(nextSeq).padStart(3, '0')}`;
      while (records.has(id)) {
        nextSeq += 1;
        id = `${prefix}-rec-${String(nextSeq).padStart(3, '0')}`;
      }
    }

    let createdAt = DEFAULT_CREATED_AT;
    if (isNonEmptyString(input.createdAt || input.submittedAt)) {
      createdAt = String(input.createdAt || input.submittedAt).trim().slice(0, 40);
    } else {
      createdAt = deterministicCreatedAt(nextSeq);
    }

    const record = {
      id,
      inspectionDate,
      placeId,
      placeName,
      personId,
      personName,
      role,
      status,
      checks,
      notes,
      attachmentLabel,
      confirmed: false,
      confirmedBy: '',
      confirmedAt: '',
      createdAt,
      synthetic: true,
      source: 'sample',
    };
    nextSeq += 1;
    records.set(id, record);
    return cloneRecord(record);
  }

  function confirmRecord(id, options) {
    if (!isNonEmptyString(id)) {
      throw new Error('확인할 샘플 ID가 필요합니다.');
    }
    const key = id.trim();
    const record = records.get(key);
    if (!record) {
      throw new Error('샘플 기록을 찾을 수 없습니다.');
    }
    const opts = options && typeof options === 'object' ? options : {};
    let confirmedBy = '샘플 확인자(가상)';
    if (opts.confirmedBy !== undefined && opts.confirmedBy !== null && opts.confirmedBy !== '') {
      if (!isNonEmptyString(opts.confirmedBy)) {
        throw new Error('confirmedBy는 문자열이어야 합니다.');
      }
      confirmedBy = String(opts.confirmedBy).trim().slice(0, MAX_NAME_LENGTH);
    }
    let confirmedAt = DEFAULT_CONFIRM_TIME;
    if (isNonEmptyString(opts.confirmedAt)) {
      confirmedAt = String(opts.confirmedAt).trim().slice(0, 40);
    } else {
      confirmedAt = deterministicConfirmedAt();
    }
    record.confirmed = true;
    record.confirmedBy = confirmedBy;
    record.confirmedAt = confirmedAt;
    return cloneRecord(record);
  }

  function batchConfirmOkRecords(options) {
    const opts = options && typeof options === 'object' ? options : {};
    let confirmedBy = '샘플 일괄 확인자(가상)';
    if (opts.confirmedBy !== undefined && opts.confirmedBy !== null && opts.confirmedBy !== '') {
      if (!isNonEmptyString(opts.confirmedBy)) {
        throw new Error('confirmedBy는 문자열이어야 합니다.');
      }
      confirmedBy = String(opts.confirmedBy).trim().slice(0, MAX_NAME_LENGTH);
    }
    const confirmedIds = [];
    const skippedIssueIds = [];
    for (const record of records.values()) {
      if (record.confirmed) {
        continue;
      }
      if (record.status !== 'OK') {
        skippedIssueIds.push(record.id);
        continue;
      }
      confirmSeq += 1;
      const stamp = isNonEmptyString(opts.confirmedAt)
        ? String(opts.confirmedAt).trim().slice(0, 40)
        : `2026-04-27T18:00:${pad2(confirmSeq % 60)}+09:00`;
      record.confirmed = true;
      record.confirmedBy = confirmedBy;
      record.confirmedAt = stamp;
      confirmedIds.push(record.id);
    }
    return { confirmedIds: [...confirmedIds], skippedIssueIds: [...skippedIssueIds] };
  }

  function exportCsv(filter) {
    const rows = listRecords(filter);
    const header = [
      '샘플구분',
      '기록ID',
      '점검일',
      '장소',
      '점검자',
      '역할',
      '상태',
      '비고',
      '첨부라벨(파일아님)',
      '확인여부',
      '확인자',
      '확인시각',
      '생성시각',
    ];
    const lines = [SAMPLE_WARNING_CSV_LINE, header.map(quoteCsvCell).join(',')];
    for (const r of rows) {
      lines.push(
        [
          '샘플',
          r.id,
          r.inspectionDate,
          r.placeName,
          r.personName,
          r.role,
          r.status,
          r.notes,
          r.attachmentLabel,
          r.confirmed ? '확인됨' : '미확인',
          r.confirmedBy,
          r.confirmedAt,
          r.createdAt,
        ]
          .map(quoteCsvCell)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  const store = {
    listRecords,
    getRecord,
    submitRecord,
    confirmRecord,
    batchConfirmOkRecords,
    exportCsv,
  };
  store.getDetail = getRecord;
  store.list = listRecords;
  store.batchConfirmOk = batchConfirmOkRecords;
  store.confirmOkRecords = batchConfirmOkRecords;
  store.exportSampleCsv = exportCsv;
  store.toCsv = exportCsv;
  return store;
}


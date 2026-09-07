// tests/gas/stubs.mjs — Apps Script 전역 스텁 (in-memory, Node 테스트용)
// 실제 GAS가 아니므로 "로직 회귀 검증" 용도다. live GAS 검증(NOT_TESTED)을 대체하지 않는다.
import crypto from 'node:crypto';

function signed(bytes) {
  return Array.from(bytes, (b) => (b > 127 ? b - 256 : b));
}

export function formatDateKST(date, pattern) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => (parts.find((x) => x.type === t) || {}).value || '';
  const map = { yyyy: get('year'), MM: get('month'), dd: get('day'), HH: get('hour'), mm: get('minute'), ss: get('second') };
  let out = String(pattern);
  for (const [k, v] of Object.entries(map)) out = out.replace(k, v);
  return out.replace('XXX', '+09:00');
}

class Range {
  constructor(sheet, r, c, nr, nc) {
    this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc;
  }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sheet.grid[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    for (let i = 0; i < values.length; i++) {
      const ri = this.r - 1 + i;
      if (!this.sheet.grid[ri]) this.sheet.grid[ri] = [];
      for (let j = 0; j < values[i].length; j++) {
        this.sheet.grid[ri][this.c - 1 + j] = values[i][j];
      }
    }
  }
}

class Sheet {
  constructor(name) {
    this.name = name;
    this.grid = [];
    this.frozen = 0;
  }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getLastRow() {
    let last = 0;
    this.grid.forEach((row, i) => {
      if ((row || []).some((v) => v !== '' && v !== undefined && v !== null)) last = i + 1;
    });
    return last;
  }
  getLastColumn() {
    let last = 0;
    this.grid.forEach((row) => { if (row) last = Math.max(last, row.length); });
    return last;
  }
  getDataRange() {
    return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  appendRow(row) { this.grid.push([...row]); }
  setFrozenRows(n) { this.frozen = n; }
}

class Spreadsheet {
  constructor(id) {
    this.id = id;
    this.sheets = new Map();
  }
  getId() { return this.id; }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const s = new Sheet(name);
    this.sheets.set(name, s);
    return s;
  }
}

class FolderIterator {
  constructor(items) { this.items = items; this.i = 0; }
  hasNext() { return this.i < this.items.length; }
  next() { return this.items[this.i++]; }
}

export function createGasContext({ activeEmail = '', effectiveEmail = '' } = {}) {
  const spreadsheets = new Map();
  const active = new Spreadsheet('ss_active_1');
  spreadsheets.set(active.getId(), active);
  const files = new Map();
  const folders = new Map();
  const props = new Map();
  let idSeq = 1;

  const DriveFile = (id, name) => ({
    getId: () => id,
    getUrl: () => 'https://drive.google.com/file/d/' + id + '/view',
    setTrashed: (t) => { const f = files.get(id); if (f) f.trashed = !!t; },
  });
  const DriveFolder = (id, name) => ({
    getId: () => id,
    getName: () => name,
    createFolder: (child) => {
      const f = DriveFolder('folder_' + (idSeq++), child);
      folders.set(f.getId(), f);
      const parent = folders.get(id);
      parent.children = parent.children || [];
      parent.children.push(f);
      return f;
    },
    getFoldersByName: (n) => {
      const parent = folders.get(id);
      const kids = (parent.children || []).filter((c) => c.getName() === n);
      return new FolderIterator(kids);
    },
    createFile: (blob) => {
      const fid = 'file_' + (idSeq++);
      files.set(fid, { name: blob.getName ? blob.getName() : 'blob', trashed: false, bytes: blob.getBytes ? blob.getBytes() : [] });
      return DriveFile(fid);
    },
  });
  const rootStub = DriveFolder('folder_root', 'root');
  folders.set(rootStub.getId(), rootStub);

  const sandbox = {
    console,
    Session: {
      getActiveUser: () => ({ getEmail: () => activeEmail }),
      getEffectiveUser: () => ({ getEmail: () => effectiveEmail }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => { props.set(k, String(v)); },
        deleteProperty: (k) => { props.delete(k); },
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
    },
    Utilities: {
      getUuid: () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8),
      formatDate: (d, tz, pattern) => formatDateKST(d, pattern),
      base64Decode: (b64) => signed(Buffer.from(String(b64), 'base64')),
      newBlob: (bytes, mime, name) => ({
        getBytes: () => [...bytes], getContentType: () => mime, getName: () => name,
      }),
      computeDigest: (algo, str) => signed(crypto.createHash('sha256').update(String(str), 'utf8').digest()),
      computeHmacSha256Signature: (value, key) =>
        signed(crypto.createHmac('sha256', String(key)).update(String(value), 'utf8').digest()),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    SpreadsheetApp: {
      openById: (id) => {
        if (!spreadsheets.has(id)) throw new Error('Spreadsheet not found: ' + id);
        return spreadsheets.get(id);
      },
      getActiveSpreadsheet: () => active,
      __createSpreadsheet: (id) => {
        const s = new Spreadsheet(id);
        spreadsheets.set(id, s);
        return s;
      },
    },
    DriveApp: {
      getFolderById: (id) => {
        if (!folders.has(id)) throw new Error('Folder not found: ' + id);
        return folders.get(id);
      },
      createFolder: (name) => {
        const f = DriveFolder('folder_' + (idSeq++), name);
        folders.set(f.getId(), f);
        return f;
      },
      getFileById: (id) => {
        if (!files.has(id)) throw new Error('File not found: ' + id);
        return DriveFile(id);
      },
    },
    HtmlService: {
      createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({ addMetaTag: () => ({}) }) }) }),
      createHtmlOutputFromFile: () => ({ getContent: () => '' }),
    },
    ContentService: {
      MimeType: { JSON: 'JSON', CSV: 'CSV' },
      createTextOutput: (s) => ({
        content: s,
        setMimeType: function (m) { this.mime = m; return this; },
      }),
    },
    // 테스트 제어용 핸들
    __stubs: {
      spreadsheets, files, folders, props,
      setEmails: (a, e) => { activeEmail = a; effectiveEmail = e; },
    },
  };
  return sandbox;
}

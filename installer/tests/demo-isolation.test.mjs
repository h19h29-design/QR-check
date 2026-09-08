import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SAMPLE_BANNER, createSampleStore } from '../demo/sample-store.mjs';
import {
  statusLabel,
  roleLabel,
  makeRecordInput,
  filteredRecords,
} from '../demo/demo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEMO_DIR = path.resolve(__dirname, '../demo');
const INDEX_HTML_PATH = path.join(DEMO_DIR, 'index.html');
const DEMO_JS_PATH = path.join(DEMO_DIR, 'demo.js');
const STORE_MJS_PATH = path.join(DEMO_DIR, 'sample-store.mjs');
const SITE_CSS_PATH = path.resolve(__dirname, '../assets/site.css');
const OVERRIDES_CSS_PATH = path.resolve(__dirname, '../assets/site-overrides.css');

const EXPECTED_BANNER = '샘플 체험 — 실제 학교에 저장되지 않습니다';
const EXPECTED_CSV_WARNING =
  '# 경고: 이 CSV는 샘플 체험용 가상 데이터이며 실제 학교에 저장되지 않습니다.';

const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
const demoJs = fs.readFileSync(DEMO_JS_PATH, 'utf8');
const storeMjs = fs.readFileSync(STORE_MJS_PATH, 'utf8');
const siteCss = fs.readFileSync(SITE_CSS_PATH, 'utf8');
const overridesCss = fs.readFileSync(OVERRIDES_CSS_PATH, 'utf8');

function demoFileTexts() {
  const entries = fs.readdirSync(DEMO_DIR, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(DEMO_DIR, entry.name);
    out.push({ name: entry.name, full, text: fs.readFileSync(full, 'utf8') });
  }
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return out;
}

function stripComments(text, name) {
  let out = String(text);
  if (name.endsWith('.html')) {
    out = out.replace(/<!--[\s\S]*?-->/g, '');
  }
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = out.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const idx = lines[i].indexOf('//');
    if (idx !== -1) {
      const before = lines[i].slice(0, idx);
      const sq = (before.match(/'/g) || []).length;
      const dq = (before.match(/"/g) || []).length;
      const bt = (before.match(/`/g) || []).length;
      if (sq % 2 === 0 && dq % 2 === 0 && bt % 2 === 0) {
        lines[i] = lines[i].slice(0, idx);
      }
    }
  }
  return lines.join('\n');
}

function codeText(file) {
  return stripComments(file.text, file.name);
}

function validInput(overrides = {}) {
  return {
    inspectionDate: '2026-04-27',
    placeName: '가상 장소 C',
    personName: '가상 점검자 C',
    role: 'responsible',
    status: 'OK',
    notes: '가상 메모',
    attachmentLabel: '가상 메모 라벨',
    ...overrides,
  };
}

function seedIds(store) {
  return store.listRecords().map((r) => r.id);
}

describe('demo isolation: banner', () => {
  it('exports the exact SAMPLE_BANNER', () => {
    assert.equal(typeof SAMPLE_BANNER, 'string');
    assert.equal(SAMPLE_BANNER, EXPECTED_BANNER);
  });

  it('shows the exact visible banner in index.html', () => {
    assert.ok(indexHtml.includes(EXPECTED_BANNER), 'index.html must contain exact banner text');
    const bannerMatch = indexHtml.match(
      /<[^>]*id\s*=\s*["']sample-banner["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    );
    assert.ok(bannerMatch, 'missing #sample-banner element');
    assert.ok(
      bannerMatch[1].includes(EXPECTED_BANNER),
      '#sample-banner must visibly contain exact banner text',
    );
  });
});

describe('demo isolation: deterministic fictional seeds', () => {
  it('same seed produces identical records; two seeds stay distinct and fictional', () => {
    const a1 = createSampleStore('fictional-alpha');
    const a2 = createSampleStore('fictional-alpha');
    const b = createSampleStore('fictional-beta');

    assert.deepEqual(a1.listRecords(), a2.listRecords());

    const aIds = seedIds(a1);
    const bIds = seedIds(b);
    assert.equal(aIds.length, 2);
    assert.equal(bIds.length, 2);
    assert.ok(aIds.every((id) => id.startsWith('fictional-alpha-')));
    assert.ok(bIds.every((id) => id.startsWith('fictional-beta-')));
    assert.deepEqual(new Set([...aIds, ...bIds]).size, 4);

    for (const store of [a1, b]) {
      for (const r of store.listRecords()) {
        assert.equal(r.synthetic, true);
        assert.equal(r.source, 'sample');
        assert.ok(
          String(r.placeName).includes('샘플') || String(r.personName).includes('샘플'),
          `seed record must be marked fictional: ${r.id}`,
        );
        assert.ok(
          String(r.placeName).includes('(가상)') || String(r.personName).includes('(가상)'),
          `seed record must carry virtual marker: ${r.id}`,
        );
      }
    }

    const statuses = a1.listRecords().map((r) => r.status).sort();
    assert.deepEqual(statuses, ['ISSUE', 'OK']);
  });
});

describe('demo isolation: fresh-store isolation and cloned results', () => {
  it('stores are independent', () => {
    const a = createSampleStore('iso-a');
    const b = createSampleStore('iso-b');
    const beforeB = b.listRecords().length;
    a.submitRecord(validInput({ placeName: '가상 A 전용' }));
    assert.equal(a.listRecords().length, beforeB + 1);
    assert.equal(b.listRecords().length, beforeB);
    assert.ok(!seedIds(b).some((id) => id.startsWith('iso-a-')));
  });

  it('listRecords/getRecord/getDetail return clones', () => {
    const store = createSampleStore('clone-check');
    const first = store.listRecords()[0];
    const originalName = first.placeName;
    first.placeName = 'MUTATED';
    first.checks.document = 'MUTATED';
    const refetched = store.getRecord(first.id);
    assert.equal(refetched.placeName, originalName);
    assert.notEqual(refetched.checks.document, 'MUTATED');

    const listed = store.listRecords();
    const lenBefore = listed.length;
    listed.push({ id: 'fake' });
    listed[0].id = 'mutated-id';
    assert.equal(store.listRecords().length, lenBefore);
    assert.ok(store.getRecord(first.id) !== null);

    const detail = store.getDetail(first.id);
    assert.ok(detail !== null);
    const detailName = detail.placeName;
    detail.placeName = 'MUTATED-2';
    assert.equal(store.getDetail(first.id).placeName, detailName);

    const created = store.submitRecord(validInput());
    created.placeName = 'MUTATED-3';
    assert.notEqual(store.getRecord(created.id).placeName, 'MUTATED-3');

    const confirmed = store.confirmRecord(created.id);
    confirmed.confirmedBy = 'MUTATED-4';
    assert.notEqual(store.getRecord(created.id).confirmedBy, 'MUTATED-4');
  });
});

describe('demo isolation: submit validation and binary rejection', () => {
  it('rejects missing/invalid fields', () => {
    const store = createSampleStore('validate-check');
    assert.throws(() => store.submitRecord(null));
    assert.throws(() => store.submitRecord({}));
    assert.throws(() => store.submitRecord(validInput({ inspectionDate: '2026/04/27' })));
    assert.throws(() => store.submitRecord(validInput({ inspectionDate: '' })));
    assert.throws(() => store.submitRecord(validInput({ role: 'admin' })));
    assert.throws(() => store.submitRecord(validInput({ status: 'BAD' })));
    assert.throws(() => store.submitRecord(validInput({ placeName: '' })));
    assert.throws(() => store.submitRecord(validInput({ personName: '   ' })));
    assert.throws(() => store.submitRecord(validInput({ notes: 'x'.repeat(1001) })));
    assert.throws(() => store.submitRecord(validInput({ checks: 'not-object' })));
  });

  it('accepts a valid submit as virtual sample data', () => {
    const store = createSampleStore('submit-ok');
    const created = store.submitRecord(validInput());
    assert.ok(created.id.startsWith('submit-ok-'));
    assert.equal(created.inspectionDate, '2026-04-27');
    assert.equal(created.synthetic, true);
    assert.equal(created.source, 'sample');
    assert.equal(created.confirmed, false);
    assert.ok(store.getRecord(created.id) !== null);
  });

  it('rejects binary attachments (keys, data URLs, base64 payloads)', () => {
    const store = createSampleStore('binary-check');
    assert.throws(() =>
      store.submitRecord(validInput({ attachmentLabel: 'data:image/png;base64,iVBORw0=' })),
    );
    assert.throws(() =>
      store.submitRecord(validInput({ attachmentLabel: 'x'.repeat(50) + ';base64,' + 'y'.repeat(50) })),
    );
    for (const key of ['file', 'blob', 'binary', 'base64', 'dataUrl', 'arrayBuffer']) {
      assert.throws(
        () => store.submitRecord({ ...validInput(), [key]: 'payload' }),
        `binary key ${key} must be rejected`,
      );
    }
    assert.throws(() =>
      store.submitRecord({ ...validInput(), attachment: { name: 'evil.bin' } }),
    );
  });
});

describe('demo isolation: filters and detail', () => {
  it('filters by date/status/confirmed and exposes detail aliases', () => {
    const store = createSampleStore('filter-check');
    assert.equal(store.listRecords({ inspectionDate: '2026-04-26' }).length, 2);
    assert.equal(store.listRecords({ inspectionDate: '2099-01-01' }).length, 0);
    assert.equal(store.listRecords({ status: 'OK' }).length, 1);
    assert.equal(store.listRecords({ status: 'ISSUE' }).length, 1);
    assert.equal(
      store.listRecords({ inspectionDate: '2026-04-26', status: 'OK' }).length,
      1,
    );
    assert.equal(store.listRecords({ confirmed: false }).length, 2);

    const ok = store.listRecords({ status: 'OK' })[0];
    const byId = store.getRecord(ok.id);
    assert.ok(byId !== null);
    assert.equal(byId.id, ok.id);
    assert.deepEqual(store.getDetail(ok.id), byId);
    assert.equal(typeof store.list, 'function');
    assert.deepEqual(store.list({ status: 'OK' }), store.listRecords({ status: 'OK' }));
    assert.equal(store.getRecord('no-such-id'), null);
    assert.equal(store.getRecord(''), null);
    assert.equal(store.getDetail('no-such-id'), null);
  });
});

describe('demo isolation: confirm flows', () => {
  it('individual confirmRecord allows ISSUE records too', () => {
    const store = createSampleStore('confirm-issue');
    const issue = store.listRecords({ status: 'ISSUE' })[0];
    assert.ok(issue);
    const done = store.confirmRecord(issue.id);
    assert.equal(done.confirmed, true);
    assert.ok(String(done.confirmedBy).length > 0);
    assert.ok(String(done.confirmedAt).length > 0);
    assert.equal(store.getRecord(issue.id).confirmed, true);
    assert.throws(() => store.confirmRecord('no-such-id'));
    assert.throws(() => store.confirmRecord(''));
  });

  it('batch confirms only OK and skips ISSUE', () => {
    const store = createSampleStore('batch-check');
    const ok = store.listRecords({ status: 'OK' })[0];
    const issue = store.listRecords({ status: 'ISSUE' })[0];
    const result = store.batchConfirmOkRecords();
    assert.ok(result.confirmedIds.includes(ok.id));
    assert.ok(result.skippedIssueIds.includes(issue.id));
    assert.equal(store.getRecord(ok.id).confirmed, true);
    assert.equal(store.getRecord(issue.id).confirmed, false);

    const aliasStore = createSampleStore('batch-alias');
    const aliasResult = aliasStore.batchConfirmOk();
    assert.ok(Array.isArray(aliasResult.confirmedIds));
    assert.ok(Array.isArray(aliasResult.skippedIssueIds));

    const second = store.batchConfirmOkRecords();
    assert.equal(second.confirmedIds.length, 0);
    assert.ok(!second.confirmedIds.includes(issue.id));
  });
});

describe('demo isolation: CSV export', () => {
  it('begins with sample warning and quotes fields', () => {
    const store = createSampleStore('csv-check');
    const tricky = store.submitRecord(
      validInput({
        placeName: '가상 "따옴표" 장소, 콤마 포함',
        notes: '줄1 "인용", 콤마, 포함',
        attachmentLabel: '가상 라벨',
      }),
    );
    const csv = store.exportCsv();
    const lines = csv.split('\n');
    assert.equal(lines[0], EXPECTED_CSV_WARNING);
    assert.ok(lines[1].startsWith('"샘플구분"'), 'header cells must be quoted');
    assert.ok(csv.includes('"샘플"'), 'data rows must mark sample column quoted');
    assert.ok(
      csv.includes('가상 ""따옴표"" 장소, 콤마 포함'),
      'double quotes must be escaped as "" inside quoted cells',
    );
    assert.ok(csv.includes(tricky.id));
    assert.equal(typeof store.exportSampleCsv, 'function');
    assert.equal(store.exportSampleCsv(), store.exportCsv());
    for (const line of lines.slice(1)) {
      assert.ok(line.startsWith('"'), `every header/row line must be quoted: ${line.slice(0, 20)}`);
    }
  });
});

describe('demo isolation: pure helpers', () => {
  it('labels inputs and filters without DOM', () => {
    assert.equal(statusLabel('OK'), '정상(샘플)');
    assert.equal(statusLabel('ISSUE'), '조치 필요(샘플)');
    assert.equal(roleLabel('responsible'), '책임자(샘플)');
    assert.equal(roleLabel('duty'), '당직자(샘플)');

    const input = makeRecordInput({
      date: '2026-04-27',
      place: '가상 장소',
      person: '가상 사람',
      role: 'duty',
      status: 'ISSUE',
      attachment: '가상 라벨',
      notes: '메모',
    });
    assert.equal(input.inspectionDate, '2026-04-27');
    assert.equal(input.placeName, '가상 장소');
    assert.equal(input.personName, '가상 사람');
    assert.equal(input.attachmentLabel, '가상 라벨');
    assert.deepEqual(Object.keys(input).sort(), [
      'attachmentLabel',
      'inspectionDate',
      'notes',
      'personName',
      'placeName',
      'role',
      'status',
    ]);

    const store = createSampleStore('helper-filter');
    assert.equal(filteredRecords(store, { status: 'OK' }).length, 1);
    assert.equal(filteredRecords(store, { date: '2026-04-26' }).length, 2);
    assert.equal(filteredRecords(store, {}).length, 2);
    assert.deepEqual(filteredRecords(null, {}), []);
    assert.deepEqual(filteredRecords({}, {}), []);
  });
});

describe('demo isolation: HTML structure', () => {
  const REQUIRED_IDS = [
    'sample-banner',
    'inspector-form',
    'inspector-role',
    'inspector-person',
    'inspector-place',
    'inspector-date',
    'inspector-status',
    'inspector-attachment',
    'inspector-notes',
    'inspector-message',
    'admin-message',
    'admin-date',
    'admin-status',
    'batch-confirm-btn',
    'csv-download',
    'records-body',
    'detail-panel',
    'qr-mock',
  ];

  it('contains all required IDs', () => {
    for (const id of REQUIRED_IDS) {
      assert.ok(
        indexHtml.includes(`id="${id}"`) || indexHtml.includes(`id='${id}'`),
        `missing required HTML id: ${id}`,
      );
    }
  });

  it('has no file input', () => {
    assert.ok(!/type\s*=\s*["']file["']/i.test(indexHtml), 'file inputs are forbidden');
    assert.ok(!/type\s*=\s*file/i.test(demoJs), 'demo.js must not create a file input');
  });

  it('uses relative assets only', () => {
    const refs = [...indexHtml.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(
      (m) => m[1],
    );
    assert.ok(refs.length > 0, 'expected at least one src/href reference');
    assert.ok(
      refs.some((v) => v.includes('./demo.js')),
      'index.html must reference ./demo.js relatively',
    );
    for (const ref of refs) {
      const value = ref.trim();
      if (value.startsWith('#')) continue;
      assert.ok(
        !/^https?:\/\//i.test(value),
        `external http(s) asset forbidden: ${value}`,
      );
      assert.ok(!value.startsWith('//'), `protocol-relative URL forbidden: ${value}`);
      assert.ok(!/^data:/i.test(value), `embedded data URL forbidden: ${value}`);
    }
  });
});

describe('demo isolation: static network/storage scan', () => {
  const FORBIDDEN = [
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'sendBeacon',
    'googleapis.com',
    'gis.accounts',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'CacheStorage',
    'serviceWorker',
  ];

  it('uses Node built-ins only in demo modules (relative or node: imports)', () => {
    const files = demoFileTexts().filter((f) => f.name.endsWith('.js') || f.name.endsWith('.mjs'));
    assert.ok(files.length > 0);
    for (const file of files) {
      const code = codeText(file);
      for (const m of code.matchAll(/import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        assert.ok(
          spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('node:'),
          `${file.name} must only import relative or node: modules, got ${spec}`,
        );
      }
      for (const m of code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1];
        assert.ok(
          spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('node:'),
          `${file.name} must only require relative or node: modules, got ${spec}`,
        );
      }
    }
  });

  it('has no network/Google/persistent APIs in any installer/demo file', () => {
    const files = demoFileTexts();
    assert.ok(files.length > 0, 'expected files in installer/demo');
    assert.ok(files.some((f) => f.name === 'index.html'));
    assert.ok(files.some((f) => f.name === 'demo.js'));
    assert.ok(files.some((f) => f.name === 'sample-store.mjs'));
    for (const file of files) {
      const code = codeText(file);
      assert.ok(
        !/\bfetch\s*\(/.test(code),
        `${file.name} must not use fetch`,
      );
      for (const token of FORBIDDEN) {
        assert.ok(
          !code.toLowerCase().includes(token.toLowerCase()),
          `${file.name} must not contain ${token}`,
        );
      }
    }
  });

  it('has no external http(s) resources in HTML', () => {
    const files = demoFileTexts().filter((f) => f.name.endsWith('.html'));
    assert.ok(files.length > 0);
    for (const file of files) {
      const code = codeText(file);
      assert.ok(!/https?:\/\//i.test(code), `${file.name} must not contain http(s) URLs`);
      assert.ok(
        !/(src|href)\s*=\s*["']\/\//i.test(code),
        `${file.name} must not contain protocol-relative resources`,
      );
    }
  });

  it('allows Blob/URL.createObjectURL only in the demo.js CSV handler', () => {
    const others = demoFileTexts().filter((f) => f.name !== 'demo.js');
    for (const file of others) {
      const code = codeText(file);
      assert.ok(!code.includes('new Blob('), `${file.name} must not use Blob`);
      assert.ok(
        !code.includes('createObjectURL'),
        `${file.name} must not use createObjectURL`,
      );
    }
    const strippedDemoJs = stripComments(demoJs, 'demo.js');
    const start = strippedDemoJs.indexOf('function wireCsv');
    const end = strippedDemoJs.indexOf('function wireQr');
    assert.ok(start !== -1 && end !== -1 && end > start, 'CSV handler region must exist');
    const handler = strippedDemoJs.slice(start, end);
    assert.ok(handler.includes('Blob'), 'CSV handler must construct the CSV Blob');
    assert.ok(
      handler.includes('createObjectURL'),
      'CSV handler must use URL.createObjectURL',
    );
    const outside = strippedDemoJs.slice(0, start) + strippedDemoJs.slice(end);
    assert.ok(!outside.includes('Blob'), 'Blob is allowed only inside the CSV handler');
    assert.ok(
      !outside.includes('createObjectURL'),
      'createObjectURL is allowed only inside the CSV handler',
    );
    assert.ok(handler.includes('revokeObjectURL'), 'CSV handler must revoke the object URL');
  });

  it('demo.js never reads .files and never uses innerHTML', () => {
    const strippedDemo = stripComments(demoJs, 'demo.js');
    const strippedStore = stripComments(storeMjs, 'sample-store.mjs');
    assert.ok(!strippedDemo.includes('.files'), 'demo.js must never read .files');
    assert.ok(!strippedDemo.includes('innerHTML'), 'demo.js must never use innerHTML');
    assert.ok(!strippedStore.includes('innerHTML'), 'sample-store must never use innerHTML');
  });
});

describe('demo isolation: inspector date input', () => {
  it('inspector-date is a labeled date input with default 2026-04-26 inside inspector-form', () => {
    assert.ok(
      /<label[^>]*for\s*=\s*["']inspector-date["'][^>]*>/i.test(indexHtml),
      'missing label for inspector-date',
    );
    const inputMatch = indexHtml.match(/<input[^>]*id\s*=\s*["']inspector-date["'][^>]*>/i);
    assert.ok(inputMatch, 'missing #inspector-date input');
    const inputTag = inputMatch[0];
    assert.ok(/type\s*=\s*["']date["']/i.test(inputTag), '#inspector-date must be type=date');
    assert.ok(
      /value\s*=\s*["']2026-09-08["']/i.test(inputTag),
      '#inspector-date must default to 2026-09-08',
    );
    const formMatch = indexHtml.match(
      /<form[^>]*id\s*=\s*["']inspector-form["'][^>]*>([\s\S]*?)<\/form>/i,
    );
    assert.ok(formMatch, 'missing #inspector-form');
    const formBody = formMatch[1];
    assert.ok(formBody.includes('inspector-date'), '#inspector-form must contain inspector-date');
    assert.ok(
      /<label[^>]*for\s*=\s*["']inspector-date["'][^>]*>/i.test(formBody),
      '#inspector-form must contain the label for inspector-date',
    );
    assert.ok(
      /<input[^>]*id\s*=\s*["']inspector-date["'][^>]*>/i.test(formBody),
      '#inspector-form must contain the #inspector-date input',
    );
  });
});

describe('demo isolation: form/filter date wiring', () => {
  it('wireForm uses inspector-date without admin-date; currentFilter/wireFilters keep admin-date', () => {
    const stripped = stripComments(demoJs, 'demo.js');
    const wireFormStart = stripped.indexOf('function wireForm');
    const wireBatchStart = stripped.indexOf('function wireBatch');
    assert.ok(wireFormStart !== -1, 'missing function wireForm');
    assert.ok(wireBatchStart !== -1, 'missing function wireBatch');
    assert.ok(wireBatchStart > wireFormStart, 'wireBatch must follow wireForm');
    const wireFormRegion = stripped.slice(wireFormStart, wireBatchStart);
    assert.ok(wireFormRegion.includes('inspector-date'), 'wireForm region must wire inspector-date');
    assert.ok(!wireFormRegion.includes('admin-date'), 'wireForm region must not use admin-date');

    const cfStart = stripped.indexOf('function currentFilter');
    const renderStart = stripped.indexOf('function renderList');
    assert.ok(
      cfStart !== -1 && renderStart !== -1 && renderStart > cfStart,
      'currentFilter region must exist',
    );
    const cfRegion = stripped.slice(cfStart, renderStart);
    assert.ok(cfRegion.includes('admin-date'), 'currentFilter must keep using admin-date');

    const wfStart = stripped.indexOf('function wireFilters');
    const wfEnd = stripped.indexOf('function wireForm');
    assert.ok(wfStart !== -1 && wfEnd !== -1 && wfEnd > wfStart, 'wireFilters region must exist');
    const wfRegion = stripped.slice(wfStart, wfEnd);
    assert.ok(wfRegion.includes('admin-date'), 'wireFilters must keep using admin-date');
  });
});

describe('demo isolation: responsive sample table', () => {
  it('table.sample rule allows horizontal scroll on narrow screens', () => {
    // The integration rule lives in the linked overrides stylesheet, which
    // loads after the byte-preserved design stylesheet on the demo page.
    assert.ok(
      indexHtml.includes('../assets/site-overrides.css'),
      'demo page must link the overrides stylesheet',
    );
    assert.ok(
      indexHtml.indexOf('../assets/site-overrides.css') > indexHtml.indexOf('../assets/site.css'),
      'overrides stylesheet must load after site.css',
    );
    const ruleMatch = overridesCss.match(/table\.sample\s*\{([\s\S]*?)\}/);
    assert.ok(ruleMatch, 'missing table.sample rule in linked site-overrides.css');
    const ruleBody = ruleMatch[1];
    assert.ok(/display\s*:\s*block/i.test(ruleBody), 'table.sample must contain display:block');
    assert.ok(/max-width\s*:\s*100%/i.test(ruleBody), 'table.sample must contain max-width:100%');
    assert.ok(/overflow-x\s*:\s*auto/i.test(ruleBody), 'table.sample must contain overflow-x:auto');
  });
});

describe('demo isolation: csv formula neutralization', () => {
  it('quotes leading = with apostrophe prefix', () => {
    const store = createSampleStore('formula-check');
    store.submitRecord(validInput({ placeName: '=가상 수식' }));
    const csv = store.exportCsv();
    assert.ok(csv.includes('"\'='), 'CSV must neutralize leading = with apostrophe inside quoted cell');
  });
});

describe('demo isolation: demo.js Korean copy', () => {
  it('uses Korean copy and drops old English phrase', () => {
    assert.ok(demoJs.includes('샘플 CSV'), 'demo.js must contain 샘플 CSV');
    assert.ok(demoJs.includes('가상'), 'demo.js must contain 가상');
    assert.ok(!demoJs.includes('synthetic sample CSV'), 'demo.js must not contain synthetic sample CSV');
  });
});

describe('demo isolation: unified brand', () => {
  it('uses unified brand and update links', () => {
    assert.ok(indexHtml.includes('QR 보안점검표'), 'index.html must contain unified brand');
    assert.ok(!indexHtml.includes('QR 점검(소개용)'), 'index.html must not contain old brand');
    assert.ok((indexHtml.match(/\.\.\/update\//g) || []).length >= 1, '../update/ route must be linked');
  });
});

import { SAMPLE_BANNER, createSampleStore } from './sample-store.mjs';

export function statusLabel(status) {
  if (status === 'OK') return '정상(샘플)';
  if (status === 'ISSUE') return '조치 필요(샘플)';
  if (status === undefined || status === null) return '';
  return String(status);
}

export function roleLabel(role) {
  if (role === 'responsible') return '책임자(샘플)';
  if (role === 'duty') return '당직자(샘플)';
  if (role === undefined || role === null) return '';
  return String(role);
}

export function makeRecordInput(values) {
  const src = values && typeof values === 'object' ? values : {};
  const pickText = (primary, fallback) => {
    if (typeof primary === 'string') return primary;
    if (typeof fallback === 'string') return fallback;
    return '';
  };
  const notesValue = typeof src.notes === 'string' ? src.notes : '';
  return {
    inspectionDate: pickText(src.inspectionDate, src.date),
    placeName: pickText(src.placeName, src.place),
    personName: pickText(src.personName, src.person),
    role: pickText(src.role, ''),
    status: pickText(src.status, ''),
    notes: notesValue,
    attachmentLabel: pickText(src.attachmentLabel, src.attachment),
  };
}

export function filteredRecords(store, filter) {
  if (!store || typeof store.listRecords !== 'function') return [];
  const src = filter && typeof filter === 'object' ? filter : {};
  const query = {};
  const rawDate = typeof src.inspectionDate === 'string' ? src.inspectionDate.trim() : '';
  const altDate = typeof src.date === 'string' ? src.date.trim() : '';
  const pickedDate = rawDate !== '' ? rawDate : altDate;
  if (pickedDate !== '') query.inspectionDate = pickedDate;
  if (typeof src.status === 'string' && src.status.trim() !== '') {
    query.status = src.status.trim();
  }
  return store.listRecords(query);
}

const demoStore = createSampleStore('demo');

function getEl(doc, id) {
  return doc.getElementById(id);
}

function readText(el) {
  if (!el) return '';
  if (typeof el.value === 'string') return el.value;
  if (typeof el.textContent === 'string') return el.textContent;
  return '';
}

function setText(el, value) {
  if (el) {
    el.textContent = String(value === undefined || value === null ? '' : value);
  }
}

function showMessage(doc, text) {
  const value = String(text ?? '');
  for (const id of ['inspector-message', 'admin-message']) {
    const el = getEl(doc, id);
    if (el) {
      setText(el, value);
      el.hidden = false;
    }
  }
}

function currentFilter(doc) {
  const dateEl = getEl(doc, 'admin-date');
  const statusEl = getEl(doc, 'admin-status');
  const dateValue = readText(dateEl).trim();
  const statusValue = readText(statusEl).trim();
  const query = {};
  if (dateValue !== '') query.inspectionDate = dateValue;
  if (statusValue !== '') query.status = statusValue;
  return query;
}

export function renderList(doc, store) {
  const body = getEl(doc, 'records-body');
  if (!body) return;
  while (body.firstChild) {
    body.removeChild(body.firstChild);
  }
  const rows = filteredRecords(store, currentFilter(doc));
  for (const record of rows) {
    const tr = doc.createElement('tr');
    const dateCell = doc.createElement('td');
    setText(dateCell, record.inspectionDate);
    tr.appendChild(dateCell);
    const placeCell = doc.createElement('td');
    setText(placeCell, record.placeName);
    tr.appendChild(placeCell);
    const personCell = doc.createElement('td');
    setText(personCell, record.personName);
    tr.appendChild(personCell);
    const roleCell = doc.createElement('td');
    setText(roleCell, roleLabel(record.role));
    tr.appendChild(roleCell);
    const statusCell = doc.createElement('td');
    setText(statusCell, statusLabel(record.status));
    tr.appendChild(statusCell);
    const confirmedCell = doc.createElement('td');
    setText(confirmedCell, record.confirmed ? '확인됨(샘플)' : '미확인(샘플)');
    tr.appendChild(confirmedCell);
    const actionCell = doc.createElement('td');
    const detailBtn = doc.createElement('button');
    detailBtn.setAttribute('type', 'button');
    detailBtn.setAttribute('data-record-id', record.id);
    setText(detailBtn, '상세 보기(샘플)');
    detailBtn.addEventListener('click', () => {
      showDetail(doc, store, record.id);
    });
    actionCell.appendChild(detailBtn);
    // ISSUE records confirm only inside the opened detail view: the row
    // action opens detail without confirming. OK rows keep direct confirm.
    if (record.status === 'OK') {
      const confirmBtn = doc.createElement('button');
      confirmBtn.setAttribute('type', 'button');
      confirmBtn.setAttribute('data-confirm-id', record.id);
      setText(confirmBtn, record.confirmed ? '확인됨(샘플)' : '확인(샘플)');
      if (record.confirmed) {
        confirmBtn.disabled = true;
      }
      confirmBtn.addEventListener('click', () => {
        store.confirmRecord(record.id);
        renderList(doc, store);
        showDetail(doc, store, record.id);
      });
      actionCell.appendChild(confirmBtn);
    }
    tr.appendChild(actionCell);
    body.appendChild(tr);
  }
  if (rows.length === 0) {
    const emptyRow = doc.createElement('tr');
    const emptyCell = doc.createElement('td');
    emptyCell.setAttribute('colspan', '7');
    emptyCell.setAttribute('class', 'table-empty');
    setText(emptyCell, '선택한 조건의 가상 기록이 없습니다.');
    emptyRow.appendChild(emptyCell);
    body.appendChild(emptyRow);
  }
  renderStats(doc, store, rows.length);
}

function renderStats(doc, store, shownCount) {
  const totalEl = getEl(doc, 'stat-total');
  const okEl = getEl(doc, 'stat-ok');
  const issueEl = getEl(doc, 'stat-issue');
  const countEl = getEl(doc, 'record-count');
  if (!totalEl && !okEl && !issueEl && !countEl) return;
  let total = 0;
  let ok = 0;
  let issue = 0;
  try {
    const all = store.listRecords();
    total = all.length;
    for (const record of all) {
      if (record.status === 'OK') ok += 1;
      else if (record.status === 'ISSUE') issue += 1;
    }
  } catch {
    return;
  }
  const shown = typeof shownCount === 'number' ? shownCount : total;
  if (totalEl) setText(totalEl, `${total}건`);
  if (okEl) setText(okEl, `${ok}건`);
  if (issueEl) setText(issueEl, `${issue}건`);
  if (countEl) setText(countEl, `전체 가상 기록 ${total}건 중 ${shown}건 표시`);
}

export function showDetail(doc, store, id) {
  const panel = getEl(doc, 'detail-panel');
  if (!panel) return;
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }
  const found = typeof store.getRecord === 'function' ? store.getRecord(id) : null;
  const record = found !== null && found !== undefined ? found : (typeof store.getDetail === 'function' ? store.getDetail(id) : null);
  if (!record) {
    setText(panel, '선택된 샘플 기록이 없습니다.');
    return;
  }
  const title = doc.createElement('h3');
  setText(title, '샘플 기록 상세(가상 데이터)');
  panel.appendChild(title);
  const lines = [
    ['기록ID(샘플)', record.id],
    ['점검일', record.inspectionDate],
    ['장소(가상)', record.placeName],
    ['점검자(가상)', record.personName],
    ['역할', roleLabel(record.role)],
    ['상태', statusLabel(record.status)],
    ['비고', record.notes || ''],
    ['첨부 라벨(가상 메모, 업로드 없음)', record.attachmentLabel || ''],
    ['확인 여부', record.confirmed ? '확인됨(샘플)' : '미확인(샘플)'],
    ['확인자', record.confirmedBy || ''],
    ['확인시각', record.confirmedAt || ''],
  ];
  const list = doc.createElement('dl');
  for (const [label, value] of lines) {
    const term = doc.createElement('dt');
    setText(term, label);
    list.appendChild(term);
    const desc = doc.createElement('dd');
    setText(desc, value);
    list.appendChild(desc);
  }
  panel.appendChild(list);
  if (!record.confirmed) {
    const oneBtn = doc.createElement('button');
    oneBtn.setAttribute('type', 'button');
    setText(oneBtn, '이 샘플 기록 확인(가상)');
    oneBtn.addEventListener('click', () => {
      store.confirmRecord(record.id);
      renderList(doc, store);
      showDetail(doc, store, record.id);
    });
    panel.appendChild(oneBtn);
  }
  openRecordDialog(doc);
}

let dialogReturnFocus = null;

function openRecordDialog(doc) {
  const dialog = getEl(doc, 'record-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  try {
    if (!dialog.open) {
      dialogReturnFocus = doc.activeElement || null;
      dialog.showModal();
    }
  } catch {
    // Dialog unavailable; the inline detail panel already shows the record.
  }
}

function wireDialog(doc) {
  const dialog = getEl(doc, 'record-dialog');
  if (!dialog) return;
  const closeDialog = () => {
    try {
      if (dialog.open) dialog.close();
    } catch {
      // Ignore close failures; detail remains visible inline.
    }
  };
  const closers = dialog.querySelectorAll('[data-close-dialog]');
  closers.forEach((button) => {
    button.addEventListener('click', closeDialog);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDialog();
  });
  dialog.addEventListener('close', () => {
    if (dialogReturnFocus && typeof dialogReturnFocus.focus === 'function' && doc.contains(dialogReturnFocus)) {
      dialogReturnFocus.focus({ preventScroll: true });
    }
    dialogReturnFocus = null;
  });
}

function reflectStatus(doc) {
  const statusEl = getEl(doc, 'inspector-status');
  const attachmentField = getEl(doc, 'attachment-field');
  const notesEl = getEl(doc, 'inspector-notes');
  const requiredEl = getEl(doc, 'notes-required');
  if (!statusEl) return;
  const issue = readText(statusEl).trim() === 'ISSUE';
  if (attachmentField) attachmentField.hidden = !issue;
  if (notesEl && 'required' in notesEl) notesEl.required = issue;
  if (requiredEl) setText(requiredEl, issue ? '· 조치 필요 시 필수' : '· 선택');
}

function wireFilters(doc, store) {
  const dateEl = getEl(doc, 'admin-date');
  const statusEl = getEl(doc, 'admin-status');
  const rerender = () => {
    renderList(doc, store);
  };
  if (dateEl) {
    dateEl.addEventListener('change', rerender);
    dateEl.addEventListener('input', rerender);
  }
  if (statusEl) {
    statusEl.addEventListener('change', rerender);
    statusEl.addEventListener('input', rerender);
  }
}

function wireForm(doc, store) {
  const form = getEl(doc, 'inspector-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const roleEl = getEl(doc, 'inspector-role');
    const personEl = getEl(doc, 'inspector-person');
    const placeEl = getEl(doc, 'inspector-place');
    const statusEl = getEl(doc, 'inspector-status');
    const attachEl = getEl(doc, 'inspector-attachment');
    const notesEl = getEl(doc, 'inspector-notes');
    const messageEl = getEl(doc, 'inspector-message');
    const todayEl = getEl(doc, 'inspector-date');
    const pickedDate = readText(todayEl).trim();
    const input = makeRecordInput({
      inspectionDate: pickedDate,
      placeName: readText(placeEl),
      personName: readText(personEl),
      role: readText(roleEl),
      status: readText(statusEl),
      notes: readText(notesEl),
      attachmentLabel: readText(attachEl),
    });
    try {
      const created = store.submitRecord(input);
      showMessage(doc, `샘플 저장됨(가상): ${created.id}`);
      renderList(doc, store);
      showDetail(doc, store, created.id);
    } catch (err) {
      showMessage(doc, err instanceof Error ? err.message : String(err));
    }
  });
}

function wireBatch(doc, store) {
  const btn = getEl(doc, 'batch-confirm-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const result = store.batchConfirmOkRecords();
    const messageEl = getEl(doc, 'inspector-message');
    const okCount = Array.isArray(result.confirmedIds) ? result.confirmedIds.length : 0;
    const skipped = Array.isArray(result.skippedIssueIds) ? result.skippedIssueIds.length : 0;
    showMessage(doc, `샘플 일괄 확인(가상): OK ${okCount}건 확인, ISSUE ${skipped}건은 미확인 유지`);
    renderList(doc, store);
  });
}

function wireCsv(doc, store) {
  const btn = getEl(doc, 'csv-download');
  if (!btn) return;
  setText(btn, '샘플 CSV 내려받기(가상 데이터만)');
  btn.addEventListener('click', () => {
    const pickExport = typeof store.exportCsv === 'function' ? store.exportCsv : store.exportSampleCsv;
    const csvText = pickExport.call(store, currentFilter(doc));
    const messageEl = getEl(doc, 'inspector-message');
    showMessage(doc, '샘플 CSV 준비됨(가상 데이터만, 실제 학교에 저장되지 않음)');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = doc.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'sample-records.csv';
    anchor.rel = 'noopener';
    setText(anchor, '샘플 CSV(가상 데이터만)');
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  });
}

function wireQr(doc) {
  const mock = getEl(doc, 'qr-mock');
  if (!mock) return;
  mock.removeAttribute('hidden');
  if (mock.style) {
    mock.style.display = '';
    mock.style.visibility = 'visible';
  }
  setText(mock, 'sample QR placeholder (virtual visual only, no real code)');
}

function boot(doc) {
  const banner = getEl(doc, 'sample-banner');
  if (banner) {
    setText(banner, SAMPLE_BANNER);
  }
  wireQr(doc);
  wireFilters(doc, demoStore);
  wireForm(doc, demoStore);
  wireBatch(doc, demoStore);
  wireCsv(doc, demoStore);
  wireDialog(doc);
  const statusEl = getEl(doc, 'inspector-status');
  if (statusEl) {
    statusEl.addEventListener('change', () => reflectStatus(doc));
  }
  reflectStatus(doc);
  renderList(doc, demoStore);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot(document);
    });
  } else {
    boot(document);
  }
}




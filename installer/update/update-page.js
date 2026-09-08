// installer/update/update-page.js — manifest-driven update center (static only).
// No network, no storage, no timers. Node-import-safe: DOM access is guarded.
// Never invents values: renders only app_version / source_commit / built_at /
// runtime file count from the injected manifest, else the exact unpublished text.

export const UNPUBLISHED_TEXT = '미게시 — 게시된 릴리스 정보가 없습니다';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function pickString(data, keys) {
  if (!data || typeof data !== 'object') return '';
  for (const k of keys) {
    const v = data[k];
    if (isNonEmptyString(v)) return v.trim();
  }
  return '';
}

function pickFileCount(data) {
  if (!data || typeof data !== 'object') return 0;
  const candidates = [data.runtime_files, data.runtimeFiles, data.files];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.length;
  }
  const n = data.runtime_file_count;
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 0;
}

// Placeholder ({ status: 'unpublished' }), null, or anything missing the three
// required manifest fields is invalid. Pure, no side effects.
export function validateReleaseData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'UNPUBLISHED' };
  }
  if (data.status !== 'published') return { ok: false, reason: 'UNPUBLISHED' };
  const appVersion = pickString(data, ['app_version', 'appVersion']);
  const sourceCommit = pickString(data, ['source_commit', 'sourceCommit']);
  const builtAt = pickString(data, ['built_at', 'builtAt']);
  if (!appVersion || !sourceCommit || !builtAt) {
    return { ok: false, reason: 'UNPUBLISHED' };
  }
  return { ok: true, reason: '' };
}

// Pure view model: unpublished -> exact status text only; published -> only the
// manifest's own fields plus runtime file count. No invented values.
export function releaseViewModel(data, runtimeFiles) {
  const checked = validateReleaseData(data);
  if (!checked.ok) {
    return {
      ok: false,
      statusText: UNPUBLISHED_TEXT,
      appVersion: '',
      sourceCommit: '',
      builtAt: '',
      fileCount: 0,
    };
  }
  let fileCount = pickFileCount(data);
  if (fileCount === 0 && Array.isArray(runtimeFiles)) fileCount = runtimeFiles.length;
  return {
    ok: true,
    statusText: '',
    appVersion: pickString(data, ['app_version', 'appVersion']),
    sourceCommit: pickString(data, ['source_commit', 'sourceCommit']),
    builtAt: pickString(data, ['built_at', 'builtAt']),
    fileCount,
  };
}

function render() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const statusEl = document.getElementById('release-status');
  const detailsEl = document.getElementById('release-details');
  const versionEl = document.getElementById('release-version');
  const commitEl = document.getElementById('release-commit');
  const builtEl = document.getElementById('release-built');
  const filesEl = document.getElementById('release-files');
  if (!statusEl) return;
  let data = null;
  let runtimeFiles = [];
  try {
    data = window.__QR_CHECK_RELEASE__ || null;
  } catch {
    data = null;
  }
  try {
    if (Array.isArray(window.__MAKER_RUNTIME_FILES__)) runtimeFiles = window.__MAKER_RUNTIME_FILES__;
  } catch {
    runtimeFiles = [];
  }
  const vm = releaseViewModel(data, runtimeFiles);
  if (!vm.ok) {
    statusEl.textContent = vm.statusText;
    if (detailsEl) detailsEl.hidden = true;
    return;
  }
  statusEl.textContent = '게시됨';
  if (detailsEl) detailsEl.hidden = false;
  if (versionEl) versionEl.textContent = vm.appVersion;
  if (commitEl) commitEl.textContent = vm.sourceCommit;
  if (builtEl) builtEl.textContent = vm.builtAt;
  if (filesEl) filesEl.textContent = String(vm.fileCount);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
}



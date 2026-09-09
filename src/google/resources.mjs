// installer/src/google/resources.mjs — Drive/Sheets/Script 리소스 생성 (멱등 조회 우선).
// 이름 규칙: `${prefix}` + 종류별 고정 꼬리말. prefix 예: 'QR_CHECK_E2E_20260907_'.
import { createRestClient } from './rest.mjs';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4';
const SCRIPT = 'https://script.googleapis.com/v1';

export function names(prefix) {
  return {
    folder: prefix + 'QR보안점검표',
    sheet: prefix + '점검기록',
    script: prefix + 'QR보안점검표-앱',
  };
}

export function createResourceClients(deps) {
  const rest = createRestClient(deps);
  const UNKNOWN_MESSAGE = '요청 결과를 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.';
  function unknownError() {
    return Object.assign(new Error(UNKNOWN_MESSAGE), { kind: 'OUTCOME_UNKNOWN', retryable: false });
  }
  function ambiguousError() {
    return Object.assign(
      new Error('동일한 이름의 항목이 여러 개 있거나 소유권을 확인할 수 없습니다. 중단하고 기존 리소스를 확인하세요.'),
      { kind: 'AMBIGUOUS_RESOURCE', retryable: false },
    );
  }
  function escapeQueryValue(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  function hasNonEmptyId(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }
  function isValidWebAppUrl(u) {
    if (typeof u !== 'string') return false;
    const s = u.trim();
    if (!s) return false;
    let p;
    try {
      p = new URL(s);
    } catch {
      return false;
    }
    if (p.protocol !== 'https:') return false;
    if (p.hostname !== 'script.google.com') return false;
    if (!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(p.pathname)) return false;
    if (p.search || p.hash) return false;
    return true;
  }
  function extractWebAppUrl(res) {
    if (!res || !Array.isArray(res.entryPoints)) throw unknownError();
    for (const e of res.entryPoints) {
      const u = e && e.webApp ? e.webApp.url : undefined;
      if (isValidWebAppUrl(u)) return String(u).trim();
    }
    throw unknownError();
  }

  async function findOneByName(name, mimeType) {
    const esc = escapeQueryValue(name);
    const q = encodeURIComponent(`name = '${esc}' and mimeType = '${mimeType}' and trashed = false`);
    const res = await rest.get(`${DRIVE}/files?q=${q}&fields=nextPageToken,files(id,name,ownedByMe)&pageSize=10`);
    if (!res || !Array.isArray(res.files)) throw ambiguousError();
    if (res.nextPageToken) throw ambiguousError();
    if (res.files.length === 0) return null;
    if (res.files.length > 1) throw ambiguousError();
    const one = res.files[0];
    if (!one || !hasNonEmptyId(one.id) || one.name !== name || one.ownedByMe !== true) throw ambiguousError();
    return one;
  }

  async function findDriveFolder(name) {
    return findOneByName(name, 'application/vnd.google-apps.folder');
  }

  async function createDriveFolder(name) {
    const found = await findDriveFolder(name);
    if (found) return { id: found.id, reused: true };
    const res = await rest.post(`${DRIVE}/files?fields=id`, {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    });
    if (!res || !hasNonEmptyId(res.id)) throw unknownError();
    return { id: res.id, reused: false };
  }

  async function findSpreadsheet(name) {
    return findOneByName(name, 'application/vnd.google-apps.spreadsheet');
  }

  async function createSpreadsheet(title) {
    const found = await findSpreadsheet(title);
    if (found) return { spreadsheetId: found.spreadsheetId || found.id, reused: true };
    const res = await rest.post(`${SHEETS}/spreadsheets?fields=spreadsheetId`, {
      properties: { title, locale: 'ko_KR', timeZone: 'Asia/Seoul' },
    });
    if (!res || !hasNonEmptyId(res.spreadsheetId)) throw unknownError();
    return { spreadsheetId: res.spreadsheetId, reused: false };
  }

  async function moveIntoFolder(fileId, folderId) {
    // drive.file 권한: 설치센터가 만든 파일만 이동 가능. 실패하면 상위 호출에서 안내한다.
    const meta = await rest.get(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,parents`);
    if (!meta || meta.id !== fileId || !Array.isArray(meta.parents) || !meta.parents.every((p) => typeof p === 'string')) {
      throw unknownError();
    }
    if (meta.parents.includes(folderId)) return;
    const remove = meta.parents.filter((p) => p !== folderId && p.length > 0);
    let url = `${DRIVE}/files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(folderId)}`;
    if (remove.length > 0) url += `&removeParents=${encodeURIComponent(remove.join(','))}`;
    url += '&fields=id,parents';
    const moved = await rest.patch(url, {});
    if (!moved || moved.id !== fileId || !Array.isArray(moved.parents) || !moved.parents.includes(folderId)) {
      throw unknownError();
    }
    return moved;
  }

  async function createScriptProject(title) {
    const res = await rest.post(`${SCRIPT}/projects`, { title });
    if (!res || !hasNonEmptyId(res.scriptId)) throw unknownError();
    return { scriptId: res.scriptId };
  }

  function toGasFile(name, source) {
    if (name.endsWith('.gs')) return { name: name.slice(0, -3), type: 'SERVER_JS', source };
    if (name.endsWith('.html')) return { name: name.slice(0, -5), type: 'HTML', source };
    if (name === 'appsscript.json') return { name: 'appsscript', type: 'JSON', source };
    throw new Error('지원하지 않는 런타임 파일: ' + name);
  }

  async function uploadRuntime(scriptId, files /* [{name, source}] */) {
    // updateContent는 전체 교체이므로 manifest에 있는 전체 목록을 항상 함께 보낸다.
    const expected = files.map((f) => toGasFile(f.name, f.source));
    const res = await rest.put(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/content`, {
      files: expected,
    });
    if (!res || res.scriptId !== scriptId) throw unknownError();
    if (!Array.isArray(res.files) || res.files.length !== expected.length || res.files.length === 0) {
      throw unknownError();
    }
    const used = new Array(res.files.length).fill(false);
    for (const exp of expected) {
      let found = -1;
      for (let i = 0; i < res.files.length; i++) {
        if (used[i]) continue;
        const got = res.files[i];
        if (!got || got.name !== exp.name || got.type !== exp.type || got.source !== exp.source) continue;
        found = i;
        break;
      }
      if (found === -1) throw unknownError();
      used[found] = true;
    }
    return res;
  }

  async function createVersion(scriptId, description) {
    const res = await rest.post(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/versions`, { description });
    if (!res || !Number.isInteger(res.versionNumber) || res.versionNumber <= 0) throw unknownError();
    return { versionNumber: res.versionNumber };
  }

  async function createDeployment(scriptId, versionNumber, description) {
    const res = await rest.post(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/deployments`, {
      versionNumber,
      manifestFileName: 'appsscript',
      description,
    });
    if (!res || !hasNonEmptyId(res.deploymentId)) throw unknownError();
    return {
      deploymentId: res.deploymentId,
      webAppUrl: extractWebAppUrl(res),
    };
  }

  async function updateDeployment(scriptId, deploymentId, versionNumber, description) {
    const res = await rest.put(
      `${SCRIPT}/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`,
      { deploymentConfig: { versionNumber, manifestFileName: 'appsscript', description } },
    );
    if (!res || !hasNonEmptyId(res.deploymentId) || res.deploymentId !== deploymentId) throw unknownError();
    return {
      deploymentId: res.deploymentId,
      webAppUrl: extractWebAppUrl(res),
    };
  }

  async function getFileMetadata(fileId) {
    return rest.get(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,ownedByMe,trashed,parents`);
  }

  async function getContent(scriptId, versionNumber) {
    if (versionNumber !== undefined) {
      if (typeof versionNumber !== 'number' || !Number.isSafeInteger(versionNumber) || versionNumber <= 0) {
        throw new Error('유효한 versionNumber가 아닙니다. 1 이상의 안전한 정수를 사용하세요.');
      }
      return rest.get(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/content?versionNumber=${versionNumber}`);
    }
    return rest.get(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/content`);
  }

  async function getDeployment(scriptId, deploymentId) {
    return rest.get(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`);
  }

  async function getVerifiedEmail() {
    // 이미 승인된 Drive 권한으로 토큰 소유자를 확인한다. 새 도메인·의존성 없음.
    const res = await rest.get(`${DRIVE}/about?fields=user/emailAddress`);
    const raw = res && res.user && res.user.emailAddress ? String(res.user.emailAddress) : '';
    const norm = raw.trim().toLowerCase();
    if (!norm) throw new Error('Google 계정 정보를 확인할 수 없습니다. 다시 연결하세요.');
    return norm;
  }

  async function getSheetValues(spreadsheetId, range) {
    // 설치센터가 만든 시트에 한해 drive.file 범위로 읽는다. CORS 가능한 REST 호출.
    // 학교 관리자 웹이 기록한 연결검사 결과(setup_completed 등) 확인용.
    const res = await rest.get(
      `${SHEETS}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    );
    return res.values || [];
  }

  return {
    findDriveFolder, createDriveFolder, findSpreadsheet, createSpreadsheet,
    moveIntoFolder, createScriptProject, uploadRuntime, createVersion,
    createDeployment, updateDeployment, getContent, getDeployment, getSheetValues,
    getVerifiedEmail, getFileMetadata,
  };
}

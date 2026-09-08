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

  async function findDriveFolder(name) {
    const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const res = await rest.get(`${DRIVE}/files?q=${q}&fields=files(id,name)&pageSize=10`);
    return (res.files || [])[0] || null;
  }

  async function createDriveFolder(name) {
    const found = await findDriveFolder(name);
    if (found) return { id: found.id, reused: true };
    const res = await rest.post(`${DRIVE}/files?fields=id`, {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    });
    return { id: res.id, reused: false };
  }

  async function findSpreadsheet(name) {
    // drive.file 권한에서는 전체 검색이 제한될 수 있어 폴더 내 검색을 우선한다.
    const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const res = await rest.get(`${DRIVE}/files?q=${q}&fields=files(id,name)&pageSize=10`);
    return (res.files || [])[0] || null;
  }

  async function createSpreadsheet(title) {
    const found = await findSpreadsheet(title);
    if (found) return { spreadsheetId: found.spreadsheetId || found.id, reused: true };
    const res = await rest.post(`${SHEETS}/spreadsheets?fields=spreadsheetId`, {
      properties: { title, locale: 'ko_KR', timeZone: 'Asia/Seoul' },
    });
    return { spreadsheetId: res.spreadsheetId, reused: false };
  }

  async function moveIntoFolder(fileId, folderId) {
    // drive.file 권한: 설치센터가 만든 파일만 이동 가능. 실패하면 상위 호출에서 안내한다.
    await rest.post(`${DRIVE}/files/${encodeURIComponent(fileId)}:move?addParents=${encodeURIComponent(folderId)}&fields=id`, {});
  }

  async function createScriptProject(title) {
    const res = await rest.post(`${SCRIPT}/projects`, { title });
    return { scriptId: res.scriptId };
  }

  function toGasFile(name, source) {
    if (name.endsWith('.gs')) return { name: name.slice(0, -3), type: 'SERVER_JS', source };
    if (name.endsWith('.html')) return { name, type: 'HTML', source };
    if (name === 'appsscript.json') return { name: 'appsscript', type: 'JSON', source };
    throw new Error('지원하지 않는 런타임 파일: ' + name);
  }

  async function uploadRuntime(scriptId, files /* [{name, source}] */) {
    // updateContent는 전체 교체이므로 manifest에 있는 전체 목록을 항상 함께 보낸다.
    const res = await rest.put(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/content`, {
      files: files.map((f) => toGasFile(f.name, f.source)),
    });
    return res;
  }

  async function createVersion(scriptId, description) {
    const res = await rest.post(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/versions`, { description });
    return { versionNumber: res.versionNumber };
  }

  async function createDeployment(scriptId, versionNumber, description) {
    const res = await rest.post(`${SCRIPT}/projects/${encodeURIComponent(scriptId)}/deployments`, {
      versionNumber,
      manifestFileName: 'appsscript',
      description,
    });
    return {
      deploymentId: res.deploymentId,
      webAppUrl: (((res.entryPoints || []).find((e) => e.webApp) || {}).webApp || {}).url || '',
    };
  }

  async function updateDeployment(scriptId, deploymentId, versionNumber, description) {
    const res = await rest.put(
      `${SCRIPT}/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`,
      { deploymentConfig: { versionNumber, manifestFileName: 'appsscript', description } },
    );
    return {
      deploymentId: res.deploymentId,
      webAppUrl: (((res.entryPoints || []).find((e) => e.webApp) || {}).webApp || {}).url || '',
    };
  }

  async function getContent(scriptId) {
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
    getVerifiedEmail,
  };
}

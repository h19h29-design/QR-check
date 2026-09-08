// installer/src/install/orchestrator.mjs — 설치 실행기.
// 상태머신 전이를 강제하고, 각 단계의 Google 호출을 멱등(기존 자원 재사용)으로 수행한다.
// 학교 설정(학교명 등)은 소유자가 학교 관리자 웹에서 직접 입력한다. 설치센터가 대신 쓰지 않는다.
import { advance } from './state-machine.mjs';
import { names } from '../google/resources.mjs';

const PAST_STORAGE = ['STORAGE_CREATED', 'SCRIPT_CREATED', 'CODE_UPLOADED', 'DEPLOYED', 'AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE'];
const PAST_DEPLOYED = ['DEPLOYED', 'AWAITING_SCHOOL_AUTH', 'VERIFIED', 'COMPLETE'];

export async function runToStorage({ install, accountEmail, res, prefix }) {
  if (install.state === 'DRAFT') {
    advance(install, 'OAUTH_READY', { accountEmail });
  }
  // 이미 저장소 이후 단계면 기존 자원을 그대로 재사용하고 중단한다.
  if (PAST_STORAGE.includes(install.state)) {
    return install;
  }
  // API_ACCESS_READY는 첫 실제 호출 성공으로 증명한다. 실패하면 안내 단계로 중단된다.
  if (install.state === 'OAUTH_READY') {
    let folder;
    try {
      folder = await res.createDriveFolder(names(prefix).folder);
    } catch (e) {
      if (e && e.kind === 'SCRIPT_API_DISABLED') throw e;
      throw e;
    }
    advance(install, 'API_ACCESS_READY', { accountEmail, resource: { folder_id: folder.id } });
  }
  if (install.state === 'API_ACCESS_READY') {
    let folderId = install.resources.folder_id || '';
    if (!folderId) {
      const folder = await res.createDriveFolder(names(prefix).folder);
      folderId = folder.id;
    }
    let sheetId = install.resources.spreadsheet_id || '';
    if (!sheetId) {
      const sheet = await res.createSpreadsheet(names(prefix).sheet);
      sheetId = sheet.spreadsheetId;
    }
    try {
      await res.moveIntoFolder(sheetId, folderId);
    } catch (e) {
      // 이동 실패는 치명적이지 않다. 폴더 정리는 안내로 남긴다.
      install.resources.sheet_outside_folder = 'true';
    }
    advance(install, 'STORAGE_CREATED', {
      accountEmail,
      resource: { folder_id: folderId, spreadsheet_id: sheetId },
    });
  }
  return install;
}

export async function runToDeployed({ install, accountEmail, res, prefix, runtimeFiles, versionDescription }) {
  // 이미 배포 이후 단계면 중복 생성 없이 기존 자원을 재사용한다.
  if (PAST_DEPLOYED.includes(install.state)) {
    return install;
  }
  if (['DRAFT', 'OAUTH_READY', 'API_ACCESS_READY'].includes(install.state)) {
    throw new Error('저장소가 먼저 만들어져야 합니다. 리소스 만들기를 먼저 하세요.');
  }
  if (install.state === 'STORAGE_CREATED') {
    const existingScript = install.resources.script_id || '';
    if (!existingScript) {
      const script = await res.createScriptProject(names(prefix).script);
      advance(install, 'SCRIPT_CREATED', { accountEmail, resource: { script_id: script.scriptId } });
    } else {
      advance(install, 'SCRIPT_CREATED', { accountEmail, resource: { script_id: existingScript } });
    }
  }
  if (install.state === 'SCRIPT_CREATED') {
    await res.uploadRuntime(install.resources.script_id, runtimeFiles);
    advance(install, 'CODE_UPLOADED', { accountEmail });
  }
  if (install.state === 'CODE_UPLOADED') {
    const version = await res.createVersion(install.resources.script_id, versionDescription);
    const versionNumber = String(version.versionNumber);
    const existingDep = install.resources.deployment_id || '';
    if (existingDep) {
      const dep = await res.updateDeployment(
        install.resources.script_id,
        existingDep,
        version.versionNumber,
        versionDescription,
      );
      const depId = (dep && dep.deploymentId) || existingDep;
      const url = (dep && dep.webAppUrl) || install.resources.web_app_url || '';
      if (!url) {
        throw new Error('배포 주소가 발급되지 않았습니다. Apps Script 배포 설정을 확인하세요.');
      }
      advance(install, 'DEPLOYED', {
        accountEmail,
        resource: { version_number: versionNumber, deployment_id: depId, web_app_url: url },
      });
    } else {
      const dep = await res.createDeployment(install.resources.script_id, version.versionNumber, versionDescription);
      if (!dep.webAppUrl) {
        throw new Error('배포 주소가 발급되지 않았습니다. Apps Script 배포 설정을 확인하세요.');
      }
      advance(install, 'DEPLOYED', {
        accountEmail,
        resource: {
          version_number: versionNumber,
          deployment_id: dep.deploymentId,
          web_app_url: dep.webAppUrl,
        },
      });
    }
    advance(install, 'AWAITING_SCHOOL_AUTH', { accountEmail });
  }
  return install;
}

/** 학교 관리자 웹이 Sheet에 기록한 setup_completed를 설치센터 권한으로 확인한다. */
export async function checkSchoolVerified({ install, res, accountEmail }) {
  const values = await res.getSheetValues(install.resources.spreadsheet_id, 'settings_school!A1:B200');
  const map = {};
  for (const row of values) {
    if (row && row[0]) map[String(row[0])] = row[1];
  }
  const done = map.setup_completed === 'true' || map.setup_completed === true;
  if (done) {
    if (accountEmail) advance(install, 'VERIFIED', { accountEmail });
    else advance(install, 'VERIFIED', {});
    return { verified: true, school_name: map.school_name || '' };
  }
  return { verified: false, school_name: map.school_name || '' };
}

/** 소유자 안내문: 설치센터가 자동화할 수 없는 남은 단계. */
export function ownerSteps(webAppUrl) {
  const base = String(webAppUrl || '').split('?')[0];
  return [
    '1. 위 관리자 주소로 접속해 Google 계정 권한을 승인하세요.',
    '2. 스크립트 편집기에서 createInitialSetupKey 함수를 1회 실행해 초기 설정 키를 발급받으세요.',
    '3. 초기 설정 화면(?page=setup)에서 학교명·관리자 이메일·초기 설정 키를 입력하세요.',
    '4. 시험 QR로 1건 제출하고 관리자 화면에서 확인되면 설치 완료입니다.',
  ].map((s) => s).join('\n') + `\n관리자 주소: ${base}?page=admin\n초기 설정: ${base}?page=setup`;
}

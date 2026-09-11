// installer/src/update/update.mjs — 기존 deployment ID 유지 업데이트 + 롤백.
// 원칙: 일상 업데이트에서 deployment를 새로 create하지 않는다. QR 주소·URL 보존이 목표다.
// 백업은 호출자가 보관한다(메모리/파일 다운로드). 제작자 서버로 전송하지 않는다.
export function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(Number);
  const pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function planUpdate({ currentVersion, targetVersion, minCompatible, maxCompatible }) {
  const reasons = [];
  if (!targetVersion) reasons.push('대상 버전이 없습니다.');
  if (currentVersion && targetVersion && compareVersions(currentVersion, targetVersion) >= 0) {
    reasons.push('이미 같거나 새 버전이 설치되어 있습니다.');
  }
  if (minCompatible && compareVersions(currentVersion, minCompatible) < 0) {
    reasons.push('현재 버전이 최소 호환 아래입니다. 신규 설치를 검토하세요.');
  }
  if (maxCompatible && compareVersions(targetVersion, maxCompatible) > 0) {
    reasons.push('대상 버전이 최대 호환을 넘습니다. 데이터 마이그레이션을 먼저 확인하세요.');
  }
  return reasons.length ? { action: 'blocked', reasons } : { action: 'update', reasons: [] };
}

export async function backupProject({ res, scriptId }) {
  const content = await res.getContent(scriptId);
  return {
    script_id: scriptId,
    backed_up_at: new Date().toISOString(),
    files: (content.files || []).map((f) => ({ name: f.name, type: f.type, source: f.source })),
  };
}

export async function applyUpdate({ res, scriptId, deploymentId, runtimeFiles, description }) {
  const before = await res.getDeployment(scriptId, deploymentId);
  const beforeUrl = (((before.entryPoints || []).find((e) => e.webApp) || {}).webApp || {}).url || '';
  await res.uploadRuntime(scriptId, runtimeFiles);
  const version = await res.createVersion(scriptId, description);
  const after = await res.updateDeployment(scriptId, deploymentId, version.versionNumber, description);
  const urlKept = !!beforeUrl && after.webAppUrl === beforeUrl;
  return {
    deployment_id: after.deploymentId,
    version_number: version.versionNumber,
    web_app_url: after.webAppUrl,
    url_kept: urlKept,
    previous_version: before.deploymentConfig ? before.deploymentConfig.versionNumber : null,
  };
}

export async function rollbackDeployment({ res, scriptId, deploymentId, previousVersion, description }) {
  if (!previousVersion) throw new Error('되돌릴 이전 버전이 없습니다.');
  const after = await res.updateDeployment(
    scriptId, deploymentId, previousVersion, (description || 'rollback') + ' -> v' + previousVersion,
  );
  return { deployment_id: after.deploymentId, version_number: previousVersion, web_app_url: after.webAppUrl };
}

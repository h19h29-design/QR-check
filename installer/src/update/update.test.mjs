// installer update 모듈 테스트 (fake res)
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, planUpdate, backupProject, applyUpdate, rollbackDeployment } from './update.mjs';

function fakeRes() {
  return {
    state: { version: 3, url: 'https://script.google.com/macros/s/XYZ/exec' },
    async getContent() {
      return { files: [{ name: 'Code', type: 'SERVER_JS', source: 'x' }] };
    },
    async getDeployment() {
      return {
        deploymentConfig: { versionNumber: this.state.version },
        entryPoints: [{ webApp: { url: this.state.url } }],
      };
    },
    async uploadRuntime() {},
    async createVersion() {
      this.state.version += 1;
      return { versionNumber: this.state.version };
    },
    async updateDeployment(_s, _d, v) {
      this.state.version = v;
      return { deploymentId: 'd1', webAppUrl: this.state.url };
    },
  };
}

test('버전 비교', () => {
  assert.equal(compareVersions('1.1.0', '1.1.1-test'.split('-')[0]), -1);
  assert.equal(compareVersions('1.1.0', '1.1.0'), 0);
  assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
});

test('호환 범위 밖은 차단', () => {
  const r = planUpdate({ currentVersion: '1.0.0', targetVersion: '2.0.0', minCompatible: '1.1.0', maxCompatible: '1.9.9' });
  assert.equal(r.action, 'blocked');
  assert.ok(r.reasons.length >= 1);
  assert.equal(planUpdate({ currentVersion: '1.1.0', targetVersion: '1.1.1' }).action, 'update');
});

test('업데이트는 deployment를 유지하고 URL을 보존한다', async () => {
  const res = fakeRes();
  const backup = await backupProject({ res, scriptId: 'sc1' });
  assert.equal(backup.files.length, 1);
  const out = await applyUpdate({
    res, scriptId: 'sc1', deploymentId: 'd1',
    runtimeFiles: [{ name: 'Code.gs', source: 'y' }], description: 'v1.1.1-test',
  });
  assert.equal(out.deployment_id, 'd1');
  assert.equal(out.version_number, 4);
  assert.equal(out.url_kept, true);
  assert.equal(out.previous_version, 3);
});

test('롤백은 이전 버전으로 deployment를 되돌린다', async () => {
  const res = fakeRes();
  const out = await rollbackDeployment({ res, scriptId: 'sc1', deploymentId: 'd1', previousVersion: 2 });
  assert.equal(out.version_number, 2);
  assert.equal(res.state.version, 2);
  await assert.rejects(() => rollbackDeployment({ res, scriptId: 'sc1', deploymentId: 'd1' }), /이전 버전/);
});

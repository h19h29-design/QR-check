// tools/clasp-push.mjs — clasp 생성 충돌 시 전체 교체 push (운영자 수동 live용).
// - apps-script/.clasp.json의 scriptId 대상. ID 불일치 시 중단한다.
// - 토큰은 ~/.clasprc.json에서 읽고 로그·Git에 남기지 않는다.
// - apps-script/.claspignore를 준수한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const APP_DIR = path.join(ROOT, 'apps-script');

const EXPECTED_SCRIPT_ID = process.env.QR_SCRIPT_ID || '';
if (!EXPECTED_SCRIPT_ID) {
  console.error('QR_SCRIPT_ID 환경변수가 필요합니다. (대상 확인용)');
  process.exit(1);
}

const claspJson = JSON.parse(fs.readFileSync(path.join(APP_DIR, '.clasp.json'), 'utf8'));
if (claspJson.scriptId !== EXPECTED_SCRIPT_ID) {
  console.error('대상 Script ID 불일치. .clasp.json을 확인하세요.');
  process.exit(1);
}

const rcPath = path.join(os.homedir(), '.clasprc.json');
const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
const accessToken = (rc.tokens && rc.tokens.default && rc.tokens.default.access_token)
  || (rc.token && rc.token.access_token);
if (!accessToken) {
  console.error('clasp 로그인이 만료되었습니다. `npx @google/clasp login` 후 다시 실행하세요.');
  process.exit(1);
}

const ignore = fs.readFileSync(path.join(APP_DIR, '.claspignore'), 'utf8')
  .split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
function ignored(name) {
  return ignore.some((pat) => {
    const p = pat.replace('**/', '');
    return name === p || name.endsWith('/' + p);
  });
}

function toGasFile(name, source) {
  if (name.endsWith('.gs')) return { name: name.slice(0, -3), type: 'SERVER_JS', source };
  if (name.endsWith('.html')) return { name: name.slice(0, -'.html'.length), type: 'HTML', source };
  if (name === 'appsscript.json') return { name: 'appsscript', type: 'JSON', source };
  throw new Error('지원하지 않는 파일: ' + name);
}

const files = fs.readdirSync(APP_DIR)
  .filter((n) => !ignored(n) && (n.endsWith('.gs') || n.endsWith('.html') || n === 'appsscript.json'))
  .sort()
  .map((n) => toGasFile(n, fs.readFileSync(path.join(APP_DIR, n), 'utf8')));

console.log('target: ' + claspJson.scriptId);
console.log('files: ' + files.map((f) => f.name + ':' + f.type).join(', '));

const res = await fetch(
  'https://script.googleapis.com/v1/projects/' + encodeURIComponent(claspJson.scriptId) + '/content',
  {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  },
);
const body = await res.text();
if (!res.ok) {
  console.error('push 실패(' + res.status + '): ' + body.slice(0, 500));
  process.exit(1);
}
console.log('push 성공. 서버 파일 수: ' + (JSON.parse(body).files || []).length);

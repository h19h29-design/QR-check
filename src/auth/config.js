// installer/src/auth/config.js — 공개 설정값만. 비밀값 금지.
// 제작자 1회 준비(docs/operator/INSTALLER_OAUTH_SETUP.md) 완료 후 CLIENT_ID를 채운다.
// client_secret은 브라우저 구조에서 만들지도 넣지도 않는다.
export const GOOGLE_OAUTH_CLIENT_ID = ''; // 예: '1234567890-abc.apps.googleusercontent.com'

export const INSTALL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
];
// Sheets 작업은 drive.file로 우선 시도한다. live에서 부족이 증명될 때만 확대하고,
// 그 경우 OAUTH_SCOPE_MATRIX에 호출·오류·이유를 먼저 기록한다.

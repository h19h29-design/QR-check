# OAUTH_SCOPE_MATRIX — 권한 범위표 (2026-09-07)

원칙: 최소 권한, 목적 분리, 과장 금지. `script.projects` 등이 특정 학교 파일 하나로 제한된다고 안내하지 않는다.

## A. 설치센터 (브라우저, token model, 메모리 보관)

## A-2. 설치센터 호출 endpoint ↔ scope (코드 기준, 2026-09-08)

구현: `installer/src/google/resources.mjs`, `installer/src/auth/google-auth.mjs`.

| 호출 | endpoint | 필요 scope |
|---|---|---|
| 폴더 중복 조회·생성 | `drive/v3/files` (q/list/create) | `drive.file` |
| 시트 중복 조회 | `drive/v3/files` (q/list) | `drive.file` |
| 시트 생성(ko_KR/Asia/Seoul) | `sheets/v4/spreadsheets` | `drive.file` 우선 live 확인 |
| 시트 폴더 이동 | `GET drive/v3/files/{id}?fields=id,parents` 후 `PATCH drive/v3/files/{id}` + addParents/removeParents | `drive.file` (앱이 접근 가능한 파일, live 확인 필요) |
| 연결검사 확인 읽기 | `sheets/v4/spreadsheets/{id}/values/settings_school!A1:B200` | `drive.file` 우선 live 확인 |
| 스크립트 생성 | `script/v1/projects` | `script.projects` |
| 코드 업로드(전체 교체) | `script/v1/projects/{id}/content` | `script.projects` |
| 코드 백업 읽기 | `script/v1/projects/{id}/content` | `script.projects` |
| 버전 생성 | `script/v1/projects/{id}/versions` | `script.projects` |
| 배포 생성·갱신·조회 | `script/v1/projects/{id}/deployments*` | `script.deployments` |

live에서 `drive.file` 부족이 증명되면 호출·HTTP 상태·민감정보를 제거한 오류 분류를 `LIVE_VALIDATION_REPORT.md`에 먼저 기록한 뒤 확대를 검토한다. 토큰·학교정보가 포함될 수 있는 원문 응답은 보고서에 붙이지 않는다.

| scope | 용도 | 비고 |
|---|---|---|
| `openid email profile` | 학교 계정 확인 | 최소 식별 |
| `https://www.googleapis.com/auth/drive.file` | 설치센터가 생성/선택한 학교 파일만 | 전체 Drive 아님. Sheets 작업 충족 여부 live 확인 |
| `https://www.googleapis.com/auth/script.projects` | 학교 스크립트 생성·내용 업로드·버전 생성 | 사용자 스크립트 전반 관리 가능 → 경고 문구와 철회 안내 필수 |
| `https://www.googleapis.com/auth/script.deployments` | 배포 생성·갱신 | 배포 주소 보존 업데이트에 사용 |

- 토큰: 메모리에만 보관. URL/localStorage/IndexedDB/로그/서버 전송 금지. refresh token 서버 보관 금지.
- `client_secret`은 브라우저에 넣지 않는다. client ID는 공개 설정값.
- 철회 방법(Google 계정 > 보안 > 타사 액세스)을 설치센터 화면에 상시 안내.

## B. 학교 런타임 (Apps Script manifest, 현행)

현행 `apps-script/appsscript.json`:

| scope | 용도 | 평가 |
|---|---|---|
| `spreadsheets` | ID로 지정된 학교 Sheet 접근 | 현재 manifest 값. 아래 확대 근거는 이전 실측 기록이며 새 설치 성공을 의미하지 않음 |
| `drive` (전체) | 첨부 저장/폴더 생성 | 과도. `drive.file`로 축소 가능한지 live 검증 (이번 작업에서 시도, 실패 시 문서화 후 유지) |
| `userinfo.email` | 관리자 Google 이메일 확인 | 유지 |

2026-09-08 live 판정: `spreadsheets.currentonly`는 독립형(API 설치) 프로젝트에서
`openById` 바인딩 시트를 열지 못해 거부됨 → 학교 런타임을 `spreadsheets`로 확대.
이유: 설치센터/API가 만든 전용 시트를 ID로 여는 구조이며 컨테이너 바인딩이 없다.
drive.file만으로는 설치센터가 만든 시트를 학교 앱 권한으로 여는 경로가 보장되지 않음.

## C. 학교 런타임 목표

- 공개 제출 경로: QR 토큰 검증만. Google 로그인 불필요 유지.
- 관리자 경로: `userinfo.email` + 관리자 허용목록 + Sheet/Drive 실제 권한. 공용 토큰 fallback 제거.
- scope 변경 시 추가 승인 화면이 생길 수 있음을 안내에 명시 (승인 감추기 금지).

## 2026-09-08 공식 계약 재확인

- [Drive 폴더 이동](https://developers.google.com/workspace/drive/api/guides/folder): files.update/PATCH 계약. 로컬 수정 반영, 실제 Google 이동은 이번 실행에서 미검증.
- [버전 생성](https://developers.google.com/apps-script/api/reference/rest/v1/projects.versions/create): script.projects 필요. 기존 설정은 이미 두 script scope를 요청하므로 요청 권한을 확대하지 않고 문서 오류만 정정했다.
- [GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model): 요청 scope와 실제 승인 scope를 구분해야 한다. grant 검증 Muse 수정안을 검토 후 원본에 통합했으며 합성 GIS 회귀4개가 통과했다. 실제 Google 승인·설정·동의 화면 준비 완료를 뜻하지 않는다.

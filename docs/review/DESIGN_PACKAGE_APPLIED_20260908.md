# 디자인 패키지 적용 결과 — 2026-09-08

## 실행과 범위

- 구현 실행: OpenCode CLI, `opencode-go/muse-spark-1.3-contributor`, `--variant xhigh`.
- 모델 목록에서 xhigh 지원 확인 후 실제 합성 응답 `MUSE_SMOKE_OK` 확인. 본 구현에는 xhigh를 명시했다.
- Codex 역할: 사전 점검, 작업 전달, 원본 디자인 CSS의 기계적 복사, 결과 검토·통합·로컬 테스트·브라우저 검증.
- 입력: 사용자가 제공한 디자인 패키지의 분리된 HTML/CSS/문서, 공개 설치센터 소스 및 합성 테스트. 실제 학교 데이터나 인증 비밀값은 전달하지 않았다.
- 대상 저장소: `D:\opencode\QR-check`, 브랜치 `work/school-owned-web`, 실제 UI 경로 `installer/`.
- 원본 ZIP, 기존 미커밋 변경을 보존했다. 이번 작업에서 Apps Script, 전역 AGENTS, 모델 전역 설정은 수정하지 않았다. 커밋·푸시·배포하지 않았다.

## 변경 파일

- 6개 화면: `installer/index.html`, `installer/maker/index.html`, `installer/demo/index.html`, `installer/guide/index.html`, `installer/help/index.html`, `installer/update/index.html`.
- 공통 스타일·UI: `installer/assets/site.css`, `installer/assets/site.js`, 새 `installer/assets/tokens.css`, 새 `installer/assets/site-overrides.css`.
- 운영 UI 연결: `installer/maker/maker.js`, `installer/demo/demo.js`.
- 정적 패키징: `tools/build-site.mjs` — CSS 두 파일을 추가하여 22개 허용 파일.
- 테스트: `installer/tests/site-shell.test.mjs`, `installer/tests/site-content-build.test.mjs`, `installer/tests/maker-states.test.mjs`, `installer/tests/demo-isolation.test.mjs`, 새 `installer/tests/demo-detail-confirm.test.mjs`.
- 이 결과 문서.

## 보존 및 디자인 검토

- `site.css`와 `tokens.css`는 첨부 디자인 원본과 동일하다. 운영 연결에 필요한 보완 CSS는 별도 파일이다.
- 흰 바탕·블루·민트, 큰 제목, 겹친 PC/휴대전화 예시, 네이비 학교 소유 설명 영역을 원본 미리보기와 비교했다.
- 초안의 재작성 CSS에서 색상·카드 차이와 모바일 설치 화면 가로 넘침을 발견해 반영 전에 수정했다.
- 설치 화면의 4개 표시는 실제 상태를 읽어 표시한다. 실제 인증/API/승인/VERIFIED 전이는 변경하지 않았다. 미리보기 전용 단계 이동과 예시 채우기는 제거했다.
- 실제 작업·오류·재시도·승인 안내를 숨기지 않도록 설치 세부 영역은 함께 표시한다. 따라서 시안의 가짜 다음 단계 버튼으로 전환하는 방식과는 동작이 다르다.
- `installer/src/**`와 `release-data.js`, `demo/sample-store.mjs`, `update/update-page.js` 총 13개 파일을 적용 전 사본과 해시 비교하여 그대로 보존했음을 확인했다.
- 원본 변경 파일은 통합 직전 다시 비교해 동시 변경이 없음을 확인하고 백업했다.

## 확인한 기능과 검사 결과

- 설치센터 Node 테스트: 130/130 통과, 실패 0. 통합 후 실제 저장소에서도 재실행했다.
- 정적 빌드: 성공, 허용 파일 22개, runtime 파일 0개, `unpublished`.
- Chromium 브라우저: 6개 화면 × 320/390/768/1440px = 24개 레이아웃 통과. 가로 넘침 및 중복 ID 없음.
- 390px·1440px의 주요 동작 11개 묶음 통과: 설치 차단과 미리보기 우회 없음, 미게시 상세 숨김, 도움말 검색/빈 결과/복원/분류/딥링크, 사용안내 탭/키보드/딥링크, 체험 등록/필터/상세/확인/CSV/초기화, 모바일 메뉴 이동.
- 브라우저 JavaScript pageerror: 0.
- 체험은 가상 메모리 저장소를 유지한다. 조치 필요 기록은 상세를 연 뒤 명시적으로 확인하며, 정상 기록 일괄 확인은 조치 필요 기록을 확인 처리하지 않는다. 빈 목록과 관리자 탭의 피드백 표시를 보완했다.
- 기존 표시 문구·7단계 레이아웃·파일 수에 묶인 테스트만 새 디자인에 맞췄고, 운영/보안 검사는 유지했다. 단계 표시와 조치 필요 상세 확인에 대한 회귀 검사를 추가했다.
- 현재 로컬 미리보기 `http://127.0.0.1:57919/`에서도 새 제목과 가로 넘침 없음을 확인했다.

## 준비되지 않은 설정 / 검증하지 않은 기능

- `GOOGLE_OAUTH_CLIENT_ID`는 빈 문자열이다. 운영자는 실제 OAuth 웹 클라이언트와 승인된 설치센터 origin, 필요한 Google API/동의 설정을 준비해야 한다.
- 소스 릴리스는 `unpublished`, runtime 배열은 비어 있다. 검증된 런타임과 릴리스 정보를 제공하는 정식 빌드 준비가 필요하다.
- Google 로그인·권한 부여·학교별 Sheets/Drive/Apps Script 생성·배포·초기 설정·실제 기록 및 첨부 저장·운영 업데이트는 이번 작업에서 실행하거나 성공 확인하지 않았다.
- 자동 브라우저 검사는 외부 GIS 스크립트를 빈 응답으로 대체한 로컬 UI 검사다. 실제 Google 연결 검증이 아니다.
- 체험 CSV는 합성 데이터만 확인했다. 실제 첨부 업로드는 체험 기능에 포함되지 않는다.

## 로컬 증빙

- 브라우저 스크린샷/JSON: `C:\Users\h19h2\.codex\visualizations\2026\09\08\01a07ef1-33d8-7231-ad09-b2c4d91d28b7\qr-design-applied`.
- OpenCode 실행 기록: `C:\Users\h19h2\AppData\Local\Temp\modellgihjt-muse-iTZvBy`, 세션 `ses_f7f3549b2ffe0LrdfL7ewcjibe`.
- 파일 해시 및 통합 기록: `C:\Users\h19h2\AppData\Local\Temp\qr-muse-xhigh-20260908\integration-manifest.json`.
- 통합 전 원본 백업: `C:\Users\h19h2\AppData\Local\Temp\qr-muse-xhigh-20260908\pre-integration-backup`.

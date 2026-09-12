# CURRENT_STATE — 2026-09-07 실측 기록 (Asia/Seoul)

> 최신 상태: [2026-09-12 공개 배포·학교 사용 준비 상태](PUBLIC_READINESS_20260912.md). 아래는 이전 구조의 역사적 분석이며 현행 배포·보안 구현 상태가 아니다.

기준: `main` = `d416bde` (Harden setup and release packaging). 검토 문서의 참고 커밋과 동일.
작업 브랜치: `work/school-owned-web` (main에서 분기, main은 untouched).
클론 시점 트리 clean, 미커밋 변경 없음 → 보존할 사용자 변경 없음 확인.
저장소 공개 상태: 작업 시작 시점에 사용자가 직접 private → public 전환 (에이전트가 전환하지 않음).

## 파일 인벤토리 (실측)

- `apps-script/`: Auth.gs, Sheets.gs, Submit.gs, Admin.gs, Api.gs, Code.gs, DriveFiles.gs,
  DesktopSync.gs, Templates.gs, Client.js.html, Submit.html, Admin.html, WebApp.html,
  Styles.html, appsscript.json, README_DEPLOY.md
- `admin-desktop/`: PySide6 Windows 관리자 (src/app, src/ui, tests 5종, scripts 3종) — 보존 대상
- `docs/`: 00~11 + ADR 1건 (일부 파일명 한글 깨짐, 내용 유지)
- `release/`: 미리보기 HTML 목업 5종 (실사용 검증 아님)
- `sample-data/`, `tools/inspect_legacy.py`, `legacy/`(README 언급, 클론에 없음 — 확인 필요 시 별도)
- 테스트: `admin-desktop/tests/` pytest 5종. `apps-script/` 테스트 없음 ← 이번 작업에서 신설.

## 시크릿 스캔 (실측)

`client_secret|AIza|ya29\.|*_hash 값|@gmail|@*.kr` 패턴으로 `*.gs/html/py/json/md/ps1` 전수 검색 → **0건**.
`.gitignore`에 `.env, token*.json, credentials*.json, *sync_key*, *admin_token*` 포함 확인.

## 소스 재확인 — P0/P1 (파일:행 기준, 수정 전 상태)

| ID | 위치 | 확인 내용 |
|---|---|---|
| P0-1 | Auth.gs:16-26 | `verifyAdmin_` — Google 이메일 실패 시 공용 관리자 토큰 fallback |
| P0-2 | Sheets.gs:25-27 | `ss_()` = `getActiveSpreadsheet()` — 독립 웹배포에서 바인딩 없음 |
| P0-3 | Submit.gs:119-136 | `normalizeStatus_` — 누락/오류/잘못된 JSON을 `이상 무`로 강제 변환 |
| P0-4 | Submit.gs:36-69 | `submitInspection_` — 기록 확정 후 첨부/로그 실패 시 확정 기록의 파일까지 휴지통행 (확정 자료 훼손). 동일 record_id 재전송은 내용 비교 없이 `duplicate:true` (충돌 미검출) |
| P1-1 | Admin.gs:61-78 | `saveRoomFromAdmin_` — 토큰 미전달 시 항상 새 토큰 생성 → 실 이름 수정이 QR 무효화로 이어짐 |
| P1-2 | Client.js.html:92, 241 | 항목 라디오 기본 `checked=true`(명시적 전체 정상 없음), `toISOString().slice(0,10)` UTC 날짜 |
| P1-3 | Client.js.html:212-229 | `resendPending` — 만료 자료 무통보 삭제, 재전송/삭제 UI 없음 |
| P1-4 | Submit.gs:93-115 | snapshot 없음 (항목명/버전/실명/점검자 당시값 미보존), 관찰시간/접수시간 미구분 |
| P1-5 | Code.gs:4-22 | 단일 배포 + `?page=` 라우팅. PUBLIC/ADMIN 분리 없음 |

## 아키텍처 현주소

- 단일 Apps Script 배포, 실행 `나(소유자)`, 접근 `모든 사용자`, `?page=submit/admin/setup/csv` 분기.
- 관리자 인증 = Google 이메일(비면 실패) + 관리자 토큰 병행. Desktop = Sync Key 별도 (Windows 프로그램 호환용으로 유지).
- 첨부: 이미지/PDF, 5MiB/파일, 10개/제출, 시그니처 검사 있음. HEIC/HEIF 허용 표기이나 실기기 검증 없음.
- 날짜/시간: 서버 Asia/Seoul (`Code.gs:69-75`), 클라이언트 UTC 혼재.

## 다음 단계 연결

- Phase 1: `SchoolConfig.gs` + `SchemaMigrations.gs` + `requireAdmin_()` + 빌드 분리.
- Phase 2: 엄격 상태값 + 멱등/충돌 + snapshot + KST + 부분실패 + 클라이언트 수정.
- 실계정 검증 9항목은 `GAS_FEASIBILITY.md`로 이동, live는 NOT_TESTED로 시작.

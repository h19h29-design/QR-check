# Live Validation Report — Gmail 1사이클

> 계획서·unit test로 PASS를 대체하지 않는다. 아래 표는 live 실행 증거가 있을 때만 갱신한다.

## 환경

- 테스트 날짜: 2026-09-08 (KST 21:32 setup 완료)
- 테스트 계정 유형: Gmail 개인 1개 (h19h29@gmail.com, 소유자 실행 확인)
- runtime version: v7 (deployment AKfycbwBOB87... 동일 ID 유지)
- 브라우저: 사용자 PC Chrome (수동) + 서버측 fetch 검증

## 기준점 (Phase 0, 2026-09-08)

- `node --test`: 52/52 PASS (tests/gas 6종 35 + installer 3종 17)
- `node tools/build-runtime.mjs`: PASS (public 12/admin 18, manifest+sha256)
- secret scan: 0건

## 생성된 Google 리소스

| 항목 | 값 |
|---|---|
| Spreadsheet ID | 1nJbfnom7R6IC8v18lkBGi8T4plUtz9wtQQcYDLLtx4E (`QR_CHECK_E2E_20260908_점검기록`) |
| Drive folder ID | 학교 시트 기준 자동 생성 (설치 응답 확인, ID 별도 기록 예정) |
| Script ID | 1gOWQ3SCoawcVUo3Z4oBpfRFRZ__283LqyT8sEnacI2KXtk5bG4QfvFxd (컨테이너: 기존 테스트 시트, 독립 바인딩으로 E2E 시트 사용) |
| version number | v7 (v1 사용자 배포 → v2~v7 API 업데이트, 동일 deployment ID 유지) |
| deployment ID | AKfycbwBOB87gJ8cW6iQzgL8_GpXZN-o4oU3CdcmhyXNIt3DFptYmn6676agyiXD-deMQgC9 |
| web app URL | 발급됨, 진입점 복구 후 200 확인 (URL은 사용자 보관) |

테스트 리소스 prefix: `QR_CHECK_E2E_20260908_`. 테스트 데이터는 가상값만
(학교명 `QR체크 테스트학교`, 행정실/교무실/도서실, 테스트관리자).

## 생성된 Google 리소스

| 항목 | 값 |
|---|---|
| Spreadsheet ID | (미생성) |
| Drive folder ID | (미생성) |
| Script ID | (미생성) |
| version number | (미생성) |
| deployment ID | AKfycbwBOB87gJ8cW6iQzgL8_GpXZN-o4oU3CdcmhyXNIt3DFptYmn6676agyiXD-deMQgC9 (2026-09-08 발급 확인) |
| web app URL | (발급됨, 사용자 보관. URL 발급 ≠ 동작 검증) |

테스트 리소스 prefix: `QR_CHECK_E2E_YYYYMMDD_`. 테스트 데이터는 가상값만
(학교명 `QR체크 테스트학교`, 행정실/교무실/도서실, 테스트담당자1/테스트당직자1).

## 테스트 결과

| Test | Result | Evidence |
|---|---|---|
| Installer OAuth | NOT_TESTED | 수동 경로로 진행 (client ID 미설정). 자동 설치기는 코드·단위검증만 완료 |
| Spreadsheet creation | PASS | setup.initialize가 E2E 시트에 8개 테이블 생성 (setup_completed=true) |
| Drive creation | PASS | ensureDriveFolders_ 성공 (루트+uploads+exports) |
| Apps Script creation | PASS | 기존 테스트 프로젝트 활용 (소유자 h19h29@gmail.com 확인) |
| Runtime upload | PASS | clasp 전체교체 18파일 + 원격 재조회 일치 확인 |
| Deployment | PASS | /exec 200, health 200, 동일 deployment ID로 v1→v7 업데이트 유지 |
| setup.initialize | PASS | 2026-09-07T21:32+09:00, 학교·관리자·장소 3곳 생성 |
| Admin auth (google_only) | PASS | 소유자 ?page=admin 접속, 장소 3곳·제출 주소 표시 확인 (2026-09-08) |
| Normal submission | NOT_TESTED | 다음 단계 (휴대폰 제출) |
| Abnormal submission | NOT_TESTED | |
| Attachment | NOT_TESTED | |
| Duplicate request | NOT_TESTED | |
| Conflict request | NOT_TESTED | |
| QR rename | NOT_TESTED | |
| QR reissue | NOT_TESTED | |
| PARTIAL recovery | NOT_TESTED | 코드·테스트는 완료(부분 4종), live 미실시 |
| Update (URL 보존) | NOT_TESTED | 코드·테스트는 완료, live 미실시 |
| Rollback | NOT_TESTED | 코드·테스트는 완료, live 미실시 |
| Installer independence | NOT_TESTED | |
| Excel export | NOT_TESTED | |
| KST consistency | NOT_TESTED | |
| Attachment privacy | NOT_TESTED | |

## 실패사항

(없음 — live 미실시)

## 수정사항 (live 전 구현, local 검증 완료)

1. 설치센터 Google 계층 신규 (`installer/src/auth`, `installer/src/google`, orchestrator, update)
2. PARTIAL 복구 기능 (목록·재처리·정리 + 관리자 화면 버튼)
3. OAuth scope ↔ endpoint 표 분리 문서화

## NOT_TESTED 요약

- Google live 전 항목, Workspace 전 항목, HEIC 실기기, 비숙련자 관찰 테스트

## 다음 단계

1. 제작자 OAuth 준비 후 Gmail 1사이클 실행
2. 위 표 증거 기입 → RELEASE_READINESS 갱신
3. 교육기관 계정 확보 시 EDU 체크리스트 실행

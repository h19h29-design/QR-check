# Live Validation Report — Gmail 1사이클

> 계획서·unit test로 PASS를 대체하지 않는다. 아래 표는 live 실행 증거가 있을 때만 갱신한다.

## 환경

- 테스트 날짜: (미실시)
- 테스트 계정 유형: Gmail 개인 1개 (승인됨, 미사용)
- 브라우저: (기록 예정)
- runtime version: v0.1.0 (현행), 업데이트 검증용 `1.1.1-test` 예정

## 기준점 (Phase 0, 2026-09-08)

- `node --test`: 49/49 PASS (tests/gas 5종 34 + installer 3종 15)
- `node tools/build-runtime.mjs`: PASS (public 12/admin 18, manifest+sha256)
- secret scan: 0건
- 커밋: `work/school-owned-web` (live 전 HMAC QR + 웹 실 관리 포함)

## 생성된 Google 리소스

| 항목 | 값 |
|---|---|
| Spreadsheet ID | (미생성) |
| Drive folder ID | (미생성) |
| Script ID | (미생성) |
| version number | (미생성) |
| deployment ID | (미생성) |
| web app URL | (미생성) |

테스트 리소스 prefix: `QR_CHECK_E2E_YYYYMMDD_`. 테스트 데이터는 가상값만
(학교명 `QR체크 테스트학교`, 행정실/교무실/도서실, 테스트담당자1/테스트당직자1).

## 테스트 결과

| Test | Result | Evidence |
|---|---|---|
| Installer OAuth | NOT_TESTED | client ID 미설정(제작자 준비 미완) |
| Spreadsheet creation | NOT_TESTED | |
| Drive creation | NOT_TESTED | |
| Apps Script creation | NOT_TESTED | |
| Runtime upload | NOT_TESTED | |
| Deployment | NOT_TESTED | |
| Admin auth (google_only) | NOT_TESTED | |
| Normal submission | NOT_TESTED | |
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

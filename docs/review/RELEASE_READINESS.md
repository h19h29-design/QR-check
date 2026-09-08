# RELEASE_READINESS — 출시 판정표 (2026-09-08)

작업 브랜치: `work/school-owned-web`. 코드 기준 `5f4df10`, 테스트 배포 version 11.
`PASS`는 이번 실행 증거가 있을 때만 사용한다. 상세 증거는 `LIVE_VALIDATION_REPORT.md`를 따른다.

## 현재 판정

**일반 학교 출시: 보류**

Gmail 테스트에서 핵심 경로(관리자 주소 → 다른 브라우저 제출 → 실제 Sheet → 관리자 동일 기록)는 PASS다. 사진 첨부 live, 실제 QR 스캔, 미등록 관리자 live, 설치센터 차단, 실기기·교육기관 Workspace가 아직 남아 있다.

## 완료된 게이트

| 게이트 | 결과 | 근거 |
|---|---|---|
| 로컬 회귀 | PASS | Apps Script 43 + Windows 관리자 16 = 59 |
| 빌드 분리 | PASS | public 12/admin 18, 비밀 패턴 0 |
| 안전한 실행 식별 | PASS | health에 `app_version`·`build_id`만 포함, 이메일/Sheet ID 진단 제거 |
| 테스트용 인증 우회 제거 | PASS | `TEST-SETUP`/`testBootstrap` 우회 제거 및 회귀 테스트 |
| canonical 제출 URL | PASS | iframe fallback 제거, `/dev`·임의 호스트 거부, 관리자 링크/복사 live 일치 |
| 정상 제출 E2E | PASS | 다른 브라우저 → `COMMITTED` → 실제 Sheet → 관리자 상세 동일 기록 |
| 관리자 조회 직렬화 | PASS | Sheets Date를 UI 경계 KST 문자열로 변환, live 1건 조회/상세 |
| 업데이트 주소 보존 | PASS | 동일 deployment ID로 version 11 갱신, 기존 URL·QR 토큰·기록 유지 |
| 배포 복구 자료 | PASS | 고정 v10/v11 및 원격 소스 백업 존재 |

## 보류 게이트

| 게이트 | 결과 | 해제 조건 |
|---|---|---|
| 이상 있음 + 사진 | BLOCKED | Chrome 확장의 파일 URL 접근을 허용하고 합성 PNG 제출 |
| Drive 첨부 비공개 | NOT_TESTED | 위 제출 후 로그아웃/별도 세션에서 접근 거부 확인 |
| 실제 QR 스캔 | NOT_TESTED | 실제 출력 QR 또는 휴대폰 스캔 1회 |
| live 멱등/충돌 | NOT_TESTED | 동일 record ID 같은/다른 payload 재전송 |
| live 이름 유지/재발급 | NOT_TESTED | 테스트 전용 장소에서 이름 변경·재발급·구 QR 거부 |
| 미등록/빈 관리자 | NOT_TESTED | 별도 미등록 계정/익명 관리자 세션 |
| 설치센터 독립성 | NOT_TESTED | 설치센터 차단/권한 철회와 학교 runtime 권한을 분리해 시험 |
| 교육기관 Workspace | NOT_TESTED | 기관 테스트 계정 확보 |
| Android/iPhone 실기기 | NOT_TESTED | 실기기 1종 이상 |
| 실제 rollback | NOT_TESTED | 승인된 테스트 창에서 v10 복귀 후 v11 재적용 |

## 출시 전 필수 조건

1. 이상 있음 사진 1건과 Drive 비공개를 live PASS로 만든다.
2. 실제 QR/휴대폰 1종을 확인한다.
3. 설치센터 OAuth 제작자 준비와 학교 runtime 독립성 시험을 마친다.
4. 일반 학교 배포는 별도 사용자 승인 뒤 진행한다.

GitHub push/merge, 운영 학교 배포, 유료 연결, 중앙 DB 전환은 수행하지 않았다.

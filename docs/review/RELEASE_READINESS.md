# RELEASE_READINESS — 출시 판정표 (2026-09-08)

> 최신 상태: [2026-09-12 공개 배포·학교 사용 준비 상태](PUBLIC_READINESS_20260912.md). 아래는 역사적 기록이며 현재 배포/OAuth 상태의 기준으로 사용하지 않는다.

## 2026-09-08 local-only addendum — current status (no live Google calls)

- Date/scope: 2026-09-08, local-only. No live Google calls, push, merge, deployment, QR reissue, sharing, DNS, OAuth configuration, or rollback were performed.
- Historical Gmail live PASS evidence below is preserved as historical; full IDs/accounts/tokens are not exposed.
- Local checks: Node 172/172 PASS; Python 16/16 PASS; `git diff --check` clean; secret-pattern scan no matches.
- Runtime build: 0.1.0 `dirty=true`, public 12 / admin 18; therefore NOT_READY_TO_PUBLISH until reviewed clean commit and `dirty=false` rebuild.
- Static site: unpublished, 20 files, `runtime_file_count` 0, HTTP root/demo/update 200 locally.
- Pages: main/maker/demo/guide/help/update implemented. Maker intentionally blocked until OAuth client ID / allowed origin configured. Update intentionally unpublished with no apply action.
- Local E: identical payload idempotent; now covers `observed_at` and equal-length attachment-content conflict. Live E still NOT_TESTED.
- Local F: remains PASS for rename/reprint/reissue. Live F still NOT_TESTED.
- Local G2: covers `google_only` and `token_compat` empty/unregistered rejection; invalid setup key creates no seed sheets. Live G2 still NOT_TESTED.
- Local I boundary: reviewed/build passes, but live independence still NOT_TESTED.
- Browser: responsive/blocked-state evidence PASS as in `HOMEPAGE_VALIDATION_REPORT.md`; later final demo submit/batch click NOT_COMPLETED because in-app input API failed. This is not a PASS.
- Overall readiness: LOCAL_IMPLEMENTATION_VERIFIED, PUBLIC_SITE_NOT_DEPLOYED, LIVE_INSTALLER_NOT_VERIFIED, RELEASE_BLOCKED_BY_APPROVAL_AND_CLEAN_BUILD.
- Remaining: live OAuth/resource creation with disposable account, education Workspace, printed/mobile QR, live E/F/G2/I, real rollback, confirmed hostname/OAuth/DNS approval, clean commit/build.
- Related: `HOMEPAGE_VALIDATION_REPORT.md`, `../operator/MAIN_SITE_DEPLOY.md`.
- Executor: exact model `opencode/muse-spark-1.3-contributor-free`, fallback none, `liveProviderAttested` false.

## Historical baseline (earlier 2026-09-08 Gmail live session)

작업 브랜치: `work/school-owned-web`. 코드 기준 `5f4df10`, 테스트 배포 version 11.
`PASS`는 이번 실행 증거가 있을 때만 사용한다. 상세 증거는 `LIVE_VALIDATION_REPORT.md`를 따른다.

## 현재 판정

**일반 학교 출시: 보류**

Gmail 테스트에서 핵심 경로(관리자 주소 → 다른 브라우저 제출 → 실제 Sheet → 관리자 동일 기록)와 이상 있음 사진 첨부·Drive 비공개는 PASS다. 실제 QR 스캔, 미등록 관리자 live, 설치센터 차단, 실기기·교육기관 Workspace가 아직 남아 있다.

## 완료된 게이트 (historical — see addendum for current local counts)

| 게이트 | 결과 | 근거 |
|---|---|---|
| 로컬 회귀 | PASS | Apps Script 43 + Windows 관리자 16 = 59 |
| 빌드 분리 | PASS | public 12/admin 18, 비밀 패턴 0 |
| 안전한 실행 식별 | PASS | health에 `app_version`·`build_id`만 포함, 이메일/Sheet ID 진단 제거 |
| 테스트용 인증 우회 제거 | PASS | `TEST-SETUP`/`testBootstrap` 우회 제거 및 회귀 테스트 |
| canonical 제출 URL | PASS | iframe fallback 제거, `/dev`·임의 호스트 거부, 관리자 링크/복사 live 일치 |
| 정상 제출 E2E | PASS | 다른 브라우저 → `COMMITTED` → 실제 Sheet → 관리자 상세 동일 기록 |
| 이상 있음 사진 E2E | PASS | Chrome UI 제출 → `COMMITTED` → 관리자 동일 기록과 PNG 첨부 1건 |
| Drive 첨부 비공개 | PASS | 권한 owner-only, 무인증 직접 요청은 303이며 이미지 본문 미반환 |
| 관리자 조회 직렬화 | PASS | Sheets Date를 UI 경계 KST 문자열로 변환, live 1건 조회/상세 |
| 업데이트 주소 보존 | PASS | 동일 deployment ID로 version 11 갱신, 기존 URL·QR 토큰·기록 유지 |
| 배포 복구 자료 | PASS | 고정 v10/v11 및 원격 소스 백업 존재 |

## 보류 게이트 (live — still NOT_TESTED; local E/F/G2/I coverage in addendum above)

| 게이트 | 결과 | 해제 조건 |
|---|---|---|
| 실제 QR 스캔 | NOT_TESTED | 실제 출력 QR 또는 휴대폰 스캔 1회 |
| live 멱등/충돌 | NOT_TESTED | 동일 record ID 같은/다른 payload 재전송 |
| live 이름 유지/재발급 | NOT_TESTED | 테스트 전용 장소에서 이름 변경·재발급·구 QR 거부 |
| 미등록/빈 관리자 | NOT_TESTED | 별도 미등록 계정/익명 관리자 세션 |
| 설치센터 독립성 | NOT_TESTED | 설치센터 차단/권한 철회와 학교 runtime 권한을 분리해 시험 |
| 교육기관 Workspace | NOT_TESTED | 기관 테스트 계정 확보 |
| Android/iPhone 실기기 | NOT_TESTED | 실기기 1종 이상 |
| 실제 rollback | NOT_TESTED | 승인된 테스트 창에서 v10 복귀 후 v11 재적용 |

## 출시 전 필수 조건

1. 실제 QR/휴대폰 1종을 확인한다.
2. 설치센터 OAuth 제작자 준비와 학교 runtime 독립성 시험을 마친다.
3. 일반 학교 배포는 별도 사용자 승인 뒤 진행한다.

GitHub push/merge, 운영 학교 배포, 유료 연결, 중앙 DB 전환은 수행하지 않았다.

# RELEASE_READINESS — 출시 판정표 (2026-09-07, 정직 기록용)

작업 브랜치: `work/school-owned-web` (커밋 후 해시 기록).
`통과`는 실제 실행 근거가 있을 때만 표기한다.

## 로컬 검증 (통과)

| 묶음 | 결과 | 근거 |
|---|---|---|
| 저장 일관성 | 통과 9/9 | `node --test tests/gas/submit.test.mjs` (엄격 상태값, 멱등, 충돌, snapshot, 관찰시간, 역할) |
| 인증·QR 분리 | 통과 7/7 | `node --test tests/gas/auth-rooms.test.mjs` (google_only, 빈신원/비관리자 거부, 이름수정 QR유지, 재발급 무효, 바인딩 오류) |
| 클라이언트 정적 | 통과 4/4 | `tests/gas/client.test.mjs` (파싱, UTC 제거, 명시적 전체정상, 기본값 제거) |
| 설치 상태머신 | 통과 7/7 | `node --test installer/src/install/state-machine.test.mjs` |
| 빌드 분리 | 통과 | `node tools/build-runtime.mjs` (public 11/admin 17, 시크릿 스캔, manifest+sha256) |
| 시크릿 스캔 | 통과 | 저장소 전수 grep 0건, 빌드 스캔 통과 |

## 실계정·실기기 (미검증 — 승인 후 진행)

- GAS_FEASIBILITY 9항목 live: NOT_TESTED (Gmail 1개 승인됨, 테스트 실행은 다음 단계)
- 학교 A/B 분리, 익명 제출→관리자 조회, deployment ID 업데이트 주소 보존
- Workspace/교육 계정: 계정 미확보 → NOT_TESTED
- Android Chrome / iPhone Safari 실기기: 미확보 → NOT_TESTED
- 비숙련자 관찰 테스트: 계획만 (docs/user/01_설치.md 초안 기준)

## 출시 게이트 (남은 조건)

1. Gmail 테스트 계정에서 설치→승인→시험제출→관리자조회 1사이클
2. 설치센터 OAuth 제작자 준비 (`docs/operator/INSTALLER_OAUTH_SETUP.md` 체크리스트)
3. 실기기 1종 이상 확인 또는 미검증 명시
4. 일반 학교 배포 승인 (사용자 결정)

## 구현/배포/검증 구분

- 구현 완료: Phase 0~2 + 빌드 도구 + 설치센터 골격 (본 브랜치)
- 배포 완료: 해당 없음 (테스트 배포도 미실시)
- 실사용 검증 완료: 해당 없음
- 일반 학교 배포 승인: 해당 없음 (사용자 승인 필요)

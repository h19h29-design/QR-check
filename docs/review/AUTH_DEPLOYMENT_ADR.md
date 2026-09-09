# AUTH_DEPLOYMENT_ADR — 인증·배포 구조 결정 (2026-09-07)

## 현재 코드 대조 정정 (2026-09-08)

아래 결정은 목표와 과거 상태를 포함한다. 현재 Admin.gs/Api.gs의 실제 호출 함수는 `verifyAdmin_()`이며, 현 구현은 google_only와 token_compat 모두 빈 신원·미등록 이메일을 거부한다. 따라서 아래의 “현행 이메일 실패 시 토큰으로 통과” 및 “requireAdmin_만 호출” 표현은 현재 구현 설명으로 사용하지 않는다. `requireAdmin_()`도 존재하지만 함수 존재만으로 모든 호출 경로 검증을 주장하지 않는다.

초기 설정은 현재 `verifyInitialSetupKey_()`에 의존하며, payload 관리자 이메일과 서버 소유자 신원 일치·초기 Sheet 바인딩 순서의 보완이 남아 있다. 아래 “첫 관리자는 검증된 설치 계정”은 아직 완전히 구현·실측된 상태가 아닌 필수 조건이다.

사용자 승인으로 첫 신규 시험의 지원 범위를 **설치 소유자 Google 계정 1명**으로 제한했다. 다른 Gmail·다른 도메인·Workspace 다중 관리자는 미검증이다. `USER_DEPLOYING` 공개 웹앱에서 방문자 이메일이 항상 반환된다고 가정하지 않으며, 빈 active email을 effective email로 대체하지 않는다. [Google Session 공식 문서](https://developers.google.com/apps-script/reference/base/session)를 2026-09-08 확인했다. 이 범위 승인 자체는 Google 외부 변경 승인이나 새 학교 실연동 성공 증거가 아니다.

## 결정 1: 공용 관리자 토큰 fallback 제거 (신규 웹 경로)

- 현행 `verifyAdmin_` (Auth.gs:16-26)은 이메일 실패 시 공용 토큰으로 통과.
- 신규 관리 웹/API는 `requireAdmin_()`만 사용: `Session.getActiveUser().getEmail()` 비어 있음 → 거부 + 해결 안내.
- `getEffectiveUser()`는 공개 배포에서 실행 소유자를 반환할 수 있어 소유자 판별에 사용 금지.
- 기존 Windows 프로그램 호환: `desktop.*` + `verifyDesktop_()` 유지 (별도 Sync Key, 별도 책임).
- 기존 토큰 로그인 경로는 즉시 삭제하지 않고 `DEPRECATED` 표기 후 릴리스 노트에 제거 예고 (운영 잠금 방지).

## 결정 2: 단일 프로젝트 2배포의 한계 인정

- 같은 프로젝트의 두 배포는 코드·ScriptProperties·승인 컨텍스트를 공유한다.
- 서버는 요청이 어느 deployment로 들어왔는지 신뢰 가능하게 알 수 없어,
  **단일 프로젝트 안에서는 PUBLIC/ADMIN을 서버 코드로 강제 분리할 수 없다** (page 파라미터는 클라이언트 입력).
- 따라서 이번 작업의 강제 수단은:
  1. 모든 관리자 읽기·쓰기·출력·첨부 조회에 `requireAdmin_()` (화면 숨김 의존 금지).
  2. 공개 제출 경로는 QR 토큰 검증 이외의 데이터 노출 금지 (해당 장소·필요 이름만).
  3. `tools/build-runtime.mjs`로 PUBLIC/ADMIN 파일 묶음을 분리 생성 (향후 별도 프로젝트 배포용).
- 진정한 코드 수준 분리는 **별도 학교 소유 프로젝트 2개**가 필요하며, 이때 ScriptLock이 분리되어
  동일 Sheet 동시쓰기 보호가 약해진다 → 멱등 업서트 + 재시도 + 좁은 임계구역으로 설계하고 live에서 검증.
- live 검증 전에는 단일 배포 + 서버 권한검사를 유일한 강제선으로 문서화하고, 2배포를 완료라고 표기하지 않는다.

## 결정 3: 최초 설정 보호

- 첫 관리자는 검증된 설치 계정에서 지정. 선착순 setup URL 관리자는 금지.
- 소유자 초기화가 편집기 실행을 필요로 하면 owner-only 1회 실행으로 제한.
- `setup_completed=true` 이후 `setup.initialize`는 `requireAdmin_()` 필요.

## 검증 게이트 (Phase 0 출시 관문)

- Gmail 테스트 계정: 소유자 성공 / 비관리자 거부 / 빈 신원 거부 + 익명 QR 제출 성공.
- Workspace/교육 계정: 미확보 → NOT_TESTED 유지, 안내형 설치 표기.

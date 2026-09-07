# AUTH_DEPLOYMENT_ADR — 인증·배포 구조 결정 (2026-09-07)

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

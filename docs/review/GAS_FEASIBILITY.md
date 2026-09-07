# GAS_FEASIBILITY — Google 제약 검증표 (2026-09-07)

판정 기준: VERIFIED = 승인된 테스트 계정에서 실제 실행 확인. DOC = 공식 문서로만 확인(live 미검증).
**API 문서에 메서드가 있다는 이유로 VERIFIED 처리하지 않는다.**
테스트 계정: Gmail 1개 승인됨 (사용자 승인). Workspace/교육 계정: 미확보 → NOT_TESTED.

## 검증표

| # | 항목 | 판정 | 근거/다음 행동 |
|---|---|---|---|
| 1 | 설치센터 OAuth 후 학교 소유 Sheet·폴더·스크립트 생성 | DOC + NOT_TESTED(live) | Drive/Sheets/Apps Script REST API 존재는 문서 확인. 실제 생성·권한 경로는 사용자 Gmail 테스트 계정에서 설치센터 OAuth 승인 후 확인 필요 |
| 2 | Apps Script API 접근 OFF 시 안내·재시도 | DOC | dashboard(script.google.com) 설정에서 사용자가 직접 허용해야 함을 공식 문서로 확인(2026-09-07 fetch). 코드로 켤 수 없음. 안내 화면 구현 + live 재현은 테스트 계정에서 실시 |
| 3 | 프로젝트 생성→코드 삽입→버전→배포 후 /exec 작동 | NOT_TESTED | REST 흐름은 문서 확인. 실제 /exec 호출 성공과 승인 화면까지 테스트 계정 필요 |
| 4 | 설치센터 승인 ≠ 학교 스크립트 자체 승인 구분 | DOC | 공식 승인 가이드상 별개 흐름. 설치 마법사에 두 단계로 분리 구현. live 확인 필요 |
| 5 | 관리자 웹 선열람으로 학교 앱 자체 승인 흐름 | NOT_TESTED | 소유자 승인 1회 + 추가 편집기 실행 필요 여부는 계정 유형별로 다름. Gmail 1개로 먼저 확인 요청 |
| 6 | 공개 점검 배포 / 인증 관리자 배포 분리 | ADR 참조, NOT_TESTED | 단일 프로젝트 2배포의 서버측 강제 불가 — `AUTH_DEPLOYMENT_ADR.md` 기록. live 대안 검증 필요 |
| 7 | 기존 deployment ID 업데이트로 QR 주소 보존 | DOC + NOT_TESTED | `projects.deployments.update` 문서 존재. live에서 주소 유지 확인 필요 |
| 8 | Gmail vs Workspace/교육 계정 차이 | PARTIAL | Gmail 1개만 확보. Workspace/교육 정책(외부앱 차단 등)은 미확보 → NOT_TESTED로 표기 유지 |
| 9 | 설치센터 철회·제작자 도메인 차단 후 학교 앱 동작 | NOT_TESTED | 설계상 독립(학교 소유 자원만 사용). 차단 시험은 테스트 배포에서 실시 예정, 운영 자료 사용 금지 |

## 사용자에게 요청하는 승인 (ID/비밀번호 입력 요구 아님)

1. Gmail 테스트 계정으로 `script.google.com` 설정에서 Apps Script API 접근 허용 1회 (화면 안내 제공).
2. 설치센터 테스트용 OAuth 승인 1회 (scope 목록은 `OAUTH_SCOPE_MATRIX.md` 공개).
3. 학교 앱 자체 서비스 승인 1회 (관리자 웹 첫 접속 시 Google 승인 화면).
4. (선택) Workspace/교육 계정 1개 추가 확보 시 기관 정책 분기 검증 가능.

## 금지선 (구현이 우회하지 않는 것)

- API 접근 설정의 코드 강제 활성화, 기관 관리자 정책 우회, 개인계정 우회 안내.
- `scripts.run` 기본 경로 사용 (공통 표준 Cloud 프로젝트 제약).
- 제작자 공통 Cloud 프로젝트에 학교 연결, 서비스 계정 대리 운영.

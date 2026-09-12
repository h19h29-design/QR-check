# 공개 배포·학교 사용 준비 상태 — 2026-09-12

## 판정

**홈페이지 게시와 모든 학교의 제한 없는 사용은 별개다. 현재는 시범 제공 단계다.**

이 문서의 최신 확인이 이전 CURRENT_STATE/RELEASE_READINESS의 배포·OAuth 상태보다 우선한다. 과거 테스트 성공은 유지하되 이번 테스트 학교의 성공으로 대체하지 않는다.

| 항목 | 이번 확인 |
|---|---|
| 소스 기준 | `9ceee3e`에서 시작, 작업 트리 clean 확인 |
| 운영 홈페이지 | GitHub Pages, `https://qr-safe.h19h19.com/` |
| OAuth 대상 | Google 콘솔에서 외부·프로덕션 확인 |
| 브랜딩 | 인증 및 게시 완료 확인 |
| 민감 범위 심사 | `script.projects`, `script.deployments` 미인증 |
| 심사 제출 | 범위 근거·데모 동영상 링크 누락 오류, 확인 버튼 비활성화. 제출 완료 아님 |
| 사용자 한도 | 콘솔에 프로젝트 전체 기간 100명 한도 표시 |
| 이번 테스트 학교 | 웹앱 배포 존재. 초기 설정 함수 실행과 웹앱 모두 Google 권한 승인 대기. 초기 설정·제출 완료로 판정하지 않음 |
| 회귀 테스트 | 355/355 통과, `--experimental-vm-modules` 사용 |

## 이번 변경 범위

- 홈페이지와 설치 화면의 오래된 “등록된 테스트 사용자 전용/OAuth 테스트 상태” 설명을 현재 외부 게시·권한 심사 전 상태에 맞춘다.
- 설치·Google API·인증·업데이트 로직과 학교 데이터는 변경하지 않는다.
- 새 런타임 버전을 만들어내지 않는다. `0.1.1` 유지.
- 학교별 Sheets/Drive/Apps Script 소유 구조, 비공개 첨부, 관리자 Google 신원 확인을 유지한다.
- Muse/DeepSeek/외부 위임 없이 Codex가 직접 수행한다.

## 남은 완료 조건

1. 소유자의 학교 런타임 Google 권한 승인 및 이번 테스트 학교 초기 설정.
2. 이번 학교에서 실제 QR 제출·첨부·관리자 확인과 저장 결과 대조.
3. 실제 OAuth 동의와 Apps Script 프로젝트 생성·버전/배포를 보여주는 검토 가능한 데모 영상. 비밀 키·토큰·학교 개인정보는 노출하지 않는다.
4. Google 데이터 액세스 심사에 범위 근거와 실제 영상 링크 제출, Google의 승인 결과 확인.
5. 교육기관 Workspace 계정으로 설치·관리자 접근·익명 QR 제출을 확인. 기관 관리자 정책을 우회하지 않는다.
6. 실물 휴대전화/인쇄 QR, 파일 선택기, 업데이트·롤백의 실제 확인.

## 심사 범위 근거 초안

다음은 구현 목적을 설명하는 제출용 초안이며 Google에 저장·제출되었다는 의미가 아니다.

> QR CHECK is a static installer for school-owned Apps Script web apps. After the school administrator consents, script.projects creates the school's project, uploads the published runtime, and reads project content to verify installation and updates. script.deployments creates a versioned web-app deployment and updates that same deployment during an administrator-requested upgrade or rollback, preserving existing QR URLs. drive.file cannot create Apps Script projects or deploy them, so both Apps Script scopes are needed. School records and attachments stay in each school's Sheets and Drive; our server does not collect them or store school setup keys or OAuth tokens.

## 기록 주의사항

과거 0.1.1 E2E 증거는 `LIVE_PROGRESS_20260910.md`의 2026-09-11 추가 기록을 참고한다. 이번 승인 대기 상태와 혼동하지 않는다. 실제 계정, 전체 학교 자원 ID, QR 토큰, 초기 설정 키는 공개 문서에 기록하지 않는다.

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
| 이번 테스트 학교 | 사용자 Google 승인 후 초기 설정 완료, 장소 2곳 및 합성 담당자 등록, 정상 QR 제출과 관리자 동일 기록 상세의 COMMITTED 확인 |
| 회귀 테스트 | 355/355 통과, `--experimental-vm-modules` 사용 |

## 이번 변경 범위

### Google 승인 후 후속 확인

- 사용자 승인 후 소유자 초기 설정 키 생성 성공. 테스트 학교 초기 설정 응답의 `setup_completed=true`, 장소 2곳, 런타임 `0.1.1` 확인.
- 테스트 학교에 합성 담당자 1명 등록. 실제 QR 양식에서 정상 항목 5개와 합성 비고를 전송해 제출 완료 확인.
- 관리자 목록·상세에서 같은 기록번호와 비고, `save_state=COMMITTED`를 대조. 동일 로그인 브라우저에서 진행했으므로 새 익명 세션 검증으로 주장하지 않는다.
- 관리자 메모를 입력하고 개별확인 후 상세를 다시 조회해 같은 기록의 `admin_verified=true` 및 메모 저장을 확인.
- 이번 제출에는 첨부 없음. 파일 선택기·첨부 경로와 실제 휴대전화 검증은 별도다.
- DeepSeek는 OpenCode CLI의 `opencode-go/deepseek-v4-flash`를 공개·합성 정보로 호출했으나 중국 호스팅 별도 동의 필요(HTTP 403)로 실행 실패. 결과물·파일 변경 없음. 계정 토큰·학교 비밀 전송 및 지역 설정 변경 없음. 후속 실제 작업은 Codex가 직접 수행.

### 홈페이지 변경 범위

- 홈페이지와 설치 화면의 오래된 “등록된 테스트 사용자 전용/OAuth 테스트 상태” 설명을 현재 외부 게시·권한 심사 전 상태에 맞춘다.
- 설치·Google API·인증·업데이트 로직과 학교 데이터는 변경하지 않는다.
- 새 런타임 버전을 만들어내지 않는다. `0.1.1` 유지.
- 학교별 Sheets/Drive/Apps Script 소유 구조, 비공개 첨부, 관리자 Google 신원 확인을 유지한다.
- Muse/DeepSeek/외부 위임 없이 Codex가 직접 수행한다.

## 배포 후 확인

- 소스 `f9ebeb8`을 main에 fast-forward 및 push. 런타임 `0.1.1`, `dirty=false`, public 12/admin 18파일, 정적 사이트 25파일 빌드 성공.
- 홈페이지 `gh-pages` 배포 커밋 `82dca3b`. GitHub Pages 실행 `34672892763` completed/success 확인.
- 운영 `release-data.js` HTTP 200 및 source commit `f9ebeb831b1aa8e9ab174448a0357cd5fc8444d0` 확인.
- 홈페이지·maker·demo·guide·help·update·privacy 7경로 HTTP 200 확인. HTTP 결과는 기능 E2E 증거가 아니다.
- 운영 브라우저에서 FAQ 펼침, 수정 안내 표시, 홈페이지 → 학교 만들기 이동, Google 연결 준비 상태와 게시 버전 0.1.1 확인.
- 임시 `verify-9ceee3e/` 사이트 복사본 25파일만 제거. Git 이력에서 복구 가능하며 학교 자원·기록은 삭제하지 않음.
- 이번에는 실물 휴대전화 및 390px/1440px 재검사를 수행하지 않음. 이전 결과를 이번 실행 결과로 주장하지 않음.

## 남은 완료 조건

1. 소유자 Google 승인·초기 설정·정상 QR 제출과 관리자 상세 대조는 완료. 아래의 미검증 경로를 이어서 확인.
2. 이번 학교에서 첨부·별도 익명 세션의 저장 결과를 대조. 정상 기록 관리자 확인 저장은 완료.
3. 실제 OAuth 동의와 Apps Script 프로젝트 생성·버전/배포를 보여주는 검토 가능한 데모 영상. 비밀 키·토큰·학교 개인정보는 노출하지 않는다.
4. Google 데이터 액세스 심사에 범위 근거와 실제 영상 링크 제출, Google의 승인 결과 확인.
5. 교육기관 Workspace 계정으로 설치·관리자 접근·익명 QR 제출을 확인. 기관 관리자 정책을 우회하지 않는다.
6. 실물 휴대전화/인쇄 QR, 파일 선택기, 업데이트·롤백의 실제 확인.

## 심사 범위 근거 초안

다음은 구현 목적을 설명하는 제출용 초안이며 Google에 저장·제출되었다는 의미가 아니다.

> QR CHECK is a static installer for school-owned Apps Script web apps. After the school administrator consents, script.projects creates the school's project, uploads the published runtime, and reads project content to verify installation and updates. script.deployments creates a versioned web-app deployment and updates that same deployment during an administrator-requested upgrade or rollback, preserving existing QR URLs. drive.file cannot create Apps Script projects or deploy them, so both Apps Script scopes are needed. School records and attachments stay in each school's Sheets and Drive; our server does not collect them or store school setup keys or OAuth tokens.

## 기록 주의사항

과거 0.1.1 E2E 증거는 `LIVE_PROGRESS_20260910.md`의 2026-09-11 추가 기록을 참고한다. 이번 승인 대기 상태와 혼동하지 않는다. 실제 계정, 전체 학교 자원 ID, QR 토큰, 초기 설정 키는 공개 문서에 기록하지 않는다.

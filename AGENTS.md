# AGENTS.md

## 목표 (2026-09-07 확정, 이전 중앙 SaaS 설계 폐기)

- 학교가 **자기 Google 계정에 소유하는 독립 웹앱**(Sheet + Drive 폴더 + Apps Script + 공개 QR 주소 + 관리자 주소)을 설치·운영한다.
- 제작자는 프로그램 개발, 설치센터(정적 웹), 사용법, 업데이트 배포만 담당한다.
- 학교 점검기록·직원정보·사진·관리자 계정을 제작자 서버나 중앙 DB에 모으지 않는다.
- 설치센터·제작자 OAuth·제작자 GitHub가 꺼져도 학교 일상 운영(제출·조회·출력)이 작동해야 한다.
- 학교 사용자에게 Windows EXE, Python/Node/Git/Docker, GitHub·Cloudflare·Vercel·Supabase 계정, API 키, 환경변수 입력을 요구하지 않는다.
- "Google 로그인 한 번이면 모든 계정에서 무조건 자동 설치" 가정을 폐기한다. 승인 안내는 설치 마법사의 정식 단계다.

## 작업 원칙

- PowerShell 기준으로 실행한다. CMD 명령어는 사용하지 않는다.
- 현재 브랜치 상태를 먼저 확인하고, 사용자 미커밋 변경을 보존한 작업 브랜치에서 진행한다.
- 기존 기능보다 후퇴하지 않는다. 특히 QR 제출, 담당자/당직자 선택, 이상 무/이상 유, 항목별 첨부, 특이사항, 상세보기, 관리자 확인, 날짜별 조회, 엑셀 출력, QR 생성, 일괄확인을 유지한다.
- 설계 → 최소 실패 테스트 → 구현 → 관련 테스트 → 핵심 스모크 순서로 진행한다.
- `git reset --hard`, `git clean -fd`, 강제 푸시, 자동 push, 저장소 공개 전환, 운영 데이터 삭제, DNS 덮어쓰기, 유료 전환을 승인 없이 하지 않는다.
- 전역 AGENTS.md·다른 프로젝트·모델 전역 설정은 수정하지 않는다.

## 보안 기준

- 점검자는 Google 로그인 없이 `room_id + submit_token` QR로 제출한다.
- `submit_token`은 평문 저장하지 않고 hash로 검증한다.
- 새 웹 관리자 경로는 Google 계정 전용이다. 공용 관리자 토큰 fallback은 신규 경로에서 제거한다(`requireAdmin_()`).
  기존 Windows 프로그램 호환용 `verifyDesktop_()`(Sync Key)는 유지하되 신규 웹 로그인에 쓰지 않는다.
- 클라이언트가 보낸 email/role은 권한 근거가 아니다. 빈 신원은 거부한다.
- 첨부파일은 이미지/PDF만 허용하며 기본 5MB 제한을 둔다. 시그니처 검사를 유지한다.
- 이상 없음만 일괄확인 가능하고, 이상 있음은 상세보기 후 개별확인만 가능하다.
- 실제 관리자 이메일, Client Secret, 토큰, Sync Key, 학교 비밀값을 코드·배포물에 넣지 않는다.

## 산출물 위치

- 학교 런타임: `apps-script/`
- 설치센터(정적): `installer/`
- 빌드 도구: `tools/build-runtime.mjs`, `tools/build-release.mjs`
- 검증 문서: `docs/review/` (CURRENT_STATE, GAS_FEASIBILITY, OAUTH_SCOPE_MATRIX, AUTH_DEPLOYMENT_ADR, RELEASE_READINESS)
- 운영자 문서: `docs/operator/` / 사용자 문서: `docs/user/` / 개인정보: `docs/privacy/`

## 서브에이전트 운용

사용자는 서브에이전트 사용을 명시적으로 허용했다.

우선 위임할 작업:

- Legacy Analyst: 기존 Flask/SQLite/템플릿/PDF/HWP 자료 분석
- Product Architect: 전체 아키텍처와 데이터 흐름 설계
- Google Apps Script Engineer: Apps Script 웹앱/Sheet/Drive 구현 검토
- Desktop Engineer: Windows 관리자 프로그램 구현 검토
- HWP/Template Engineer: 한글/HWP/HWPX/엑셀/PDF 출력 검토
- Security/Privacy Reviewer: 권한, 토큰, 개인정보, 무료배포 위험 검토
- QA/Release Engineer: 테스트, 패키징, 배포문서 검토

바로 다음 단계가 막히는 핵심 구현은 메인 에이전트가 직접 처리한다.

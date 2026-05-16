# AGENTS.md

## Supabase 모드 작업 지침

- 기존 Google Apps Script / Google Sheet / Google Drive 방식은 기본값이며 회귀를 최우선으로 보호한다.
- Supabase는 선택 가능한 저장소 모드로만 추가한다.
- 학교별 Supabase 프로젝트를 전제로 하며 중앙 서버, 개발자 서버, 개인 NAS 의존을 만들지 않는다.
- service_role key는 코드, QR URL, 정적 제출 페이지, 로컬 설정, 문서 예시에 넣지 않는다.
- Supabase anon public key와 Desktop Sync Key를 구분한다. Desktop Sync Key는 DB에는 hash로, 로컬에는 DPAPI 보호값으로 저장한다.
- QR URL에는 `roomId`, `token`, `org`만 넣고 Supabase anon key를 넣지 않는다.
- 주요 완성 산출물은 가능하면 `C:\Users\user\Downloads`에도 복사한다.

## 작업 원칙

- 이 저장소는 "QR보안점검표 Google Drive 중간서버형 무료배포 시스템"을 끝까지 제작하기 위한 작업 공간이다.
- PowerShell 기준으로 실행한다. CMD 명령어는 사용하지 않는다.
- 초보자가 따라 할 수 있도록 문서와 스크립트는 자세하고 복사 가능한 형태로 작성한다.
- 내 NAS, 내 서버, 유료 클라우드 서버를 중간 서버로 사용하지 않는다.
- 학교별 Google Drive, Google Sheet, Google Apps Script를 중간 저장소와 서버리스 계층으로 사용한다.
- 실제 Google Client Secret, 토큰, 관리자 이메일, 동기화 키는 코드에 하드코딩하지 않는다.
- 민감정보는 `.env`, 로컬 JSON 설정, OS credential store에 두고 `.gitignore`에 포함한다.
- 기존 기능보다 후퇴하지 않는다. 특히 QR 제출, 담당자/당직자 선택, 이상 무/이상 유, 항목별 첨부, 특이사항, 상세보기, 관리자 확인, 날짜별 조회, 엑셀 출력, QR 생성, 일괄확인을 유지한다.

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

## 산출물 위치

- 메인 프로젝트: `D:\gpt\QR\qr-security-check`
- 주요 완성 압축본: `C:\Users\user\Downloads`
- 작업 요약 가능 위치: `D:\My_Digital_Brain\04_Inbox`

## 보안 기준

- 점검자는 Google 로그인 없이 `room_id + submit_token` QR로 제출한다.
- `submit_token`은 평문 저장하지 않고 hash로 검증한다.
- 관리자 웹은 Google 계정 기반을 목표로 하되 Apps Script 이메일 확인 한계 때문에 관리자 토큰 fallback을 병행한다.
- Desktop sync key는 관리자 토큰과 분리하고 hash 저장을 우선한다.
- 첨부파일은 이미지/PDF만 허용하며 기본 5MB 제한을 둔다.
- 이상 없음만 일괄확인 가능하고, 이상 있음은 상세보기 후 개별확인만 가능하다.

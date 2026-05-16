# 이중 저장소 모드 안내

## Google Drive 방식

- 기존 방식
- Google Apps Script, Google Sheet, Google Drive 사용
- 점검자는 Google 로그인 없이 QR 제출
- 관리자 프로그램은 Apps Script URL과 Desktop Sync Key로 동기화
- 이미 Google 방식으로 운영 중인 학교는 그대로 유지 권장

## Supabase 방식

- 각 학교가 자기 Supabase 프로젝트를 만들어 사용
- 학교 PC가 꺼져 있어도 Supabase와 정적 제출 페이지가 살아 있으면 QR 제출 가능
- 관리자 프로그램은 나중에 켜졌을 때 Supabase에서 데이터를 내려받음
- Supabase URL, anon public key, 학교 코드, 제출 페이지 주소, Desktop Sync Key 필요

## 어떤 방식을 고를까

- Google Workspace/Drive 운영이 익숙하고 기존 배포가 끝난 학교: Google Drive 방식
- 학교 PC가 자주 꺼져 있고 24시간 제출 가능성이 중요한 학교: Supabase 방식
- 데이터베이스 백업/Export를 학교가 직접 관리하고 싶은 학교: Supabase 방식

## 공통 유지 기능

- 실 관리
- 담당자/당직자 관리
- 점검항목 관리
- QR 생성
- 점검기록 동기화
- 관리자 확인
- 출력/보관
- 로컬 SQLite 캐시

## 주의

Supabase 방식도 무료 플랜 정책의 영향을 받는다. Supabase 가격/플랜 문서에 따르면 Free 플랜은 DB/Storage 용량 제한과 비활성 프로젝트 pause 정책이 있으므로, 실제 상시 운영 학교는 프로젝트 상태와 용량을 정기 확인해야 한다.

참고: https://supabase.com/docs/pricing

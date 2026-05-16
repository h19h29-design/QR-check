# PLAN.md

## 전체 구현 계획

- [x] Phase 0-1. 저장소 골격 생성
- [x] Phase 0-2. 기존 `qr.zip`에서 Flask/SQLite/템플릿 추출
- [x] Phase 0-3. 기존 사용 매뉴얼 PDF와 설문조사 PDF 핵심 내용 추출
- [x] Phase 0-4. HWP/HWPX 관련 로컬 코드와 공개 참고자료 조사
- [x] Phase 1-1. Google Sheet 데이터 모델 확정
- [x] Phase 1-2. Apps Script API/화면 구조 확정
- [x] Phase 1-3. Windows 관리자 프로그램 동기화/SQLite 구조 확정
- [x] Phase 1-4. 보안/인증 전략 확정
- [x] Phase 2-1. Apps Script 파일 구조 생성
- [x] Phase 2-2. 초기 설정, Sheet schema, Drive 폴더 생성 함수 구현
- [x] Phase 2-3. 모바일 제출 화면, 첨부 base64 업로드, 중복 제출 방지 구현
- [x] Phase 2-4. 관리자 웹 조회, 상세, 일괄확인/개별확인, CSV 구현
- [x] Phase 2-5. Desktop sync API 구현
- [x] Phase 3-1. PySide6 관리자 프로그램 기본 구조 생성
- [x] Phase 3-2. SQLite migration, 기본 데이터 seed 구현
- [x] Phase 3-3. Apps Script 연결 테스트, pull sync, verify API client 구현
- [x] Phase 3-4. 대시보드, 기록, 설정, QR, 출력 페이지 구현
- [x] Phase 3-5. QR PNG 및 A4 HTML 출력 구현
- [x] Phase 4-1. Excel 출력 템플릿 구현
- [x] Phase 4-2. HTML 인쇄 출력 템플릿 구현
- [x] Phase 4-3. HWP/HWPX 가능성 검토 및 fallback 구현
- [x] Phase 5-1. pytest 테스트 작성
- [x] Phase 5-2. PowerShell 실행/빌드/패키징 스크립트 작성
- [x] Phase 5-3. README와 docs 문서 작성
- [x] Phase 5-4. 자체 리뷰 1차: 기능 누락 리뷰
- [x] Phase 5-5. 자체 리뷰 2차: 보안/배포/초보자 사용성 리뷰
- [x] Phase 5-6. 샘플 데이터 작성
- [x] Phase 5-7. Downloads 폴더에 배포 압축본 생성

## 남은 수동 작업

- [ ] 학교 관리자 Google 계정으로 Google Sheet 템플릿 복사 또는 새 Sheet 생성
- [ ] Apps Script 편집기에 `apps-script/` 파일 붙여넣기
- [ ] Google 권한 승인
- [ ] Web App 배포 URL 복사
- [ ] 관리자 프로그램 최초 설정 마법사에서 Web App URL, sync key 등록

## Supabase 저장소 모드 추가 계획

- [x] 현재 저장소 구조, Google Apps Script 흐름, Windows PySide6/SQLite 구조 분석
- [x] 기존 pytest baseline 확인
- [x] Supabase 최소 침습 설계 문서 작성
- [x] 로컬 설정에 `storage_mode`와 Supabase 연결값 추가
- [x] Google client를 유지하고 Supabase REST/RPC client를 병렬 추가
- [x] Supabase SQL schema/RLS/RPC 설치 파일 추가
- [x] Supabase 정적 제출 페이지 추가
- [x] QR 생성 URL을 저장소 모드별로 분기
- [x] 관리자 확인/일괄확인/동기화/백업을 저장소 provider 경유로 변경
- [x] Supabase 관련 단위 테스트 추가
- [ ] 실제 Supabase 프로젝트 end-to-end 검증
- [ ] build/package/package_installer 최종 검증

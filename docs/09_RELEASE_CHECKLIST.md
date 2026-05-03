# 09. RELEASE_CHECKLIST

- [x] 기존 기능 분석
- [x] Google Sheet schema 구현
- [x] Apps Script 제출/관리자/동기화 API 구현
- [x] 모바일 제출 화면 구현
- [x] 관리자 웹 화면 구현
- [x] Windows 관리자 프로그램 MVP 구현
- [x] SQLite migration 구현
- [x] QR 생성 구현
- [x] Excel 출력 구현
- [x] HTML 인쇄 출력 구현
- [x] HWP fallback 구현
- [x] pytest 작성
- [x] PowerShell 실행/빌드/패키징 스크립트 작성
- [x] 다운로드 폴더 실배포 ZIP 자동 생성 스크립트 작성
- [x] `admin-desktop\scripts\build.ps1` pytest 통과 확인
- [x] `admin-desktop\scripts\package.ps1` pytest 후 PyInstaller dist 생성 확인
- [x] 실배포 묶음 필수 구조 검증: Windows 관리자 프로그램, Apps Script 코드, 문서, UI 미리보기, 샘플 데이터
- [x] Downloads 실배포 폴더의 Windows 관리자 프로그램 시작 smoke 확인
- [x] 보안/인증 문서 작성
- [x] 초보자 설정 문서 작성
- [x] 기간별/실별 조회 및 출력 보완
- [x] QR/출력물 저장 위치 설정 보완
- [x] 로컬 설정 Google 업로드 버튼 보완
- [x] setup 재실행 보호 보완
- [x] Google 관리자 웹 기간/실/상태 필터 보완
- [x] Google 관리자 웹 CSV 조건 반영 보완
- [x] 데스크톱 관리자 확인 Google 원본 반영 보완
- [x] Desktop Sync Key 로컬 설정 파일 DPAPI 보호 보완
- [x] Google Apps Script `next_since` 기준 증분 동기화 보완
- [x] 첨부파일 생성 실패 시 제출 기록만 남는 문제 완화
- [x] Apps Script `.gs` 문법 검사 통과
- [x] 민감키 패턴 스캔 통과
- [x] 최종 실배포 ZIP 생성 및 필수 파일 포함 확인
- [ ] 실배포 ZIP 압축 해제 후 다른 Windows PC에서 실행 확인
- [ ] 실제 학교 Google 계정으로 Apps Script 배포 테스트
- [ ] 실제 한글 설치 PC에서 HWP 변환 테스트

## 2026-05-03 Production Release Audit

- [x] 학교 담당자용 실행 흐름과 개발자용 PowerShell 흐름을 README에서 분리
- [x] 배포 ZIP의 `5_Sample_Data` 구조를 문서 설명과 일치하도록 패키징 스크립트 보정
- [x] `package.ps1`에서 배포 필수 원본 파일 누락을 초기에 검증
- [x] `run_dev.ps1`, `build.ps1`, `package.ps1`에서 Python 미설치/경로 오류를 초보자가 읽을 수 있는 메시지로 변경
- [x] PowerShell 실행 정책 차단 시 처리 방법을 README와 FAQ에 추가
- [x] 실배포 ZIP 생성 전체 경로를 릴리스 PC에서 1회 더 측정
- [x] `docs/02_Google_Apps_Script_배포가이드.md`의 초기 설정/웹앱 배포 순서 문서 정합성 확인

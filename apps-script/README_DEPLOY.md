# Apps Script 배포 가이드

이 폴더의 파일은 학교별 Google Sheet에 붙어 있는 Apps Script 프로젝트에 넣는 코드입니다.

## 빠른 순서

1. Google Drive에서 새 Google Sheet를 만든다.
2. Sheet 이름을 `QR보안점검표_학교명`처럼 바꾼다.
3. 메뉴에서 `확장 프로그램 > Apps Script`를 연다.
4. 이 폴더의 `.gs`, `.html`, `appsscript.json` 내용을 같은 이름의 파일로 만든다.
5. `Code.gs`에서 `initializeSchoolStorage_`를 실행하거나 웹앱 `?page=setup` 화면에서 초기 설정을 한다.
6. Google 권한 승인 화면이 나오면 학교 관리자 계정으로 승인한다.
7. `배포 > 새 배포 > 웹 앱`을 선택한다.
8. 실행 사용자: `나`
9. 액세스 권한: 점검자 무로그인 제출이 필요하면 `모든 사용자`
10. 배포 URL을 복사하여 Windows 관리자 프로그램에 입력한다.

## 보안 주의

- 점검자는 Google Drive 권한이 없어도 제출할 수 있다. Apps Script가 학교 관리자 계정 권한으로 저장하기 때문이다.
- QR URL에는 `roomId`와 `submitToken`이 들어간다. QR이 유출되면 해당 실 토큰을 재발급한다.
- 관리자 웹은 Google 이메일 확인을 시도하지만 Apps Script 배포 환경에 따라 이메일이 빈 값일 수 있다. 이 경우 초기 설정에서 발급한 관리자 토큰을 입력한다.
- Desktop Sync Key는 관리자 프로그램에만 입력하고 공개 문서에 적지 않는다.


# Apps Script 배포 가이드

이 폴더의 파일은 학교별 Google Sheet에 붙어 있는 Apps Script 프로젝트에 넣는 코드입니다.

## 빠른 순서

1. Google Drive에서 새 Google Sheet를 만든다.
2. Sheet 이름을 `QR보안점검표_학교명`처럼 바꾼다.
3. 메뉴에서 `확장 프로그램 > Apps Script`를 연다.
4. 이 폴더의 `.gs`, `.html`, `appsscript.json` 내용을 같은 이름의 파일로 만든다.
5. `배포 > 새 배포 > 웹 앱`을 선택한다.
6. 실행 사용자: `나`
7. 액세스 권한: 점검자 무로그인 제출이 필요하면 `모든 사용자`
8. Google 권한 승인 화면이 나오면 학교 관리자 계정으로 승인한다.
9. 배포 URL을 복사하고, URL 뒤에 `?page=setup`을 붙여 초기 설정을 연다.
10. 학교명과 관리자 Google 이메일을 입력하고 `Google 저장소 만들기`를 누른다.
11. 화면에 표시된 관리자 토큰과 Desktop Sync Key를 안전한 곳에 보관한다.
12. 배포 URL과 Desktop Sync Key를 Windows 관리자 프로그램에 입력하고 `연결 테스트`를 실행한다.

`initializeSchoolStorage_`를 Apps Script 편집기에서 직접 실행하는 방식은 초보자에게 권장하지 않는다. payload 없이 실행하면 학교명/관리자 이메일 입력 흐름을 놓치기 쉽다.

## 배포 권한 설명

- 실행 사용자 `나`: Apps Script가 학교 관리자 계정 권한으로 Sheet에 기록하고 Drive에 첨부파일을 저장한다.
- 액세스 권한 `모든 사용자`: 점검자가 Google 로그인 없이 QR 화면을 열 수 있게 한다.
- Sheet/Drive 공유 권한: 공개로 바꾸지 않는다. 필요한 관리자에게만 최소 공유한다.
- Drive 첨부파일 폴더 생성과 파일 저장을 위해 manifest가 Google Drive 권한을 요청한다. 최초 승인 화면에 Drive 권한이 표시되는 것은 정상이다.

Google Workspace 정책상 `모든 사용자` 웹앱 배포가 금지되어 있으면 점검자 무로그인 요구사항과 충돌한다. 이 경우 기관 관리자에게 Apps Script 공개 웹앱 허용 여부를 확인한다.

권한 승인 화면에서는 계정과 프로젝트 이름을 확인한다. 모르는 사람이 보낸 스크립트나 다른 학교 프로젝트라면 승인하지 않는다.

## 보안 주의

- 점검자는 Google Drive 권한이 없어도 제출할 수 있다. Apps Script가 학교 관리자 계정 권한으로 저장하기 때문이다.
- QR URL에는 `roomId`와 `submitToken`이 들어간다. QR이 유출되면 해당 실 토큰을 재발급한다.
- 관리자 웹은 Google 이메일 확인을 시도하지만 Apps Script 배포 환경에 따라 이메일이 빈 값일 수 있다. 이 경우 초기 설정에서 발급한 관리자 토큰을 입력한다.
- Desktop Sync Key는 관리자 프로그램에만 입력하고 공개 문서에 적지 않는다.
- 관리자 토큰과 Desktop Sync Key는 코드에 하드코딩하지 않는다. 저장소 안에 실수로 만든 `local_settings.json`, `*sync_key*`, `*admin_token*` 파일은 `.gitignore` 대상이지만, 커밋 전 `git status`로 다시 확인한다.
- 관리자 토큰 fallback 상태에서도 CSV 다운로드는 토큰을 URL query string에 넣지 않는다. 관리자 화면 내부에서 `google.script.run`으로 CSV를 생성하고 브라우저 파일 다운로드로 저장한다.
- Desktop Sync Key가 저장된 Windows PC를 분실하거나 담당자가 바뀌면 key를 재발급한다.

## 배포 후 필수 확인

1. QR 1개를 스마트폰으로 열어 점검표가 뜨는지 확인한다.
2. 테스트 제출 1건을 보낸다.
3. `?page=admin`에서 테스트 제출이 보이는지 확인한다.
4. Windows 관리자 프로그램에서 동기화가 되는지 확인한다.
5. Google Sheet와 Drive 폴더가 공개 편집으로 공유되어 있지 않은지 확인한다.

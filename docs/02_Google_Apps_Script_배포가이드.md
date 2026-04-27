# 02. Google Apps Script 배포가이드

## 준비물

- 학교 관리자 Google 계정
- Chrome 또는 Edge 브라우저
- 이 저장소의 `apps-script/` 폴더

## 1. Google Sheet 만들기

1. Google Drive에 접속한다.
2. `새로 만들기 > Google 스프레드시트`를 누른다.
3. 파일명을 `QR보안점검표_학교명`으로 바꾼다.

## 2. Apps Script 열기

1. Sheet 메뉴에서 `확장 프로그램 > Apps Script`를 누른다.
2. Apps Script 편집기가 열린다.
3. 기본 `Code.gs` 내용을 지우고 이 저장소의 `apps-script/Code.gs` 내용을 붙여넣는다.
4. 나머지 `.gs`, `.html`, `appsscript.json`도 같은 이름으로 만든다.

## 3. 초기 설정 실행

브라우저 주소 뒤에 `?page=setup`을 붙여 초기 설정 화면을 열거나, Apps Script 편집기에서 `setupInitializeForUi` 또는 `initializeSchoolStorage_`를 실행한다.

입력:

- 학교명
- 관리자 Google 이메일

결과로 다음 값이 나온다.

- Drive root folder ID
- uploads folder ID
- exports folder ID
- 관리자 token
- Desktop Sync Key

관리자 token과 Desktop Sync Key는 즉시 안전한 곳에 보관한다.

## 4. 권한 승인

처음 실행하면 Google 권한 승인 화면이 나온다. 이 권한은 학교 관리자 계정의 Sheet/Drive에 데이터를 쓰기 위해 필요하다.

## 5. Web App 배포

1. `배포 > 새 배포`를 누른다.
2. 유형은 `웹 앱`을 선택한다.
3. 설명에 버전을 적는다.
4. 실행 사용자는 `나`로 둔다.
5. 접근 권한은 점검자 무로그인을 위해 `모든 사용자`로 둔다.
6. 배포 후 URL을 복사한다.

## 6. 관리자 프로그램 연결

Windows 관리자 프로그램의 `설정` 메뉴에 다음을 입력한다.

- 학교명
- 관리자 이메일
- Apps Script Web App URL
- Desktop Sync Key

`연결 테스트`를 누른다.

## 7. 관리자 웹 확인

배포 URL 뒤에 `?page=admin`을 붙이면 Google 관리자 웹을 열 수 있다.

- 시작일/종료일로 기간 조회가 가능하다.
- 실별, 상태별 필터가 가능하다.
- `CSV 다운로드`는 현재 조회 조건을 그대로 반영한다.
- `이상 없음 일괄확인`은 현재 조회 조건 중 이상 없음/미확인 기록만 확인 처리한다.
- 이상 있음 기록은 상세보기에서 첨부파일과 내용을 확인한 뒤 개별확인한다.

관리자 Google 이메일 확인이 되지 않는 배포 환경에서는 초기 설정 때 발급된 관리자 token을 입력한다.

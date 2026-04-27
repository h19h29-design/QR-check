# QR보안점검표 실배포 패키지 먼저읽기

이 폴더는 학교에 실제 배포할 때 필요한 파일만 모은 패키지입니다.

## 폴더 구성

1. `1_Windows관리자프로그램`
   - 학교 PC에서 실행할 관리자 프로그램입니다.
   - `QR보안점검표 관리자.exe`만 따로 빼지 말고, 폴더 전체를 복사해서 사용하세요.
   - `_internal` 폴더에는 실행에 필요한 라이브러리가 들어 있습니다.

2. `2_Google에_붙여넣을_AppsScript코드`
   - Google Sheet의 Apps Script 편집기에 같은 파일명으로 붙여넣는 코드입니다.
   - 이것은 개발용 전체 소스가 아니라, Google 웹앱 배포에 필요한 필수 코드입니다.

3. `3_설치_사용_문서`
   - 초보자용 Google 설정, 관리자 프로그램 사용, QR 부착, 보안 주의사항 문서입니다.

4. `mobile_submit_preview.html`
   - QR을 찍으면 나오는 모바일 점검표 화면을 Google 배포 전에도 미리 볼 수 있는 샘플입니다.
   - 실제 제출은 Apps Script 배포 URL의 `?page=submit&roomId=...&submitToken=...` 주소에서 동작합니다.

## 설치 순서

1. Google Drive에서 학교용 Google Sheet를 만듭니다.
2. Google Sheet에서 `확장 프로그램 > Apps Script`를 엽니다.
3. `2_Google에_붙여넣을_AppsScript코드` 안의 파일들을 Apps Script에 같은 이름으로 만듭니다.
4. Apps Script를 Web App으로 배포합니다.
5. 배포 URL 뒤에 `?page=setup`을 붙여 초기 설정과 Google 권한 승인을 합니다.
6. 발급된 Desktop Sync Key를 안전한 곳에 보관합니다.
7. 학교 PC에서 `1_Windows관리자프로그램\QR보안점검표 관리자\QR보안점검표 관리자.exe`를 실행합니다.
8. 설정 메뉴에 Apps Script URL과 Desktop Sync Key를 입력하고 연결 테스트를 합니다.
9. 실, 담당자/당직자, 점검항목을 등록합니다.
10. `로컬 설정을 Google로 업로드`를 누릅니다.
11. `QR 생성`에서 QR PNG와 A4 부착용 HTML을 생성합니다.
12. 스마트폰으로 QR을 스캔해 테스트 제출합니다.

## 중요한 답변

Google 등록만으로 바로 실사용되는 것은 아닙니다.

Apps Script 배포, 권한 승인, Desktop Sync Key 등록, 로컬 설정 Google 업로드, QR 생성까지 끝나야 실사용 가능합니다.

## 소스 압축본의 용도

전체 소스 압축본은 개발자나 유지보수자가 기능을 수정하고 다시 빌드할 때 쓰는 자료입니다.

일반 학교 배포에는 전체 소스가 필요하지 않습니다. 실제 배포에는 이 실배포 패키지만 전달하면 됩니다.

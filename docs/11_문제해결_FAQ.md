# 11. 문제해결 FAQ

## 점검자가 QR 화면에 접속할 수 없습니다

- Apps Script 웹앱 배포 권한이 `모든 사용자`인지 확인한다.
- QR URL의 `roomId`, `submitToken`이 맞는지 확인한다.
- 실이 비활성화되어 있지 않은지 확인한다.

## Google 권한 승인 화면이 나옵니다

정상입니다. 학교 관리자 계정이 최초 1회 승인해야 Sheet/Drive 저장이 가능합니다.

## 관리자 이메일 확인이 되지 않습니다

Apps Script 배포 방식에 따라 이메일 확인이 빈 값일 수 있다. 초기 설정에서 발급받은 관리자 token을 관리자 웹 화면에 입력한다.

## 첨부파일 업로드가 실패합니다

- 파일이 이미지 또는 PDF인지 확인한다.
- 5MB 이하인지 확인한다.
- Drive 용량이 부족하지 않은지 확인한다.

## Windows 관리자 프로그램 연결 테스트가 실패합니다

- Apps Script URL이 `/exec`로 끝나는 배포 URL인지 확인한다.
- Desktop Sync Key를 다시 입력한다.
- Apps Script의 `settings_school.sync_key_hash`가 설정되어 있는지 확인한다.

## HWP 출력이 안 됩니다

한글 프로그램과 pywin32 COM 환경이 필요하다. 실패해도 HTML 인쇄 파일이 생성되므로 브라우저에서 열어 PDF로 저장하거나 인쇄한다.


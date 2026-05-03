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
- 다른 Windows 계정이나 새 PC로 옮긴 뒤 실패한다면 `local_settings.json`의 DPAPI 보호값을 복호화하지 못한 것일 수 있다. 설정 화면에서 Desktop Sync Key를 다시 입력하고 저장한다.

## PowerShell에서 스크립트 실행이 막힙니다

개발자나 유지보수자가 `run_dev.ps1`, `build.ps1`, `package.ps1`을 실행할 때 "스크립트를 실행할 수 없습니다"라는 메시지가 나오면 같은 PowerShell 창에서 먼저 실행한다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

이 설정은 현재 PowerShell 창에만 적용된다. 학교 담당자가 배포 ZIP을 받은 경우에는 PowerShell 스크립트 대신 압축 해제된 폴더의 `QR보안점검표 관리자.exe`를 실행한다.

## Python을 찾지 못한다는 오류가 납니다

PowerShell 개발 실행과 패키징에는 Python 3.11 이상이 필요하다. `python --version` 또는 `py -3 --version`이 동작하는지 확인하고, 설치 후 새 PowerShell 창에서 다시 실행한다.

학교 담당자가 배포 ZIP을 받은 경우에는 Python을 설치할 필요가 없다.

## 배포 ZIP 안에서 exe를 실행했더니 실패합니다

ZIP 파일 안에서 바로 실행하지 말고 먼저 압축을 해제한다. `QR보안점검표 관리자.exe`와 `_internal` 폴더가 같은 `QR보안점검표 관리자` 폴더 안에 있어야 한다.

## `?page=setup`이 열리지 않습니다

- Apps Script를 Web App으로 먼저 배포했는지 확인한다.
- 브라우저 주소가 `/exec?page=setup` 형태인지 확인한다. `/dev?page=setup`이나 편집기 주소가 아니다.
- 접근 권한이 `모든 사용자`인지 확인한다.

## 샘플 데이터 폴더가 비어 보입니다

최신 배포 묶음에서는 `5_Sample_Data` 바로 아래에 `sample_submissions.json`, `sample_settings.xlsx`, `sample_settings.xlsx.txt`가 있어야 한다. 실제 학교 개인정보 파일을 이 폴더에 넣어 다시 배포하지 않는다.

## HWP 출력이 안 됩니다

한글 프로그램과 pywin32 COM 환경이 필요하다. 실패해도 HTML 인쇄 파일이 생성되므로 브라우저에서 열어 PDF로 저장하거나 인쇄한다.

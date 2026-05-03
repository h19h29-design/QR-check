# QR보안점검표 관리자

Windows 학교 PC에서 실행하는 관리자 프로그램입니다.

## 학교 PC 실행

학교에 전달된 `QR_security_check_deploy_yyyyMMdd-HHmmss.zip`을 받은 경우:

1. ZIP 파일을 원하는 폴더에 압축 해제한다.
2. `README_먼저읽기.md`를 먼저 연다.
3. `1_Windows_Admin_Program\QR보안점검표 관리자` 폴더 전체를 학교 PC에 둔다.
4. `QR보안점검표 관리자.exe`를 실행한다.

`QR보안점검표 관리자.exe`만 따로 복사하면 실행에 필요한 `_internal` 폴더를 찾지 못할 수 있습니다. 반드시 프로그램 폴더 전체를 함께 보관하세요.

## 개발 실행

아래 명령은 소스에서 직접 실행할 때 사용합니다. 학교 담당자가 배포 ZIP을 받은 경우에는 위의 `.exe` 실행 흐름을 사용하세요.

```powershell
Set-Location D:\gpt\QR\qr-security-check\admin-desktop
.\scripts\run_dev.ps1
```

PowerShell에서 스크립트 실행이 막히면 같은 창에서 먼저 실행합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## 테스트

```powershell
Set-Location D:\gpt\QR\qr-security-check\admin-desktop
.\scripts\build.ps1
```

## 패키징

```powershell
Set-Location D:\gpt\QR\qr-security-check\admin-desktop
.\scripts\package.ps1
```

이 명령은 다음을 순서대로 수행합니다.

1. Python 의존성 설치
2. pytest 실행
3. PyInstaller dist 생성
4. `C:\Users\user\Downloads`에 학교 배포용 폴더와 zip 생성

생성 위치 예시:

- `D:\gpt\QR\qr-security-check\admin-desktop\dist\QR보안점검표 관리자`
- `C:\Users\user\Downloads\QR_security_check_deploy_yyyyMMdd-HHmmss`
- `C:\Users\user\Downloads\QR_security_check_deploy_yyyyMMdd-HHmmss.zip`

배포 묶음의 샘플 파일은 `5_Sample_Data` 바로 아래에 복사됩니다.

이미 설치된 가상환경을 그대로 쓰려면 `.\scripts\package.ps1 -SkipInstall`, zip 없이 폴더만 만들려면 `.\scripts\package.ps1 -NoZip`을 사용합니다.

## 최초 설정 순서

1. `설정` 메뉴를 연다.
2. 화면 위쪽의 `Google 설정 방법(처음 1회)` 안내를 순서대로 진행한다.
3. 학교명, 관리자 이메일, Apps Script Web App URL을 입력한다.
4. Apps Script 초기 설정에서 발급받은 Desktop Sync Key를 입력한다.
5. QR 저장 폴더와 출력물 저장 폴더를 필요하면 바꾼다.
6. `연결 테스트`를 누른다. 이 테스트는 URL과 Desktop Sync Key를 함께 확인한다.
7. 실/담당자/점검항목을 등록한다.
8. `설정 > 로컬 설정을 Google로 업로드`를 눌러 Google Sheet에 반영한다.
9. `QR 생성` 메뉴에서 QR 부착용 출력물을 만든다.

## 표시순서란?

`표시순서`는 실, 사람, 점검항목이 목록에 보이는 순서입니다. 숫자가 낮을수록 위에 표시됩니다. 보통 `10, 20, 30`처럼 넉넉히 입력하면 나중에 중간 항목을 끼워 넣기 쉽습니다.

## 조회와 출력

- `점검기록`: 기간별, 실별, 이상여부/확인여부별 조회
- `출력/보관`: 기간별, 실별 XLSX/HTML/HWP fallback 출력
- 저장 위치: `설정` 메뉴의 QR 저장 폴더, 출력물 저장 폴더에서 변경
- Apps Script URL과 Desktop Sync Key가 설정되어 있으면 개별확인/일괄확인이 Google Sheet 원본에도 함께 반영됨

## Google 등록 후 실사용 조건

Google Sheet와 Apps Script를 배포한 뒤에도 `연결 테스트`, `로컬 설정을 Google로 업로드`, `QR 생성`까지 끝나야 점검자가 QR로 제출할 수 있습니다.

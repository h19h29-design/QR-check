# QR보안점검표 관리자

Windows 학교 PC에서 실행하는 관리자 프로그램입니다.

## 실행

```powershell
Set-Location D:\gpt\QR\qr-security-check\admin-desktop
.\scripts\run_dev.ps1
```

## 테스트

```powershell
Set-Location D:\gpt\QR\qr-security-check\admin-desktop
.\scripts\build.ps1
```

## 빌드

```powershell
Set-Location D:\gpt\QR\qr-security-check\admin-desktop
.\scripts\package.ps1
```

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

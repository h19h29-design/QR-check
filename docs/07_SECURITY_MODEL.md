# 07. SECURITY_MODEL

## 기본 원칙

- 점검자는 로그인 없이 제출한다.
- 제출 권한은 `room_id + submit_token`으로 제한한다.
- `room_id`는 공개 식별자이고 `submit_token`은 권한 증명값이다.
- submit token과 sync key는 Sheet에 평문 저장하지 않는다.
- Google Drive/Sheet 권한은 최소 공유를 원칙으로 한다.
- 무료 배포형이므로 고위험 개인정보나 법적 신원확인 시스템으로 사용하지 않는다.
- 실제 관리자 토큰, Desktop Sync Key, Google Client Secret, Google 비밀번호를 코드나 문서에 하드코딩하지 않는다.

## 점검자 무로그인

무로그인 제출은 “QR 링크를 가진 사용자의 제출”로 해석한다. 사용자가 선택한 이름은 업무 편의를 위한 표시값이며 강한 신원 인증값이 아니다.

따라서 다음을 전제로 운영한다.

- QR을 촬영하거나 전달받은 사람은 해당 실 점검표에 접근할 수 있다.
- 점검자 이름 선택은 서명이나 본인확인이 아니다.
- QR 부착 위치는 외부인이 쉽게 촬영하지 못하는 곳으로 정한다.
- QR 유출, 담당자 변경, 실 이동이 있으면 해당 실 token을 재발급하고 QR을 다시 출력한다.

## QR 보호

- 제출 API는 항상 `room_id`와 `submit_token`을 함께 검증한다.
- token은 충분히 긴 난수로 생성한다.
- token 유출 시 실별로 폐기/재발급한다.
- 검증 실패는 `audit_log`에 기록한다.

## 관리자 접근

목표는 `settings_admins` 이메일 allowlist 기반 Google 계정 확인이다. 다만 Apps Script의 `Session.getActiveUser().getEmail()`은 배포 방식에 따라 빈 값일 수 있으므로 관리자 token fallback을 병행한다.

관리자 웹 화면 자체는 Apps Script 웹앱 접근 권한 때문에 외부에서도 열릴 수 있다. 데이터 조회, 상세보기, 확인 처리는 `verifyAdmin_`을 통과해야 하며 이메일 확인 실패 시 관리자 token을 요구한다. 이메일이 비어 있을 때 자동 허용하면 안 된다.

관리자 token은 화면 입력이나 POST body로 전달하는 것을 원칙으로 한다. 관리자 웹의 CSV 다운로드도 URL query string에 token을 붙이지 않고 `google.script.run` 호출로 CSV 문자열을 받아 브라우저에서 파일로 저장한다.

## Desktop Sync Key

- 관리자 token과 별도로 발급한다.
- Sheet에는 hash만 저장한다.
- Windows 로컬 설정에는 사용자가 입력한 key를 저장한다.
- 장치 분실 또는 담당자 변경 시 폐기한다.

현재 Windows 관리자 프로그램은 Desktop Sync Key를 사용자 로컬 설정 파일에 저장한다. 일반적으로 `%LOCALAPPDATA%\qr-security-admin\local_settings.json`에 저장되며, 저장소 안의 `local_settings.json`, `*sync_key*`, `*admin_token*` 파일은 `.gitignore`로 제외한다.

운영 주의:

- Desktop Sync Key를 메신저, 이메일 본문, 공개 문서, 화면 캡처에 남기지 않는다.
- OneDrive/Google Drive 같은 동기화 폴더에 로컬 설정 파일을 직접 옮기지 않는다.
- 관리자 PC 계정 잠금, 디스크 암호화, 백신, OS 업데이트를 유지한다.
- PC 폐기, 분실, 담당자 변경, 외부 수리 전에는 key를 재발급한다.
- 장기 개선은 Windows Credential Manager 또는 OS keyring 저장이다.

Desktop Sync Key가 유출되면 제출 기록 동기화, 관리자 확인 처리, 로컬 설정 업로드가 가능해질 수 있으므로 관리자 token과 같은 수준으로 보호한다.

## Google 배포 권한

점검자 무로그인을 위해 Apps Script 웹앱 액세스 권한은 `모든 사용자`가 필요하다. 이 설정은 웹앱 URL 접근 권한이며, Google Sheet/Drive 공유 권한을 공개로 바꾸라는 뜻이 아니다.

권장 배포 설정:

- 실행 사용자: `나`
- 액세스 권한: `모든 사용자`
- Sheet/Drive 공유: 관리자 계정과 필요한 최소 운영자만
- 배포 URL: QR 생성과 관리자 프로그램 설정에만 사용

학교 Workspace 정책상 `모든 사용자` 배포가 금지되어 있으면 무로그인 제출 요구사항과 충돌한다. 이 경우 도메인 로그인 방식으로 요구사항을 바꾸거나, 기관 관리자에게 Apps Script 웹앱 공개 정책을 확인해야 한다.

## 파일 업로드

- 이미지/PDF만 허용한다.
- 파일 1개 최대 5MB
- 파일명은 안전하게 재작성한다.
- Drive `uploads/yyyy/mm` 구조에 저장한다.
- 실행파일, 압축파일, 스크립트는 허용하지 않는다.

## 개인정보 최소화

필요한 정보만 저장한다.

- 실명
- 점검자 이름
- 점검 결과
- 제출일시
- 특이사항
- 필요한 첨부파일

주민등록번호, 의료정보, 결제정보, 민감한 신분 정보는 수집하지 않는다.

모바일 전송 실패 시 제출 payload가 브라우저 `localStorage`에 임시 저장될 수 있다. 이 payload에는 점검자 이름, 특이사항, 첨부파일 base64가 포함될 수 있으므로 공용 스마트폰 사용은 피하고, 전송 완료 후에는 미전송 자료가 남지 않았는지 확인한다.

## 무료배포 책임 범위

운영 학교는 Google 계정, Drive/Sheet 공유 권한, token 보관, 백업, 개인정보 고지를 책임진다. 이 프로젝트는 무료 도구이며 SLA, 전문 악성파일 검사, 법적 컴플라이언스 보증을 제공하지 않는다.

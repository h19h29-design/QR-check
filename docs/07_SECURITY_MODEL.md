# 07. SECURITY_MODEL

## 기본 원칙

- 점검자는 로그인 없이 제출한다.
- 제출 권한은 `room_id + submit_token`으로 제한한다.
- `room_id`는 공개 식별자이고 `submit_token`은 권한 증명값이다.
- submit token과 sync key는 Sheet에 평문 저장하지 않는다.
- Google Drive/Sheet 권한은 최소 공유를 원칙으로 한다.
- 무료 배포형이므로 고위험 개인정보나 법적 신원확인 시스템으로 사용하지 않는다.

## 점검자 무로그인

무로그인 제출은 “QR 링크를 가진 사용자의 제출”로 해석한다. 사용자가 선택한 이름은 업무 편의를 위한 표시값이며 강한 신원 인증값이 아니다.

## QR 보호

- 제출 API는 항상 `room_id`와 `submit_token`을 함께 검증한다.
- token은 충분히 긴 난수로 생성한다.
- token 유출 시 실별로 폐기/재발급한다.
- 검증 실패는 `audit_log`에 기록한다.

## 관리자 접근

목표는 `settings_admins` 이메일 allowlist 기반 Google 계정 확인이다. 다만 Apps Script의 `Session.getActiveUser().getEmail()`은 배포 방식에 따라 빈 값일 수 있으므로 관리자 token fallback을 병행한다.

## Desktop Sync Key

- 관리자 token과 별도로 발급한다.
- Sheet에는 hash만 저장한다.
- Windows 로컬 설정에는 사용자가 입력한 key를 저장한다.
- 장치 분실 또는 담당자 변경 시 폐기한다.

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

## 무료배포 책임 범위

운영 학교는 Google 계정, Drive/Sheet 공유 권한, token 보관, 백업, 개인정보 고지를 책임진다. 이 프로젝트는 무료 도구이며 SLA, 전문 악성파일 검사, 법적 컴플라이언스 보증을 제공하지 않는다.


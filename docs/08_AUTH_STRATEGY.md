# 08. AUTH_STRATEGY

## 사용자 유형별 인증

| 사용자 | 방식 | 보호할 값 |
|---|---|---|
| 점검자 | 무로그인, `room_id + submit_token` | QR URL과 submit token |
| 관리자 웹 | Google 이메일 확인 목표, 관리자 token fallback | 관리자 token |
| Windows 관리자 프로그램 | Desktop Sync Key | Desktop Sync Key, 로컬 설정 파일 |
| Apps Script 실행 | 학교 관리자 Google 계정 권한 | Google 계정과 배포 권한 |

## 이상적인 구조

Google OAuth 클라이언트를 별도로 구성하고 관리자 계정을 명확히 인증한다. 그러나 무료 배포와 초보자 설치 난도를 고려해 MVP에서는 Apps Script 기본 기능과 관리자 token fallback을 사용한다.

## MVP 구조

- 점검자는 QR token으로만 제출
- 관리자 웹은 `settings_admins` 이메일 확인을 시도
- 이메일 확인 실패 시 관리자 token 입력
- Windows 프로그램은 sync key로 동기화

관리자 token과 Desktop Sync Key는 서로 다른 용도다. 하나가 유출되어도 다른 권한까지 바로 확장되지 않도록 분리해서 보관하고, 문서/코드/샘플 데이터에 넣지 않는다.

## Apps Script 이메일 확인 한계

`Session.getActiveUser().getEmail()`은 다음 이유로 단독 인증 수단이 될 수 없다.

- 웹앱 배포 방식에 따라 빈 문자열 반환 가능
- 외부 사용자/익명 사용자에서는 불안정
- 실행 계정과 접속자 계정이 다를 수 있음

따라서 이메일은 보조 검증이고, 실패 시 자동 허용하지 않는다.

## token fallback

관리자 token은 URL보다 화면 입력 또는 POST body 전달을 우선한다. Apps Script `doPost`에서는 일반 HTTP header 접근이 제한되므로 Desktop Sync Key도 body payload에 포함하는 방식을 지원한다.

운영 규칙:

- 관리자 token은 초기 설정 화면에 표시될 때 즉시 비밀번호 관리자나 학교 내부 비밀 보관 문서에 저장한다.
- Desktop Sync Key는 Windows 관리자 프로그램에만 입력한다.
- token이나 sync key를 잃어버렸거나 노출된 경우 기존 값을 폐기하고 재발급한다.
- 토큰을 브라우저 주소창, QR 안내문, 단체 메신저, 이메일 본문에 붙여넣지 않는다.
- 관리자 token fallback 상태에서도 CSV 다운로드는 URL query string에 token을 붙이지 않는다. 관리자 화면에서 `google.script.run`으로 CSV를 생성한 뒤 브라우저 Blob 다운로드로 저장한다.

## 초보자 설치 흐름에서의 인증 순서

1. 학교 관리자 Google 계정으로 Sheet와 Apps Script 프로젝트를 만든다.
2. Apps Script 웹앱을 실행 사용자 `나`, 액세스 권한 `모든 사용자`로 배포한다.
3. Google 권한 승인 화면에서 프로젝트와 계정을 확인한 뒤 승인한다.
4. Apps Script 편집기에서 `createInitialSetupKey`를 실행해 초기 설정 키를 만든다.
5. 배포 URL의 `?page=setup` 화면에서 초기 설정 키, 학교명, 관리자 이메일을 등록한다.
6. 화면에 표시된 관리자 token과 Desktop Sync Key를 안전한 곳에 보관한다.
7. Windows 관리자 프로그램에 배포 URL과 Desktop Sync Key를 입력하고 연결 테스트를 실행한다.
7. 관리자 웹 `?page=admin`은 이메일 확인이 되면 바로 열리고, 이메일 확인이 비어 있으면 관리자 token을 입력한다.

이 순서에서 Google Sheet/Drive를 공개 공유로 바꿀 필요는 없다. 점검자 무로그인은 Apps Script 웹앱 공개 배포와 QR token으로 처리한다.

## 현재 한계와 배포 전 확인

- Desktop Sync Key는 Sheet에는 hash로 저장된다. Windows 로컬 설정에는 DPAPI 보호값으로 저장하며, 앱 실행 중에만 복호화해 Apps Script 동기화 요청에 사용한다.
- DPAPI 보호값은 같은 Windows 사용자 계정 기준으로 복호화된다. PC 교체, 사용자 계정 변경, 프로필 재생성 시에는 Desktop Sync Key를 다시 입력해야 한다.
- 관리자 token 회전과 Desktop Sync Key 회전은 운영 절차로 관리해야 하며, 전용 UI는 추후 개선 대상이다.
- 점검자 제출은 강한 본인확인이 아니므로 법적 서명이나 신원확인 용도로 쓰지 않는다.
- `localStorage`에 미전송 제출 payload가 잠시 남을 수 있으므로 공용 스마트폰 사용을 피한다.

## 추후 개선

- 정식 Google OAuth 웹앱
- 기관 도메인 제한
- 관리자 역할 세분화
- token 만료/회전 UI
- OS Credential Manager 연동

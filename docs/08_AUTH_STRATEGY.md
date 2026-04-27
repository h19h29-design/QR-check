# 08. AUTH_STRATEGY

## 사용자 유형별 인증

| 사용자 | 방식 |
|---|---|
| 점검자 | 무로그인, `room_id + submit_token` |
| 관리자 웹 | Google 이메일 확인 목표, 관리자 token fallback |
| Windows 관리자 프로그램 | Desktop Sync Key |
| Apps Script 실행 | 학교 관리자 Google 계정 권한 |

## 이상적인 구조

Google OAuth 클라이언트를 별도로 구성하고 관리자 계정을 명확히 인증한다. 그러나 무료 배포와 초보자 설치 난도를 고려해 MVP에서는 Apps Script 기본 기능과 관리자 token fallback을 사용한다.

## MVP 구조

- 점검자는 QR token으로만 제출
- 관리자 웹은 `settings_admins` 이메일 확인을 시도
- 이메일 확인 실패 시 관리자 token 입력
- Windows 프로그램은 sync key로 동기화

## Apps Script 이메일 확인 한계

`Session.getActiveUser().getEmail()`은 다음 이유로 단독 인증 수단이 될 수 없다.

- 웹앱 배포 방식에 따라 빈 문자열 반환 가능
- 외부 사용자/익명 사용자에서는 불안정
- 실행 계정과 접속자 계정이 다를 수 있음

따라서 이메일은 보조 검증이고, 실패 시 자동 허용하지 않는다.

## token fallback

관리자 token은 URL보다 화면 입력 또는 POST body 전달을 우선한다. Apps Script `doPost`에서는 일반 HTTP header 접근이 제한되므로 Desktop Sync Key도 body payload에 포함하는 방식을 지원한다.

## 추후 개선

- 정식 Google OAuth 웹앱
- 기관 도메인 제한
- 관리자 역할 세분화
- token 만료/회전 UI
- OS Credential Manager 연동


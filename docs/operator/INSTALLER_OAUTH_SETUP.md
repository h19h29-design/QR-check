# INSTALLER_OAUTH_SETUP — 제작자 1회 준비 작업 (학교에 떠넘기지 않음)

상태(2026-09-10): 프로젝트·API·브랜딩·웹 클라이언트·요청 scope·테스트 사용자 등록과 운영 홈페이지 배포 완료. 실제 Google 로그인은 테스트 앱 안내까지 도달했다. 안내 확인·계정 동의·신규 학교 설치 성공은 아직 검증하지 않았다.
확인한 항목만 체크한다. 완료되지 않은 항목은 출시 조건으로 남긴다.

## 1. Google Cloud 프로젝트 (제작자용, 설치센터 전용)

- [x] 설치센터 전용 `QR-check Installer` (`qr-check-installer`) 생성. 학교 런타임은 이 프로젝트에 연결하지 않는다.
- [x] Drive API, Sheets API, Apps Script API 활성화 완료. scope 충족 여부는 라이브 설치 테스트로 별도 검증한다.

## 2. OAuth 동의화면

- [x] OAuth 브랜딩 생성 (사용자 유형·앱 이름·지원 이메일).
- [x] 요청 scope 등록: openid, userinfo.email, userinfo.profile, drive.file, script.projects, script.deployments. 코드 요청 범위 확장 없음.
- [x] 홈페이지 `https://qr-safe.h19h19.com`, 개인정보처리방침 `https://qr-safe.h19h19.com/privacy/`, 승인 도메인 `h19h19.com`을 콘솔에 저장. 개인정보 페이지 배포 후 HTTPS HTTP200을 확인했다.
- [x] 소유자 테스트 계정 1개 추가. 실제 학교 계정/일반 사용자 검증 완료를 뜻하지 않는다.
- 외부 앱은 TESTING 상태를 유지한다. 계정 접근 동의와 학교 Apps Script 승인은 별도이며, scope 목록 저장만으로 접근이 부여되는 것은 아니다.

## 3. OAuth 클라이언트 (웹)

- [x] 웹 OAuth 클라이언트 생성. 승인된 자바스크립트 원본은 `https://qr-safe.h19h19.com`만 등록, 리디렉션 URI 없음.
- [x] 실제 client ID를 `installer/src/auth/config.js`에 공개 설정값으로 기록하고 운영 홈페이지에 배포했다.
- 브라우저 token model은 client secret을 사용하지 않는다. secret이 발급되더라도 프론트엔드·저장소·배포물·로그에 절대 포함하지 않는다.

## 4. 검증 상태 구분

| 상태 | 의미 |
|---|---|
| 미검증(테스트 사용자) | 테스트 학교 계정에서만 설치 가능. 일반 학교 배포 불가 |
| 검증 완료 | 일반 학교 계정 설치 가능. 학교 Apps Script 자체 승인 화면은 별개로 남음 |

## 5. 금지

- 학교 스크립트를 제작자 공통 Cloud 프로젝트에 연결하기
- 서비스 계정으로 학교 대리 운영하기
- 학교 담당자에게 위 작업을 대신 시키기

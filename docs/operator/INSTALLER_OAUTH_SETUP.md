# INSTALLER_OAUTH_SETUP — 제작자 1회 준비 작업 (학교에 떠넘기지 않음)

상태(2026-09-10): 프로젝트·API·웹 클라이언트·요청 scope·운영 홈페이지 배포와 신규 테스트 학교 설치 E2E를 완료했다. 외부 앱은 프로덕션 단계이며 브랜딩 자동 인증·게시도 완료했다. 데이터 액세스 인증은 범위 근거와 실제 OAuth 데모 YouTube 링크가 필요해 아직 제출하지 않았다.
확인한 항목만 체크한다. 완료되지 않은 항목은 출시 조건으로 남긴다.

## 1. Google Cloud 프로젝트 (제작자용, 설치센터 전용)

- [x] 설치센터 전용 `QR-check Installer` (`qr-check-installer`) 생성. 학교 런타임은 이 프로젝트에 연결하지 않는다.
- [x] Drive API, Sheets API, Apps Script API 활성화 완료. scope 충족 여부는 라이브 설치 테스트로 별도 검증한다.

## 2. OAuth 동의화면

- [x] OAuth 브랜딩 생성 (사용자 유형·앱 이름·지원 이메일).
- [x] 요청 scope 등록: openid, userinfo.email, userinfo.profile, drive.file, script.projects, script.deployments. 코드 요청 범위 확장 없음.
- [x] 홈페이지 `https://qr-safe.h19h19.com`, 개인정보처리방침 `https://qr-safe.h19h19.com/privacy/`, 승인 도메인 `h19h19.com`을 콘솔에 저장. 개인정보 페이지 배포 후 HTTPS HTTP200을 확인했다.
- [x] 소유자 테스트 계정 1개 추가. 실제 학교 계정/일반 사용자 검증 완료를 뜻하지 않는다.
- [x] 외부 앱을 프로덕션 단계로 전환했다.
- [x] 브랜딩 자동 인증 후 게시했다. Google 인증 센터에서 “브랜딩이 인증되었으며 사용자에게 표시되고 있습니다”를 확인했다.
- [ ] 데이터 액세스 인증 제출. 미승인 민감 범위 때문에 현재 미검증 사용자 한도 100명이 적용되고 경고 화면이 표시될 수 있다.
- 계정 접근 동의와 학교 Apps Script 승인은 별도이며, scope 목록 저장만으로 접근이 부여되는 것은 아니다.

## 3. OAuth 클라이언트 (웹)

- [x] 웹 OAuth 클라이언트 생성. 승인된 자바스크립트 원본은 `https://qr-safe.h19h19.com`만 등록, 리디렉션 URI 없음.
- [x] 실제 client ID를 `installer/src/auth/config.js`에 공개 설정값으로 기록하고 운영 홈페이지에 배포했다.
- 브라우저 token model은 client secret을 사용하지 않는다. secret이 발급되더라도 프론트엔드·저장소·배포물·로그에 절대 포함하지 않는다.

## 4. 검증 상태 구분

| 상태 | 의미 |
|---|---|
| 테스트 | 테스트 사용자만 설치 가능 |
| 프로덕션·데이터 액세스 미검증 | Google 계정 사용 가능, 경고 화면 및 프로젝트 전체 사용자 한도 100명 적용 가능. Workspace 관리자가 차단할 수 있음 |
| 데이터 액세스 검증 완료 | 승인된 민감 범위에는 미검증 경고·사용자 한도가 적용되지 않음. Workspace 관리자 정책은 별개 |

## 5. 데이터 액세스 인증 제출 준비

Google 인증 센터가 요구하는 미완료 항목은 범위 근거와 YouTube 데모 링크다. 데모에는 이 프로젝트의 웹 OAuth 클라이언트, 동의 화면의 앱 이름·클라이언트 ID, 실제 권한 동의, 학교 소유 Apps Script 프로젝트 생성·파일 업로드·버전·웹앱 배포 결과가 포함되어야 한다. 영상은 실제 흐름을 사용하고 자격 증명·토큰·초기 설정 키·QR 비밀값은 가린다.

제출용 범위 근거 초안:

> QR CHECK is a static installer that lets a school administrator create and maintain a school-owned Apps Script web app. The script.projects scope is used only after explicit user consent to create an Apps Script project in the signed-in school's account, upload the published QR CHECK runtime, and read back project content to verify the installation or update. The script.deployments scope creates a versioned web-app deployment and updates the same deployment during an administrator-requested upgrade or rollback so existing room QR URLs remain stable. The narrower Drive scope cannot create or deploy Apps Script projects, so both Apps Script scopes are required. No school records, attachments, setup keys, or OAuth tokens are sent to or stored on our server; they remain in each school's Google Sheets, Drive, and Apps Script resources.

촬영 체크리스트:

1. `https://qr-safe.h19h19.com/maker/`와 주소 표시줄을 보인다.
2. Google 연결을 눌러 동의 화면의 앱 이름과 이 프로젝트의 OAuth client ID를 보인다.
3. 요청 권한과 미검증 경고를 숨기지 않고 보인 뒤 테스트 계정으로 동의한다.
4. 합성 학교 정보로 Apps Script 프로젝트 생성, 18파일 업로드 검증, 버전과 웹앱 배포를 보인다.
5. 생성된 Apps Script 프로젝트가 로그인한 학교 계정 소유임을 보인다.
6. 영상은 YouTube `일부 공개(Unlisted)`로 올리고 인증 양식의 `YouTube 링크`에 입력한다.

## 6. 금지

- 학교 스크립트를 제작자 공통 Cloud 프로젝트에 연결하기
- 서비스 계정으로 학교 대리 운영하기
- 학교 담당자에게 위 작업을 대신 시키기

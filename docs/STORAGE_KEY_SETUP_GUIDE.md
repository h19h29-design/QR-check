# 저장 방식별 키값 설정 가이드

## Google Drive 방식

### 작동 원리

Google Apps Script가 모바일 제출 화면과 관리자 동기화 API 역할을 한다. 제출 데이터는 학교 Google Sheet에 저장되고, 첨부파일은 학교 Google Drive에 저장된다. 점검자는 Google 로그인을 하지 않고 QR의 `roomId + submitToken`으로 제출한다.

### 필요한 값

- Apps Script Web App URL
- Desktop Sync Key

### Apps Script Web App URL 구하는 순서

1. 학교 관리자 Google 계정으로 Google Sheet를 만든다.
2. Google Sheet에서 `확장 프로그램 > Apps Script`를 연다.
3. 배포본의 `2_Google_AppsScript_Code` 폴더 안 `.gs`, `.html`, `appsscript.json` 파일을 Apps Script에 같은 이름으로 만든다.
4. Apps Script 오른쪽 위 `배포 > 새 배포`를 누른다.
5. 유형 선택에서 `웹 앱`을 선택한다.
6. 실행 사용자는 `나`로 선택한다. 이렇게 해야 점검자가 Google Drive/Sheet 권한 없이도 제출할 수 있다.
7. 액세스 권한은 점검자 QR 제출을 위해 `모든 사용자`로 선택한다.
8. `배포`를 누르고 Google 권한 승인 화면을 학교 관리자 계정으로 승인한다.
9. 배포가 완료되면 표시되는 Web app URL을 복사한다. 보통 `/exec`로 끝난다.
10. 이 URL을 관리자 프로그램 설정의 `Apps Script Web App URL`에 붙여 넣는다.

공식 문서: https://developers.google.com/apps-script/guides/web

### Desktop Sync Key 구하는 순서

1. Apps Script 편집기에서 함수 목록을 열고 `createInitialSetupKey`를 선택한다.
2. 실행 버튼을 누른다.
3. 로그 또는 실행 결과에 표시된 초기 설정 키를 복사한다.
4. 브라우저에서 Web App URL 뒤에 `?page=setup`을 붙여 연다.
5. 초기 설정 키, 학교명, 관리자 이메일을 입력한다.
6. 화면에 표시되는 Desktop Sync Key를 복사한다.
7. 관리자 프로그램 설정의 `Desktop Sync Key`에 붙여 넣는다.
8. `연결 테스트`를 누른다.

주의: Google Sheet/Drive 자체를 “링크가 있는 모든 사용자 편집 가능”으로 공유하지 않는다. 공개 대상은 Sheet/Drive가 아니라 Apps Script Web App URL이다.

## Supabase 방식

### 작동 원리

각 학교가 직접 만든 Supabase 프로젝트가 원본 DB가 된다. QR 제출 페이지는 정적 HTML로 배포할 수 있고, 제출 시 Supabase RPC를 호출한다. DB 내부에서 `room_id + submit_token` hash를 검증하므로 QR에는 Supabase key가 들어가지 않는다.

### 필요한 값

- Supabase 주소(Project URL)
- Supabase anon public key
- 학교 코드(organization_code)
- Supabase 제출 페이지 주소
- Desktop Sync Key

### Supabase 가입과 프로젝트 생성

1. https://supabase.com 에 가입한다.
2. Dashboard에서 `New project`를 누른다.
3. Organization과 Project name을 정한다.
4. Database password를 안전한 곳에 보관한다. 관리자 프로그램에는 입력하지 않는다.
5. Region은 학교 운영 지역과 가까운 곳을 선택한다.
6. 프로젝트 생성이 끝날 때까지 기다린다.

### SQL 설치

1. Supabase Dashboard에서 `SQL Editor`를 연다.
2. 배포본의 `6_Supabase_Setup/setup_supabase.sql` 내용을 붙여 넣고 실행한다.
3. 조직과 샘플 데이터를 만들려면 `seed_sample.sql`을 연다.
4. `organization_code`, `school_name`, `change-me-desktop-key`를 학교 값으로 바꾼다.
5. 수정한 SQL을 실행한다.

### Supabase URL과 anon key 구하는 순서

1. Supabase 프로젝트 Dashboard를 연다.
2. `Project Settings > API Keys` 또는 프로젝트 `Connect` 화면을 연다.
3. Project URL을 복사한다. 예: `https://xxxx.supabase.co`
4. API Keys에서 `anon` public key를 복사한다. 새 키 화면에서는 공개 클라이언트용 publishable key가 보일 수 있다.
5. 이 프로그램의 1차 Supabase 모드는 legacy `anon` JWT key를 우선 사용한다.
6. `service_role`, `secret`, `sb_secret_...` 키는 절대 복사하지 않는다.

공식 문서: https://supabase.com/docs/guides/getting-started/api-keys

### 제출 페이지 주소 구하는 순서

1. 배포본의 `7_Supabase_Submit_Page` 폴더를 정적 호스팅에 올린다.
2. `config.js`에서 `supabaseUrl`, `anonKey`, `organizationCode`를 학교 값으로 바꾼다.
3. Cloudflare Pages, GitHub Pages, Vercel 같은 정적 호스팅의 배포 URL을 복사한다.
4. 관리자 프로그램 설정의 `Supabase 제출 페이지 주소`에 붙여 넣는다.

주의: Supabase 무료 플랜은 용량, egress, 비활성 프로젝트 pause 정책이 있다. 장기 운영 학교는 Supabase Dashboard에서 프로젝트 상태를 정기 확인한다.

# Supabase 설정 가이드

학교 담당자용 1차 설치 절차다.

저장 방식별 키값을 더 자세히 확인하려면 `docs/STORAGE_KEY_SETUP_GUIDE.md`도 함께 본다.

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 에 가입한다.
2. 새 Project를 만든다.
3. Project URL과 anon public key를 확인한다.
4. `Project Settings > API Keys` 또는 `Connect` 화면에서 Project URL과 anon public key를 복사한다.
5. service_role, secret, `sb_secret_...` 키는 복사하지 않는다.

## 2. SQL 실행

1. Supabase Dashboard에서 SQL Editor를 연다.
2. 배포본의 `6_Supabase_Setup/setup_supabase.sql` 내용을 붙여넣고 Run을 누른다.
3. 테스트 데이터가 필요하면 `seed_sample.sql`을 실행한다.
4. 실제 학교에서는 `seed_sample.sql`의 학교 코드, 학교명, Desktop Sync Key를 바꾸고 실행한다.

샘플 값:

- 학교 코드: `school-2026`
- Desktop Sync Key: `change-me-desktop-key`
- 샘플 QR submit token: `sample-submit-token`

## 3. 제출 페이지 준비

1. 배포본의 `7_Supabase_Submit_Page` 폴더를 정적 호스팅에 올린다.
2. `config.js`를 열어 Supabase URL, anon public key, organizationCode를 학교 값으로 수정한다.
3. Cloudflare Pages, GitHub Pages, Vercel 같은 정적 호스팅을 사용할 수 있다.

QR URL에는 anon key가 들어가지 않는다. anon key는 제출 페이지의 `config.js`에만 둔다.

## 4. 관리자 프로그램 설정

1. Windows 관리자 프로그램을 실행한다.
2. 설정 메뉴에서 저장 방식을 `Supabase 방식`으로 선택한다.
3. 다음 값을 입력한다.
   - Supabase 주소
   - Supabase anon public key
   - 학교 코드
   - Supabase 제출 페이지 주소
   - Desktop Sync Key
4. `연결 테스트`를 누른다.
5. 실/담당자/당직자/점검항목을 등록한다.
6. `로컬 설정 업로드`를 누른다.
7. `QR 생성`에서 QR을 새로 만든다.

## 5. 스마트폰 제출 테스트

1. QR을 스마트폰으로 스캔한다.
2. 실 이름이 맞는지 확인한다.
3. 담당자/당직자를 선택한다.
4. 이상 무/이상 유를 선택하고 제출한다.
5. 관리자 프로그램에서 `동기화`를 눌러 기록이 내려오는지 확인한다.

## 문제 해결

- `schema_version 테이블을 찾을 수 없습니다`: `setup_supabase.sql`을 먼저 실행한다.
- `Desktop Sync Key가 올바르지 않습니다`: `seed_sample.sql` 또는 조직 설정 SQL의 key와 관리자 프로그램 입력값을 맞춘다.
- `유효하지 않은 QR 코드입니다`: QR을 다시 생성했거나 token이 다르다. QR을 새로 출력한다.
- 제출 페이지가 열리지만 제출이 실패한다: `config.js`의 Supabase URL, anon key, organizationCode를 확인한다.

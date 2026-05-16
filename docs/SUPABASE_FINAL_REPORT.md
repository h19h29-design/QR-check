# Supabase 저장소 모드 최종 보고서

## 변경 요약

- 기존 Google Drive/Sheet 방식은 기본값으로 유지했다.
- Windows 관리자 프로그램 설정에 `Google Drive 방식` / `Supabase 방식` 선택을 추가했다.
- Supabase URL, anon public key, 학교 코드, 제출 페이지 주소를 저장/로드한다.
- Supabase anon key는 기존 DPAPI 보호 구조로 로컬 보호 저장한다.
- Supabase REST/RPC client를 추가하고 Google client와 같은 동기화 계약을 쓰게 했다.
- Supabase 모드 전용 동기화 커서 `last_sync_at_supabase`를 추가했다.
- Supabase SQL schema, RLS, RPC, sample seed, reset 예시를 추가했다.
- Supabase 정적 제출 페이지를 추가했다.
- QR 생성은 저장소 모드에 따라 Google Apps Script URL 또는 Supabase 제출 페이지 URL을 만든다.
- Supabase 백업 생성 기능을 추가했다.
- 배포 ZIP/설치 EXE 패키지에 Supabase SQL과 제출 페이지가 포함되도록 수정했다.

## 주요 추가/수정 파일

- `admin-desktop/src/app/config.py`
- `admin-desktop/src/app/supabase_client.py`
- `admin-desktop/src/app/supabase_backup.py`
- `admin-desktop/src/app/sync_client.py`
- `admin-desktop/src/ui/setup_wizard.py`
- `admin-desktop/src/ui/qr_page.py`
- `admin-desktop/src/ui/export_page.py`
- `supabase/setup_supabase.sql`
- `supabase/rls_policies.sql`
- `supabase/seed_sample.sql`
- `supabase/reset_dev.example.sql`
- `supabase-submit/index.html`
- `supabase-submit/config.js`
- `docs/SUPABASE_MODE_DESIGN.md`
- `docs/SUPABASE_SETUP_GUIDE.md`
- `docs/SUPABASE_SECURITY_GUIDE.md`
- `docs/SUPABASE_BACKUP_GUIDE.md`
- `docs/DUAL_STORAGE_MODE.md`
- `docs/OPEN_SOURCE_REVIEW.md`

## 실행한 검증

- `python -m compileall src`: 통과
- `python -m pytest`: 26 passed
- `.\scripts\build.ps1`: 통과
- `.\scripts\package.ps1 -SkipInstall`: 통과
- `.\scripts\package_installer.ps1 -SkipInstall`: 통과

## 생성된 배포물

- `C:\Users\user\Downloads\QR_security_check_deploy_20260516-162743`
- `C:\Users\user\Downloads\QR_security_check_deploy_20260516-162743.zip`
- `C:\Users\user\Downloads\QR_security_check_deploy_v0.2.0_20260516-162855`
- `C:\Users\user\Downloads\QR_security_check_deploy_v0.2.0_20260516-162855.zip`
- `C:\Users\user\Downloads\QR_security_check_setup_v0.2.0_20260516-162916.exe`
- `C:\Users\user\Downloads\QR_security_check_setup_v0.2.0_20260516-162916_README.txt`

설치 EXE SHA256:

```text
1bee04377e567e694b11ffc9f03165b6c9813870bd8b2d699453763b9937588d
```

## 보안상 주의점

- service_role key는 절대 앱/QR/제출 페이지에 넣지 않는다.
- QR URL에는 roomId, token, org만 들어간다.
- Supabase anon key는 제출 페이지 `config.js`에 들어가므로, RLS/RPC 정책이 보안 경계다.
- Desktop Sync Key는 Supabase DB에 hash로 저장하고, 로컬 설정에는 DPAPI 보호값으로 저장한다.
- 1차 백업은 첨부파일 metadata까지 자동 백업한다. 파일 본문 다운로드는 후속 작업이다.

## 학교 담당자 설치 순서

1. Supabase 프로젝트 생성
2. `setup_supabase.sql` 실행
3. 필요 시 `seed_sample.sql` 값을 학교 코드/학교명/Desktop Sync Key로 바꿔 실행
4. `supabase-submit/` 정적 페이지 호스팅
5. `config.js`에 Supabase URL, anon key, 학교 코드 입력
6. 관리자 프로그램 설정에서 Supabase 방식 선택
7. Supabase 주소, anon key, 학교 코드, 제출 페이지 주소, Desktop Sync Key 입력
8. 연결 테스트
9. 로컬 설정 업로드
10. QR 생성 및 스마트폰 제출 테스트
11. 관리자 프로그램 동기화와 백업 생성 테스트

## 남은 작업

- 실제 Supabase 프로젝트 credentials가 없어서 end-to-end 실서버 제출 검증은 수행하지 못했다.
- Supabase Storage 파일 본문 자동 백업은 후속 구현이 필요하다.
- QR token 재발급 UI는 설계 여지만 남겼고 구현하지 않았다.
- Hybrid 모드는 문서 설계만 남겼다.

## 다음 Codex 스레드 TODO

1. 테스트 Supabase 프로젝트에서 `setup_supabase.sql` 실행 오류를 검증한다.
2. `seed_sample.sql`로 샘플 조직을 만든 뒤 관리자 프로그램 연결 테스트를 한다.
3. 정적 제출 페이지를 로컬/정적 호스팅에서 열어 샘플 QR 제출을 수행한다.
4. Storage 업로드 정책이 실제 파일 업로드까지 통과하는지 확인한다.
5. 파일 본문 백업 기능을 추가한다.

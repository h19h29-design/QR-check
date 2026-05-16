# PROJECT_CONTEXT

## 현재 기준

- 저장소: `D:\gpt\QR\qr-security-check`
- 작업 브랜치: `feature/supabase-storage-mode`
- 기존 안정 경로: Google Apps Script + Google Sheet + Google Drive + Windows PySide6 + SQLite cache
- 추가 경로: 학교별 독립 Supabase 프로젝트를 원본 저장소로 쓰는 선택 모드

## 기존 Google 흐름

1. QR URL이 Apps Script `page=submit`으로 이동한다.
2. Apps Script가 `room_id + submit_token`을 검증한다.
3. 제출 데이터는 Google Sheet, 첨부파일은 Google Drive에 저장된다.
4. Windows 관리자 프로그램은 Apps Script Desktop Sync API로 내려받아 SQLite에 캐시한다.

기존 Google 코드는 유지한다. 이번 변경은 호출 지점을 저장소 provider로 감싸는 방식이다.

## Supabase 흐름

1. 학교가 자기 Supabase 프로젝트를 만든다.
2. `supabase/setup_supabase.sql`을 SQL Editor에서 실행한다.
3. Windows 관리자 프로그램에 Supabase URL, anon public key, 학교 코드, Desktop Sync Key, 제출 페이지 주소를 입력한다.
4. 로컬 실/담당자/당직자/점검항목을 Supabase로 업로드한다.
5. QR 생성 시 Supabase 제출 페이지 URL이 만들어진다.
6. 정적 제출 페이지는 Supabase RPC `get_submit_bootstrap`, `submit_check_record`만 호출한다.
7. Windows 관리자 프로그램은 RPC `desktop_pull`, `desktop_verify_record`, `desktop_backup`을 호출한다.

## 보안 기준

- service_role key는 앱, QR, 제출 페이지, 문서 예시에 넣지 않는다.
- QR에는 `roomId`, `token`, `org`만 넣는다.
- submit token은 DB에 hash로 저장한다.
- Desktop Sync Key도 Supabase DB에는 hash로만 저장한다.
- 주요 테이블은 RLS를 켜고 직접 anon 접근을 막는다.
- 필요한 접근은 `security definer` RPC에서 token/key 검증 후 수행한다.

## 주요 통합 파일

- 설정: `admin-desktop/src/app/config.py`
- 저장소 provider factory: `admin-desktop/src/app/sync_client.py`
- Supabase REST/RPC client: `admin-desktop/src/app/supabase_client.py`
- Supabase backup writer: `admin-desktop/src/app/supabase_backup.py`
- QR URL 생성: `admin-desktop/src/app/qr_generator.py`, `admin-desktop/src/ui/qr_page.py`
- 설정 UI: `admin-desktop/src/ui/setup_wizard.py`
- 확인 처리: `admin-desktop/src/ui/records_page.py`, `admin-desktop/src/ui/detail_dialog.py`
- Supabase SQL: `supabase/`
- Supabase static submit page: `supabase-submit/`

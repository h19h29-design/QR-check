# Supabase 백업 가이드

## 관리자 프로그램 백업

1. 설정에서 Supabase 방식 연결 테스트를 통과시킨다.
2. `출력/보관` 메뉴를 연다.
3. `Supabase 백업 생성`을 누른다.
4. 저장 폴더를 선택한다.

생성 예:

```text
supabase_backup_YYYYMMDD_HHMMSS/
  metadata.json
  full_backup.json
  settings_rooms.csv
  settings_people.csv
  settings_check_items.csv
  submissions.csv
  check_record_items.csv
  attachments.csv
  admin_verifications.csv
  audit_logs.csv
  files/
    README.txt
```

1차 구현은 첨부파일 본문을 자동 다운로드하지 않는다. `attachments.csv`의 `storage_path`를 보관한다.

## 기존 출력 기능

Supabase에서 내려받은 점검기록은 로컬 SQLite에 캐시되므로 기존 XLSX, HTML, HWP fallback 출력 기능을 그대로 사용할 수 있다.

## Supabase Dashboard 백업

Supabase Dashboard의 Database/Storage export 기능도 함께 확인한다. 플랜에 따라 백업 보관 기간과 제공 기능이 다르다.

참고: https://supabase.com/docs/pricing

## 무료 플랜 주의

Supabase Free 플랜은 DB/Storage 용량 제한, egress 제한, 비활성 프로젝트 pause 정책이 있다. 학교가 24시간 제출을 안정적으로 운영해야 한다면 프로젝트가 pause되지 않는지 정기 확인하고, 필요하면 유료 플랜을 검토한다.

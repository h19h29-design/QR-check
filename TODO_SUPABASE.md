# TODO_SUPABASE

## 완료한 1차 범위

- [x] `storage_mode=google|supabase` 로컬 설정 추가
- [x] Supabase anon key DPAPI 보호 저장
- [x] Supabase REST/RPC client 추가
- [x] Google/Supabase provider factory 추가
- [x] Supabase 전용 동기화 커서 `last_sync_at_supabase` 추가
- [x] 설정 화면에 Supabase URL, anon key, 학교 코드, 제출 페이지 주소 추가
- [x] QR 생성 시 Google/Supabase URL 분기
- [x] 관리자 확인/일괄확인 원본 저장소 반영 분기
- [x] Supabase CSV/JSON 백업 생성
- [x] Supabase setup SQL, RLS SQL, sample seed, reset 예시 추가
- [x] Supabase 정적 제출 페이지 추가
- [x] Supabase 관련 pytest 추가

## 남은 개선 작업

- [ ] 실제 Supabase 프로젝트에서 `setup_supabase.sql` end-to-end 실행 검증
- [ ] Supabase Storage 파일 다운로드 자동 백업 구현
- [ ] 제출 페이지 디자인/문구를 학교 현장 피드백으로 다듬기
- [ ] Supabase Auth 기반 관리자 로그인 옵션 검토
- [ ] QR token 재발급 UI 추가
- [ ] SQL migration version 2 이상을 위한 증분 migration 전략 추가
- [ ] Hybrid 모드: Supabase 원본 + Google Drive 출력물 백업 연동 설계 구체화
- [ ] Supabase 무료 플랜 pause 대응 운영 체크리스트를 배포 README에 더 크게 노출

## 다음 스레드 인수인계

1. 먼저 `python -m pytest`와 `.\scripts\build.ps1`로 현재 회귀를 확인한다.
2. 실제 Supabase 테스트 프로젝트를 준비해 `supabase/setup_supabase.sql`, `supabase/seed_sample.sql`을 순서대로 실행한다.
3. 관리자 프로그램 설정에서 Supabase mode를 선택하고 `school-2026`, `change-me-desktop-key`로 연결 테스트한다.
4. 로컬 설정 업로드, QR 생성, `supabase-submit/` 정적 페이지 제출, 관리자 동기화, 백업 생성을 순서대로 검증한다.

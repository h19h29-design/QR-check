# 관리자 매뉴얼 보강

## 저장 방식 선택

설정 화면에서 저장 방식을 선택한다.

- Google Drive 방식: 기존 Apps Script URL과 Desktop Sync Key를 사용한다.
- Supabase 방식: Supabase 주소, anon public key, 학교 코드, 제출 페이지 주소, Desktop Sync Key를 사용한다.

기존 학교는 Google Drive 방식을 그대로 사용하면 된다.

## Supabase 방식 초기 순서

1. Supabase 프로젝트를 만든다.
2. `setup_supabase.sql`을 실행한다.
3. 정적 제출 페이지 `supabase-submit/`을 호스팅한다.
4. 제출 페이지의 `config.js`에 Supabase URL, anon key, 학교 코드를 입력한다.
5. 관리자 프로그램 설정에서 Supabase 방식을 선택한다.
6. 연결 테스트를 누른다.
7. 실/담당자/당직자/점검항목을 등록하고 로컬 설정 업로드를 누른다.
8. QR을 생성해 스마트폰으로 제출 테스트를 한다.

## Supabase 백업

`출력/보관` 메뉴에서 `Supabase 백업 생성`을 누르면 CSV와 JSON 백업이 만들어진다. 첨부파일 본문 자동 다운로드는 후속 기능이며, 현재는 `attachments.csv`에 storage path가 기록된다.

## 보안 문구

- service_role key는 입력하지 않는다.
- QR URL에 anon key를 넣지 않는다.
- Desktop Sync Key는 외부 문서나 메신저에 공유하지 않는다.
- QR이 외부에 노출되면 해당 실 token을 재발급하고 QR을 다시 출력한다.

# Supabase 보안 가이드

## 절대 금지

- service_role key를 QR URL에 넣지 않는다.
- service_role key를 제출 페이지 `config.js`에 넣지 않는다.
- service_role key를 Windows 관리자 프로그램 설정에 넣지 않는다.
- Supabase 테이블을 전체 공개 select/insert/update 정책으로 열지 않는다.

## anon public key의 의미

anon key는 브라우저에서 사용할 수 있는 공개 키다. 공개 키이므로 이 키 하나만으로 민감 데이터 조회가 가능하면 안 된다. 이 프로젝트는 주요 테이블 직접 접근을 막고 RPC 내부에서 QR token 또는 Desktop Sync Key를 검증한다.

## RLS

`setup_supabase.sql`은 주요 테이블에 RLS를 활성화한다. `schema_version`만 연결 확인을 위해 읽을 수 있고, 나머지 업무 데이터는 RPC로 접근한다.

참고: https://supabase.com/docs/guides/database/postgres/row-level-security

## QR submit token

- QR에는 `roomId`, `token`, `org`가 들어간다.
- DB에는 token 원문을 저장하지 않고 `sha256(room_id:token)` hash를 저장한다.
- token이 노출되면 해당 실 QR을 재발급해야 한다.

## Desktop Sync Key

- 관리자 프로그램이 Supabase 원본 데이터 조회/확인/백업을 할 때 사용한다.
- Supabase DB에는 `sha256(desktop:sync_key)` hash만 저장한다.
- 로컬 설정 파일에는 DPAPI 보호값으로 저장한다.

## 첨부파일

Storage bucket은 private로 만든다. 1차 구현은 제출 RPC가 만든 `storage_path`에만 anon upload를 허용한다. public URL은 사용하지 않는다.

참고: https://supabase.com/docs/guides/storage/security/access-control

## 개인정보 최소 수집

점검 제출에는 실명, 실명 기반 담당자/당직자 이름, 점검 상태, 특이사항, 첨부파일만 사용한다. 학교는 운영 규정에 따라 불필요한 개인정보를 특이사항이나 첨부파일에 넣지 않도록 안내해야 한다.

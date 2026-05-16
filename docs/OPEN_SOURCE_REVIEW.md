# Open Source Review

## Supabase official docs

- URL: https://supabase.com/docs/guides/database/postgres/row-level-security
- License: Supabase documentation site terms
- 참고한 부분: RLS 활성화, policy 설계, security definer 주의
- 코드 반영: 주요 테이블 RLS 활성화, RPC 기반 접근

## Supabase Storage access control

- URL: https://supabase.com/docs/guides/storage/security/access-control
- License: Supabase documentation site terms
- 참고한 부분: Storage가 `storage.objects` RLS 정책으로 제어된다는 점
- 코드 반영: private bucket, attachment metadata가 있는 경로만 insert 허용

## Supabase API security docs

- URL: https://supabase.com/docs/guides/api/securing-your-api
- License: Supabase documentation site terms
- 참고한 부분: 함수 execute 권한과 security definer 검토 필요성
- 코드 반영: service_role key 없이 anon RPC만 사용

## Supabase pricing docs

- URL: https://supabase.com/docs/pricing
- License: Supabase documentation site terms
- 참고한 부분: Free/Pro 플랜 용량, egress, pause, backup 주의사항
- 코드 반영: 문서 주의사항에 반영

## supabase-py

- URL: https://github.com/supabase/supabase-py
- License: MIT
- 참고한 부분: Python 클라이언트 존재와 기능 범위
- 실제 코드 반영 여부: 반영하지 않음
- 반영하지 않은 이유: 새 의존성을 늘리지 않고 기존 `requests` 기반 REST/RPC 호출로 충분함

## supabase-js

- URL: https://github.com/supabase/supabase-js
- License: MIT
- 참고한 부분: 브라우저 클라이언트 사용 가능성
- 실제 코드 반영 여부: 반영하지 않음
- 반영하지 않은 이유: 정적 제출 페이지에서 fetch로 RPC/Storage API를 직접 호출해 CDN 의존성을 줄임

## python-qrcode

- URL: https://github.com/lincolnloop/python-qrcode
- License: BSD
- 참고한 부분: 기존 QR 생성 라이브러리 유지
- 실제 코드 반영 여부: 기존 의존성 유지

## PySide6

- URL: https://doc.qt.io/qtforpython-6/
- License: LGPL/commercial dual licensing, installed package license 확인 필요
- 참고한 부분: 기존 관리자 UI 프레임워크 유지
- 실제 코드 반영 여부: 기존 의존성 유지

## DPAPI examples

- URL: Microsoft CryptProtectData/CryptUnprotectData API 문서
- License: Microsoft documentation terms
- 참고한 부분: 기존 로컬 비밀값 보호 구조 확인
- 실제 코드 반영 여부: 기존 `security.py` DPAPI helper를 Supabase anon key 보호에도 재사용

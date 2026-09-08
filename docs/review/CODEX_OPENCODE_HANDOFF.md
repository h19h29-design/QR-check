# Codex ↔ OpenCode 인수인계 — 2026-09-08

## 현재 상태

- 저장소: `D:\opencode\QR-check`
- 브랜치: `work/school-owned-web`
- 코드 기준: `5f4df10`
- 작업트리는 이 문서 갱신 전 clean
- GitHub push/merge 없음
- 테스트 Apps Script 활성 version: 11
- 기존 deployment ID 유지(끝자리 `-deMQgC9`)
- health build: `qrcheck-20260908-admin-ui`
- 현재 Codex 세션 실제 모델: 실행 환경에서 확인 방법이 없어 `미확인`

## 핵심 결론

- `n-*.script.googleusercontent.com`은 HTML Service의 정상 iframe 호스트다. 이를 구버전 판별자로 쓰면 안 된다.
- 주소 장애의 실제 원인은 `AdminView.html`에서 JSON 문자열을 `<?=`로 다시 이스케이프해 URL 값에 따옴표가 포함된 것이었다. `<?!=`로 수정했다.
- 관리자 조회 장애의 실제 원인은 Sheets `Date` 객체가 `google.script.run` 응답에 남아 성공 핸들러가 `null`을 받은 것이었다. `clientSafeValue_`로 UI 경계에서 KST 문자열화했다.
- public exec는 canonical `https://script.google.com/macros/s/<id>/exec`만 허용하고 iframe·`/dev`·임의 호스트 fallback을 금지한다.
- health는 안전한 `app_version`/`build_id`만 반환한다. 이메일·Sheet ID·raw open 진단은 제거했다.
- `TEST-SETUP`/`testBootstrap` 초기설정 우회도 제거했다.

## 관련 커밋

- `428bd90` `fix(live): force-print admin exec URL`
- `64ef59a` `fix(live): surface submit bootstrap failures`
- `5f4df10` `fix(live): restore admin records and harden exec URL`

## 검증 완료

- Apps Script/클라이언트 43/43
- Windows 관리자 16/16
- 런타임 빌드 public 12/admin 18
- 비밀 패턴 0
- 원격 HEAD와 고정 v11 각각 로컬 18파일 SHA-256 일치
- 기존 `/exec` health build 표식 확인
- 행정실 정상 점검 1건: 제출 완료 → 실제 Sheet → 관리자 상세 동일 `record_id`/비고
- 행정실 이상 있음 점검 1건: Chrome UI에서 합성 PNG 제출 → `COMMITTED` → 관리자 상세 동일 `record_id`/비고와 PNG 첨부 1건
- Drive 첨부 권한 owner-only, 쿠키·인증 없는 직접 요청은 303이고 이미지 본문 미반환
- 기존 deployment 주소, 행정실 QR 토큰, 기존 기록 유지

## OpenCode/Muse

- OpenCode CLI: 1.18.29
- 고정 모델: `opencode/muse-spark-1.3-contributor-free`
- doctor와 합성 smoke PASS, smoke 응답 `MUSE_SMOKE_OK`
- wrapper `liveProviderAttested=false`: provider 내부 모델의 독립 attestation으로 주장하지 않는다.
- Muse는 URL 조사, 격리 AdminView 수정, bootstrap 조사, 격리 오류 경계 수정, Date 직렬화 리뷰를 수행했다.
- Google 인증·배포·브라우저·학교 테스트 데이터는 Muse에 전달하지 않았다.

## Google 테스트 변경

- `settings_people`: 합성 담당자/당직자 2행 추가
- `submissions`: 정상 합성 점검 1행, 이상 있음 합성 점검 1행 추가
- Drive: 이상 있음 기록에 합성 PNG 1개 추가, owner-only 유지
- QR 재발급·장소 변경·공유 권한 변경 없음

## 남은 항목

1. `NOT_TESTED`: 실제 QR/휴대폰, live 멱등/충돌, live 이름 유지/재발급, 미등록 관리자, 설치센터 차단, Workspace.
2. 실제 rollback은 하지 않았으나 고정 v10/v11과 원격 백업은 보존돼 있다.

## 다음 재개 순서

1. 실제 출력 QR 또는 휴대폰 1종으로 점검 화면을 연다.
2. 동일 record ID 재전송/충돌을 승인된 테스트 창에서 검증한다.
3. 테스트 전용 장소에서 이름 유지/재발급 live 시험을 진행한다.
4. 별도 미등록 계정, 설치센터 차단, 교육기관 Workspace를 확보되는 순서로 검증한다.

원본 QR 토큰, OAuth 토큰, 관리자 토큰을 문서나 Muse task에 넣지 않는다.

# Codex ↔ OpenCode 인수인계 — 2026-09-08

## 현재 상태

- 저장소: `D:\opencode\QR-check`
- 브랜치: `work/school-owned-web`
- 코드 기준: `5f4df10`
- 작업트리는 이 문서 커밋 전 문서 수정만 존재
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
- `submissions`: 정상 합성 점검 1행 추가
- QR 재발급·장소 변경·공유 권한 변경 없음
- 합성 테스트 PNG는 로컬에만 있고 Google 업로드는 실패 전 중단

## 남은 항목

1. `BLOCKED`: Chrome 파일 chooser가 열리지 않아 이상 있음 + 합성 사진 live 제출을 못했다.
2. `NOT_TESTED`: Drive 파일 비공개, 실제 QR/휴대폰, live 멱등/충돌, live 이름 유지/재발급, 미등록 관리자, 설치센터 차단, Workspace.
3. 실제 rollback은 하지 않았으나 고정 v10/v11과 원격 백업은 보존돼 있다.

## 다음 재개 순서

1. 사용자가 Chrome 확장 세부정보에서 **파일 URL에 대한 액세스 허용**을 켰는지 확인한다.
2. 행정실 제출 링크를 Chrome에서 열어 합성 PNG로 `이상 있음` 1건을 제출한다.
3. `attachments` Sheet와 관리자 상세의 같은 record ID를 대조한다.
4. 로그아웃/별도 브라우저에서 Drive URL 접근 거부를 확인한다.
5. 그 뒤에만 테스트 전용 장소의 이름 유지/재발급 live 시험을 진행한다.

원본 QR 토큰, OAuth 토큰, 관리자 토큰을 문서나 Muse task에 넣지 않는다.

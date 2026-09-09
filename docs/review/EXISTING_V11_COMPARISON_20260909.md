# 기존 v11 배포와 현재 로컬 변경 검토

## 근거와 범위

- 2026-09-09 Google Apps Script 배포 관리에서 기존 QR보안점검표 테스트의 v11 활성 상태를 확인했다(앞선 대화 턴). 새 프로젝트는 필요하다고 결론 내리지 않는다.
- 이번 비교 기준은 LIVE_VALIDATION_REPORT.md에 기록된 v11 기준 커밋 5f4df10이다. 원격 고정 버전의 전체 소스를 이번에 내려받아 해시 대조한 것은 아니다.
- 현재 HEAD 6e3a2b0 및 미커밋 변경을 보존했다. 커밋/푸시/원격 업로드/배포/초기화/토큰 재발급/학교 데이터 변경 없음.
- 학교 런타임 기존 배포와 신규 학교용 설치센터 OAuth 설정은 별개다. 설치센터 client ID 공란으로 기존 웹앱이 미배포라고 판단하면 안 된다.

## 변경 범위

v11 기준 로컬 비교에서 8개 파일이 다르다: Api.gs, Auth.gs, SchemaMigrations.gs, SchoolConfig.gs, Styles.html, Submit.gs, SubmitView.html, WebApp.html.

초기 설정 인증·바인딩·보류 마커 보호, Google 관리자 신원 검사, 제출 digest 강화, 반응형 UI가 포함된다. Code.gs, appsscript.json, QrTokens.gs, DriveFiles.gs, DesktopSync.gs는 해당 기준과 diff가 없다. 이는 외부 자원 ID/설정이 동일하다는 원격 증명은 아니다.

## 확인된 업데이트 위험

1. 과거 digest와 현재 digest의 입력 구조가 다르다. 이전 버전에서 저장한 동일 요청을 최신 코드에 재전송하면 충돌로 거부된다.
2. 합성 로컬 재현: legacyDigestDiffers=true, samePayloadRejectedAsConflict=true, rows=1, legacyDigestPreserved=true. 기존 기록 덮어쓰기나 같은 ID 중복 생성은 발생하지 않았다.
3. 현재 오류 문구는 새로고침 후 재제출을 안내한다. 이미 저장된 구버전 요청에 새 ID를 만들어 재제출하도록 유도하지 않도록 호환 처리와 안내 검토가 필요하다.
4. 구버전 digest는 첨부 내용 자체를 검증하지 못하므로 구 digest 일치만으로 성공 처리하는 fallback은 도입하면 안 된다. 원본 기록·첨부 검증 또는 안전한 확인 필요 상태 등 정책을 먼저 정하고 합성 회귀 테스트가 필요하다. 기존 데이터 일괄 재해시/초기화 금지.
5. token_compat의 익명 토큰 단독 접근은 현재 코드에서 거부된다. 이는 신원 보호 요구와 일치하지만 기존 이용 방식의 호환 변경이다. 기존 소유자 관리자 세션의 실제 조회 가능 여부를 업데이트 전에 확인해야 한다. 신원 검사 완화 금지.

## Muse 검토 및 독립 확인

- 실행: OpenCode CLI, opencode/muse-spark-1.3-contributor-free / xhigh.
- 세션: ses_f7bf42d31ffexveIZ4qq2k32p5. 로컬 assistant metadata의 model/variant 및 finish=stop 확인. provider 내부 실행을 별도로 증명한 것은 아니다.
- 입력: 공개 코드 diff만. 실제 계정, 배포 ID, 토큰, 학교 기록은 전달하지 않았다.
- Muse 변경 파일 없음, 테스트 실행 없음. 보고서의 중복 생성 가능성 추측은 Codex가 전체 제출 함수와 합성 재현으로 좁혔다: 동일 ID는 충돌 거부이며 기록 1건 보존.
- Muse의 누락 테스트 목록 일부는 이미 존재한다. 현재 Apps Script 테스트를 직접 실행해 80/80 통과, 실패 0, exit 0 확인. git diff --check exit 0(줄바꿈 경고만).
- 이번 브라우저/실제 Google 제출/첨부/원격 소스 해시/업데이트/rollback 검증은 미실시.

## 다음 적용 순서

1. 구버전 동일 요청 재전송 회귀 테스트와 안전한 호환 처리/사용자 안내를 Muse로 작성하고 로컬 검증.
2. 기존 원격 v11 소스와 로컬 기준의 읽기 전용 대조 및 소유자 관리자 접근 확인. 비밀 속성·토큰은 모델 외부 전달 금지.
3. 기존 ID/데이터를 보존하는 업데이트 대상, 백업, 복구 버전 확정 후 배포 승인을 받아 적용. 초기 설정을 다시 실행하지 않는다.
4. 실제 제출·동일 Sheet/관리자 기록·비공개 첨부·모바일·업데이트 후 재전송을 별도 검증한다. 현재 상태를 실사용 준비 완료로 표시하지 않는다.

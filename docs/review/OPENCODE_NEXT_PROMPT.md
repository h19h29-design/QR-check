# OpenCode 다음 작업 프롬프트

`D:\opencode\QR-check`의 기존 작업을 이어서 진행한다. 다시 clone하거나 reset/overwrite하지 않는다. 현재 브랜치는 `work/school-owned-web`, 시작 기준은 `ba7d707`이며 시작할 때 작업트리와 HEAD를 먼저 확인한다.

먼저 아래 문서를 순서대로 읽는다.

1. 저장소의 `AGENTS.md`
2. `docs/review/CODEX_OPENCODE_HANDOFF.md`
3. `docs/review/LIVE_VALIDATION_REPORT.md`
4. `docs/review/RELEASE_READINESS.md`

## 실행 경로와 데이터 경계

- OpenCode 모델은 `opencode/muse-spark-1.3-contributor-free`만 사용한다. 유료 모델이나 다른 provider/model로 fallback하지 않는다.
- QR 토큰, OAuth 토큰, 관리자 토큰, 전체 deployment/Script/Sheet/Drive 식별자, 사용자 계정, 실제 Google 데이터는 프롬프트·로그·보고서에 넣지 않는다.
- `.clasprc.json`, live QR URL, 인증된 브라우저/Google 계정, 실제 Sheet/Drive 내용을 Muse에 전달하지 않는다.
- 비공개·기밀 여부가 불확실한 소스는 Muse에 보내지 않는다. 공개 또는 합성 입력만 사용한다.
- GitHub push/merge, 실제 배포, QR 재발급, 장소 변경, Google 공유 권한 변경, 실제 데이터 삭제는 하지 않는다.

## 현재까지 확인된 상태

- Apps Script 활성 테스트 배포는 기존 deployment ID를 유지한 version 11이다.
- 관리자 canonical 제출 URL, 다른 브라우저 화면, 정상 제출→Sheet→관리자 동일 기록은 PASS다.
- 이상 있음 + 합성 PNG 제출은 `COMMITTED`; 관리자 상세에 같은 기록의 PNG 1건이 표시된다.
- Drive 첨부는 owner-only이며 무인증 요청으로 직접 파일을 받지 못했다.
- 로컬 회귀는 Apps Script/클라이언트 43건 + Windows 관리자 16건 = 59/59 PASS, 런타임 빌드는 public 12/admin 18파일 PASS다.
- 실제 QR/휴대폰, live 멱등·충돌, live 이름 유지·QR 재발급, 미등록 관리자, 설치센터 차단, 교육기관 Workspace, 실제 rollback은 아직 `NOT_TESTED`다.

## 이번 OpenCode 작업

공개·합성 입력만으로 다음 미검증 영역의 코드와 기존 테스트를 독립 검토한다.

1. 동일 record ID의 동일 payload 재전송과 다른 payload 충돌 처리(E)
2. 장소 이름 변경 시 QR 유지, 명시적 재발급 시 구 QR 거부(F)
3. 미등록·빈 관리자 신원 거부(G2)
4. 설치센터/중앙 서비스가 없어도 학교 runtime이 동작하는 구조(I)

각 항목에서 실제 사용자 동작과 서버 경계 기준으로 누락된 로컬 테스트 또는 명백한 코드 결함만 식별한다. 변경이 필요하면 실패하는 합성 테스트를 먼저 만들고 실패 이유를 확인한 다음 최소 수정한다. live 증거 없이 `PASS`로 올리지 말고 로컬 결과와 live 상태를 구분한다.

검증 명령은 최소한 다음을 포함한다.

```powershell
node --test tests/gas/*.test.mjs
$env:PYTHONPATH='C:\Users\h19h2\AppData\Local\Temp\qrcheck-pydeps'
python -m pytest admin-desktop/tests -q
node tools/build-runtime.mjs --out <새 임시 출력 경로>
git diff --check
```

## 결과 보고 형식

- executor와 정확한 model ID
- 입력 범위와 민감정보 제외 방식
- 항목별 결론과 근거
- 변경/생성 파일
- 실행한 검사와 결과
- 실패, 차단, 불확실성
- 아직 필요한 실제 live/사용자 검증

커밋은 로컬에서만 만들 수 있으며 push/merge하지 않는다. 범위를 벗어난 실제 Google 변경이 필요하면 실행하지 말고 정확한 이유와 필요한 사용자/Codex 단계를 적는다.

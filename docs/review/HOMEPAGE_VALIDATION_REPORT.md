# 홈페이지 검증 보고서

## 2026-09-08 승인 이미지 기반 리디자인 실행 기록

- 구현/보완/최종 리뷰 executor: OpenCode CLI, requested_model `opencode/muse-spark-1.3-contributor-free`, fallback 없음. 모든 호출 response_received/exit 0. Provider 내부 모델 독립 검증은 하지 않음 (`liveProviderAttested=false`).
- 변경: installer 공통 CSS와 6개 HTML 화면, runtime `Styles.html` 및 `SubmitView.html`. 네이비/코발트/연한 파랑 테마, 홈 split hero, 점검표 장식, 입력 그룹, 모바일 라디오/첨부/전송 스타일. JS 및 서버 로직은 이번 리디자인에서 변경하지 않음.
- Node 기존 검사 172/172 PASS, Python 16/16 PASS. Python 최초 실행은 기존 pytest 임시 폴더 정리 PermissionError; 별도 basetemp 재실행에서 정상 종료.
- 브라우저: 홈 화면 및 390px runtime 합성 미리보기 스크린샷 확인. 홈/체험/만들기/안내서/도움말/업데이트/runtime 합성 화면 × 360/390/768/1440px = 28개 iframe 문서 scrollWidth 검사 PASS. 이는 가로 넘침 검사이며 모든 브라우저/키보드/실제 기기 검증을 뜻하지 않음.
- Runtime 합성 미리보기는 실제 Client.js의 renderItems에 가상 항목 2개를 제공했으며 Google 전송 시작은 제외. 실제 Google 제출/첨부/설치 재검증은 NOT_TESTED.
- 최종 동일 Muse 읽기 전용 리뷰: PASS. local receipt: `C:/Users/h19h2/AppData/Local/Temp/modellgihjt-muse-swGtNC/receipt.json`. 구현 receipts: `modellgihjt-muse-irSu5n`, `modellgihjt-muse-03gIY4`, `modellgihjt-muse-bRzlSP` (동일 Temp 아래).
- 로컬 홈페이지: http://127.0.0.1:57919/ (installer 정적 서버). 빌드: `C:/Users/h19h2/AppData/Local/Temp/qrcheck-redesign-20260908/final-site` (allowlist 20파일, unpublished), `final-runtime` (public 12/admin 18, dirty local source).
- 임시 레이아웃 검사용 파일은 빌드에서 제거했고 20파일을 다시 확인함. 공개 배포/Apps Script 업데이트/push/merge/커밋은 수행하지 않음.

---

날짜: 2026-09-08
모델: opencode/muse-spark-1.3-contributor-free
브랜치: work/school-owned-web (push/merge/deploy 없음)

## 범위

- 학교 소유 웹 정적 사이트의 로컬 구현 검증 상태 기록
- 공개 배포 완료를 주장하지 않음

## 구현 요약

- 정적 사이트 소스: `installer/` 이하
- 구현 표면: main, maker, demo, guide, help, update
- update 페이지는 미발행 상태를 정직하게 표시하며 적용 동작을 제공하지 않음

## 라우트 표

| 경로 | 내용 | 로컬 확인 |
|---|---|---|
| `/` | 메인, CTA 포함 | HTTP 200, 렌더 확인 |
| `/maker` | OAuth 클라이언트 ID 비어 있음 시 차단 상태 표시 | 차단 문구 및 버튼 비활성화 확인 |
| `/demo` | 샘플 배너 표시 | 샘플 문구 확인 |
| `/guide` | 안내 | 구현됨, 실시간 외부 검증 미완료 |
| `/help` | 도움말 | 구현됨, 실시간 외부 검증 미완료 |
| `/update` | 미발행 상태 표시, 적용 동작 없음 | HTTP 200, 미발행 표시 확인 |

## 빌드 결과

- 빌드 명령: `node tools/build-site.mjs --out <new-empty-output-dir>`
- 최신 미발행 빌드 결과: `file_count 20`, `runtime_file_count 0`, `status unpublished`
- 해당 출력물은 로컬 임시 산출물이며 배포 가능한 릴리스로 취급하지 않음
- 런타임 빌드: 버전 `0.1.0`, `dirty true`, 공개 12개 파일, 관리자 18개 파일
- dirty 런타임은 발행 금지
- 런타임 매니페스트가 제공된 경우 build-site가 매니페스트/해시/dirty 상태를 검증함

## 자동화 테스트 결과

- Node: 172/172 PASS
- Python 관리자 데스크톱: 16/16 PASS
- `git diff --check`: clean
- 비밀 패턴 스캔: 일치 항목 없음

## 로컬 미리보기

- 주소: `http://127.0.0.1:57917/`
- 제공 원본: 최신 20파일 미발행 출력물
- 루트/demo/update: HTTP 200

## 뷰포트/접근성/상호작용 증거

- 홈페이지: 360/390/768/1440에서 가로 넘침 없음
- 본문 18px, CTA 높이 54px
- 키보드 Tab에서 건너뛰기 링크 노출 확인
- CTA에서 maker 도달 확인
- OAuth 클라이언트 ID가 비어 있는 maker는 정확한 차단 상태 표시와 connect/create/verify/complete 비활성화를 표시함
- demo는 정확한 샘플 배너를 표시함
- 모바일 demo 수정 후 390px DOM 지표에서 페이지 넘침 없음
- 자동화된 demo 동작 테스트 통과

## 브라우저 입력 제한

- 후반 인앱 브라우저는 읽기 전용 상태가 됨
- DOM/스크린샷 조회는 동작했으나 폼 입력 API가 탭을 상실함
- 따라서 최종 합성 제출/일괄 클릭은 NOT_COMPLETED로 기록함
- 저장소 Playwright 의존성은 설치되지 않았으므로 대체 상호작용 실행이 있었던 것처럼 기술하지 않음

## 개인정보/네트워크

- 비밀 패턴 스캔: 일치 항목 없음
- 실제 사용자 비밀·실시간 ID는 기록하지 않음
- 서버 PID 등 운영 세부 정보는 문서화하지 않음

## PASS / NOT_TESTED

PASS:

- 정적 빌드 20파일 생성
- Node 172/172, Python 16/16
- `git diff --check` clean
- 비밀 패턴 스캔 무일치
- 로컬 루트/demo/update HTTP 200
- 4개 뷰포트 넘침 없음, 건너뛰기 링크, CTA→maker 이동
- 빈 OAuth 차단 상태 및 demo 샘플 배너

NOT_TESTED:

- 로그인된 Google 브라우저 미연결
- 실제 OAuth/리소스 생성
- 교육용 Workspace
- 인쇄된 QR/모바일 스캔
- 실시간 E/F/G2/I
- 롤백 실제 수행

## 결론

- LOCAL_IMPLEMENTATION_VERIFIED
- PUBLIC_DEPLOYMENT_NOT_DONE

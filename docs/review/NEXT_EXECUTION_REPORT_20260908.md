# QR-check 실행 기록 — 모델 재확인 및 인증 경계 사전 검토

## 13. 2026-09-09 09:58~11:13 연속 실행 — 로컬 반영, 외부 관문 대기

### 최신 결론과 남은 관문

- 지정 Go Muse Contributor/xhigh가 코드·테스트를 작성하고 Codex가 원본 SHA·diff·회귀·브라우저를 직접 검토했다. 전역 모델/AGENTS/결제 설정은 변경하지 않았다.
- 최종 Node314/314, Python16/16, 미게시 홈페이지23파일, 실제 dirty runtime ADMIN18/PUBLIC12 생성 및 게시 거부 확인. 390/1440 합성 resume 검사와6화면24레이아웃/11상호작용 통과. 테스트 조건·제한은 아래 개별 기록 참조.
- 이번 핵심 제품 변경: apps-script/Api.gs; installer/maker/index.html 및 maker.js; installer/src/google/resources.mjs; installer/src/install/orchestrator.mjs 및 신규resume.mjs; tools/build-site.mjs 및 build-runtime.mjs. 관련 신규/수정 tests와 이 실행 계획/보고서 포함. 이전 Auth/SchoolConfig/기타 dirty 변경은 보존했으며 이번 작업과 혼동하지 않는다.
- 실제 사용 가능/출시 완료 판정은 하지 않는다. 공개 OAuth client ID는 여전히 빈 값이고 source release는 unpublished다. 실제 Google Cloud 설정·허용 origin·테스트 계정·학교 시험 자원 생성 승인과 정보가 필요하다. clean 릴리스용 변경 검토/커밋도 별도 승인 없이 수행하지 않았다. 제공 manifest/코드 일치 검사가 실제 Git HEAD/clean 상태의 독립 증명을 대신하지 않는다.
- 실제 Google 배포, 계정 승인, QR 제출, 같은 Sheet 기록/관리자 확인, 비공개 첨부 접근, 휴대전화 실기기 동작은 모두 미검증이다. 초기 설정의 보류 마커는 기존 자원 확인 없이 지우거나 자동 재시도하지 않는다. 다른 릴리스/구형 snapshot의 자동 이관은 제공하지 않는다.

### 읽기 전용 최종 리뷰 처리

f8Jcgw(ses_f7c129b0bffern2j8AiZJSWgzJ), review-only, exact opencode-go/muse-spark-1.3-contributor/xhigh/stop DB 확인, 변경0. 공개5파일 resume/state/orchestrator/resources/maker만 검토했다. Critical/Important0 보고; 이는 전체 보안 감사나 Google 실연동 증명이 아니다. Minor2건에 대해 Codex가 실제 코드를 대조했다. (1) pending JSON 출력 제거 제안은 채택하지 않음: 비밀 없는 장애 증거를 보존해야 하며 UI는 이미 보류 작업 거부를 안내하고 parser가 복원을 막는다. (2) 배포 후 다시 만들기 클릭에서 원래 학교명이 필요한 UX는 기록: install_prefix는 이미 JSON에 노출되고 정상 retryTarget(AWAITING→verify)는 prefix를 요구하지 않는다. 계정/자원 검사를 우회하는 변경은 하지 않았다. 모델 라우팅 및 코드 리뷰/검증 스킬은 격리 Muse 작성·별도 읽기 검토·Codex 직접 실행 확인에 사용했다.

11:09~11:12 후속 산출물 보호: 4RBvD8 tests(ses_f7c192439ffe8RdDBfW7E5kn97), Yh2aws 구현(ses_f7c171817ffeH17bo8wqsQKxmu), exact Go Muse/xhigh/stop 모두 확인. 기존 빌더가 기존 출력/원본 경로/잘못된 인수를 받아들이는 RED1pass/6fail, 수정 후7pass. 변경 tools/build-runtime.mjs + 신규 installer/tests/runtime-output-safety.test.mjs. 새/빈 실제 디렉터리만 허용, ROOT/apps-script/파일시스템root/링크 경로 거부, 인수 엄격검사, 파일은 wx 독점 생성. 이전 산출물 삭제/정리 없음. Windows junction 및 다른 OS 특수 경로에 대한 직접 실험은 별도 미검증이다. Codex 전달 명령 인자 누락으로 ENOENT가 모델 실행 전에 한 번 발생했으며 --task/CLI 경로만 바로잡았다. 공급자 실패나 자동 모델 대체는 없었다.

원본 통합 Node314/314(57suites, 실패0, exit0), Python16/16(새 pytest-final-1111), runtime-final-1109는 실제APP_VERSION0.1.0/실제HEAD/dirty=true/admin18/public12. 사이트 site-final-1109는unpublished/23/runtime0. 새23파일 SHA가 브라우저 검사한 site-resume-1049의23파일과 모두 동일. dirty runtime 게시화는 다시 차단. git diff --check 통과(줄바꿈 예고만). 공개client ID 빈값, source unpublished, HEAD/branch 및 디자인 CSS 변경 없음. 별도 Muse 읽기 전용 resume 리뷰 대기 중이며, 실제Google 설정/시험자원생성 권한을 사용자에게 질문했다. 아직 외부 변경/커밋/푸시 없음.

11:03 후속 빌드 계약: nJeunl tests-only(ses_f7c209118ffeHq3b5Y1lm3VvEJ), vR5txN build-site 구현(ses_f7c1c2daeffeG0ACpHVPQRuqRv), 두 DB exact Go Muse/xhigh/stop 확인. 기존 부분 파일/짧은 commit/Code 버전 불일치를 RED17pass/3fail로 재현(각 table 첫 실패까지만 실행). 새 구현 후20pass로 전체 음성 table 실행. 원본 SHA 대조·diff 검토·기계적 반영 뒤 전체307pass/57suites. tools/build-site.mjs와 installer/tests/site-content-build.test.mjs 변경. manifest/admin 실제 파일을 정확한18개로 대조하며 중복·누락·추가·빈 파일, 전체40/64hex commit·정규 ISO 시간·엄격semver, Code APP_VERSION과 manifest 버전, USER_DEPLOYING/ANYONE_ANONYMOUS를 검사한다. 이전 hash/byte/secret/output/no-spawn/no-delete 보호는 유지한다. 테스트 published는 합성 runtime만 임시 폴더에서 생성했으며 원본 release는 계속 unpublished다. 검사는 공급된 manifest와 bytes의 일관성이며, 서명/실제 Git clean 상태/체크아웃 commit 독립 증명이 아니다. clean 릴리스는 별도 검토·승인 관문을 유지한다.

10:54 후속 브라우저: k2Xr9R 최초 QA 스크립트의 모의 GIS 문법/빈 client 설정 치환/390범위 누락을 Codex가 정적으로 찾아 미실행, NGTb0D가 수정. 둘 모두 exact Go Muse/xhigh/stop DB 확인. 수정본은 원본 installer 대상390/1440에서 수동 연결→DRAFT→잘못된 JSON/pending/다른 계정 거부→정상 API_ACCESS_READY 복원/기존ID 보존·재복원 잠금·완료 비활성 검사를 통과했다. 보고서 failures/unexpectedExternalRequests/writes/consoleWarnings/consoleErrors/pageErrors 모두 빈 배열, exit0. 실제 Google은 모두 차단/모의 응답, liveGoogle=false. 한국어 실패 표시는 VM에서 직접 status 단언, 브라우저 스크립트는 body 한국어/예외 노출 여부 수준 검사인 한계를 기록한다. 390/1440 성공 screenshots를 Codex가 직접 확인했다. 증거: `C:/Users/h19h2/AppData/Local/Temp/qr-owner-pilot-0dfd6c2d7c134d4093156fd7adb7bb79/resume-browser-1054/report.json`. 임시 QA 스크립트는 원본 저장소에 넣지 않았다.

사용자 지정 Go Muse/xhigh 재개. Smoke EilHrX(ses_f7c53e21fffepy5vpXsLMvxDDr) 정상. 공개/합성 입력만 전달, 모든 작성은 격리 사본, Codex가 diff/입력 SHA 검토 후 기계적 apply_patch 및 직접 테스트. 전역 설정·결제·비밀값 변경 없음. 아래 사본의 로컬 DB assistant metadata 모두 exact opencode-go/muse-spark-1.3-contributor/xhigh/stop 확인. 공급자 내부 독립 증명 아님.

| Muse 사본 | 작업 | Codex 직접 확인 |
|---|---|---|
| QkhIK7 | 연결 검사 테스트21개 | 기존13pass/8fail: 계정 생략·조기 읽기·반복 전이 |
| SZPSpT | checkSchoolVerified 필수 계정/상태 gate, 반복 검사 | 21pass |
| dSpBa5 | 완료 재검사 tests3 및 기존 happy-path 계정 인자 | 새 함수 부재로3fail, 기존 테스트 한 줄 인자 수정 |
| RQ89nW | completeSchoolInstall + maker async 연결·문구·키 안내 | 275pass/1fail: 이전 advance 정적 검사만 실패 |
| zJY3Fx | 초기 재전송/부분실패 tests3 + 정적 검사 호출명 갱신 | 신규1pass/2fail 재현 |
| ll6D8e | Api 최초 설정 pending/재전송 차단 | setup23pass, 원본 통합279/279(56 suites) |
| woTTp0 / 2Ah7uE | resume 형식 tests8 / parser | RED 모듈 부재 → 8pass |
| slQkhK | 실제 자원 대조 tests7, read API tests3 | RED 누락 export/API 및 버전 검사 실패 |
| y7BV3u | Drive metadata GET / 버전별 getContent | 3pass, 원본 resources.mjs 입력 SHA 대조 후 반영 |
| PZNwsV | 읽기 전용 restoreInstallFromSnapshot | 7pass, parser 포함 신규18pass 원본 반영 |
| K9gIf2 | 실제 bootMaker resume VM 테스트6개 | 기존 포함12pass/5fail RED |
| CGpxkx | maker.js 복원 버튼 이벤트 + 403 오류 fixture | 13pass/4fail: VM host Object/JSON 혼합으로 객체 판정 실패 |
| IpXi7S | VM realm 수정, HTML 입력창, 빌드23파일 목록 | focused17pass, 원본 전체303pass/57suites |

10:49 이후: 수동 resume-input/resume-btn 연결 및 schema JSON-only 출력 반영. 기존 설치가 있으면 덮어쓰기 거부, resource-empty DRAFT에서만 복원. 토큰 계정을 다시 읽고 전체 자원 검증 후 install 할당, 실패 시 이전 DRAFT 보존. busy 중 복원 포함 모든 쓰기/검사 버튼 잠금. 이전 safeResumeSnapshot API는 보존했다. 테스트의 JSON/Object VM realm 주입 문제는 제품 검증을 느슨하게 하지 않고 harness에서만 해결했다. CGpxkx 작업에는 HTML 입력이 없었으므로 해당 작업은 HTML 미작성, IpXi7S에 원본 HTML을 따로 제공해 최소6줄을 반영했다.

새 site-resume-1049 빌드 unpublished/23파일/runtime0 통과. 그 출력 자체를 Browser plugin not available → 기존 Playwright로 검사: http://127.0.0.1:60661 (종료), 24레이아웃+11상호작용 모두 통과/pageerror0. 증거 validation-1050/browser-results/report.json 및390/1440screenshots. 원본 OAuth ID 빈값/미게시 유지. 신규 복원 브라우저 검사는 k2Xr9R 작성본의 GIS 문법/빈 설정 치환/390검사 누락을 정적 검토에서 찾아 Muse 수정 요청 중이며 아직 통과 주장하지 않는다.

실제 현재 원본 runtime-dirty-audit-1051 생성: version0.1.0/HEAD6e3a2b00e3eb34f24888205ef3f7aad1904d9292/source_dirty=true/admin18/public12. 이 dirty runtime을 site-dirty-rejection-1051 게시 빌드에 넣자 `refusing dirty runtime source` exit1로 예상 차단. clean 릴리스·공개 배포 증거가 아니다. 검사 임시 산출물만 생성했고 원본/Google/원격 변경은 하지 않았다.

10:37 KST 중간: 신규 installer/src/install/resume.mjs 및 installer/tests/resume-{parser,read-api,resource-validation}.test.mjs 반영. 스냅샷은 schema1/full source commit/동일 계정·release/단계별 ID를 검사하고 pending은 거부한다. 실제 Google metadata의 소유권·이름·종류·Sheet 부모 폴더와 HEAD/버전 코드·배포 주소를 읽기 대조한 뒤에만 복원 객체를 반환한다. 과거 완료도 AWAITING_SCHOOL_AUTH로 돌려 새 검사를 요구한다. 저장된 JSON의 무결성 서명이나 실서비스 검증을 뜻하지 않는다. 복원 UI/빌드 allowlist는 아직 연결 전이다.

슬롯별 DB metadata exact Go Muse/xhigh/stop 확인: slQkhK=ses_f7c3cadd9ffeKho9K8rc6TRWPC, y7BV3u=ses_f7c35ee88ffeupBCbFMePIjwiI, PZNwsV=ses_f7c34be6effebgRqum8qQyAgjI. Python 기존 관리자 회귀는 새 pytest-1035-resume 임시경로에서 16pass/0fail. 원본/배포 설정 변경 없음.

이번 반영 파일: installer/src/install/orchestrator.mjs, installer/src/install/installer.test.mjs, installer/maker/maker.js, installer/maker/index.html, installer/tests/verification-state-safety.test.mjs, installer/tests/completion-recheck.test.mjs, installer/tests/maker-states.test.mjs, apps-script/Api.gs, tests/gas/setup-binding-safety.test.mjs, 실행 문서. 기존 dirty 보존, 디자인 CSS 변경 없음.

완료 버튼은 VERIFIED 후에도 실제 토큰 계정 및 현재 settings_school 표시를 읽은 후에만 COMPLETE로 전진한다. 이는 초기 설정 확인 완료이며 QR 제출·Sheet 기록·관리자·비공개 첨부·모바일 운영 검증을 뜻하지 않는다. 반복 VERIFIED/COMPLETE 검사는 상태/기존 timestamps를 재작성하지 않는다. 과거 상태는 현재 운영의 증거가 아니다.

최초 설정 부분 실패는 initial_setup_pending='started'라는 비밀값 없는 학교 ScriptProperties 표시를 보존한다. auth/입력/타깃 읽기 선검증 뒤 최초 쓰기 전에 설정하며, 정상 끝까지 완료한 경우에만 삭제한다. 키 재발급/재전송으로 우회하지 않는다. 부분 자원 자동 삭제·rollback·자동 복구는 제공하지 않으며, 기존 Sheet/Drive 확인 후 별도 복구 판단이 필요하다. 성공했던 최초 키 요청 재전송은 추가 장소 생성 대신 안내 오류. 초기 키 없는 기존 관리자 재설정 경로는 유지한다.

중간 브라우저: Browser plugin not available → 기존 Playwright 검사. 실제 installer의6화면×320/390/768/1440 =24레이아웃 및11상호작용 통과, pageerror0. URL http://127.0.0.1:50180 (검사 후 종료). GIS는 합성 빈 응답, console warning/error 전체는 이 스크립트에서 미수집. 증거 `C:/Users/h19h2/AppData/Local/Temp/qr-owner-pilot-0dfd6c2d7c134d4093156fd7adb7bb79/validation-1010/browser-results/report.json`. 화면 크기 검사는 실기기 시험이 아니다. unpublished 사이트 빌드 site-unpublished-1012:22파일/runtime0/exit0.

다음 진행 중: 재개 JSON schema/계정/릴리스 검사와 실제 자원 재검증. 아직 완료/실사용 준비 판정하지 않는다. 이번 커밋/푸시/Google 자원 변경/배포 없음.

## 12. 2026-09-09 09시 Go 경로 재승인 — Sheet 읽기 오류 차단

- 무료 경로 doctor가 model_unavailable로 중단된 뒤 사용자가 이전 Go 경로 사용을 명시 승인했다. 전역 AGENTS/라우팅/결제 설정은 수정하지 않았다. 기존 CLI·작업 전용 runner의 --model opencode-go/muse-spark-1.3-contributor --variant xhigh를 사용했다.
- smoke wCwNOY: UTC00:07:56~00:08:01, ses_f7c81d3fdffeta6Ii043xSC6ov, MUSE_SMOKE_OK. 테스트 작성 yD66CB: ses_f7c816413ffeU1O69aU33Yur36, UTC00:08:25~00:09:53. 구현 qbjiz3: ses_f7c7fad50ffep43i9XWgrXH5Sg, UTC00:10:17~00:10:57. 셋 모두 DB metadata exact Go Muse/xhigh/stop 확인(공급자 내부 독립 증명 아님). 실행 사본은 C:/Users/h19h2/AppData/Local/Temp/modellgihjt-muse-각사본명/에 보존.
- 입력은 공개 SchoolConfig.gs 및 합성 VM 회귀 테스트뿐. 실제 계정/학교/키 전송 없음. Muse는 코드·테스트 작성, Codex는 전체 테스트/제품 diff 검토와 실행 및 기계적 apply_patch 통합 담당. Muse 테스트 실행 주장 없음.
- 원인: getSpreadsheet_가 schoolProp_의 오류→기본값 처리를 통해 속성 읽기 실패에도 active Sheet로 넘어갔다. 기존 코드에서 신규7검사 중5pass/2fail로 재현. 수정 후7pass. 새 동작은 authoritative ScriptProperties 읽기 실패 시 정제된 오류를 던지고 SpreadsheetApp 접근 중단. null/empty의 정상 컨테이너 fallback 및 bound openById 실패 차단은 유지. generic schoolProp_와 describeBinding_는 이번 범위 밖이다.
- 변경: apps-script/SchoolConfig.gs, tests/gas/schoolconfig-read-safety.test.mjs, 실행 계획/보고서. 원본 SHA dcdec4d587b86c1ba47669014ce22d06692a384283b629773a3732ffc5a263d2 대조 후 반영. 다른 dirty 파일 보존. 원본 전체 Node 테스트 dot reporter exit0 확인. UI 변경 없음, 이번 브라우저 재검사/Google 실연동/배포/커밋/푸시는 하지 않았다.
- 아직 초기 설정 중복 요청·응답 유실, snapshot 복원, 완료 의미, 빌드 전체 계약/clean 릴리스, 실제 Google/기기 검증은 남았다. 이번 수정은 그 전체 완료를 뜻하지 않는다.

## 최신 검증 부록 — 2026-09-09 08시 단위

11절 구현 후 Muse JR36yp가 임시 qa/setup-ui-browser.cjs 작성. 세션 ses_f7cacb76cffe1T3czqGNqE7gah, UTC23:21:05.940~23:22:26.682(09-08). DB metadata exact opencode-go/muse-spark-1.3-contributor/xhigh, finish=stop 확인. 공개 HTML/CSS·합성 입력만 전달, 제품 변경 없음. Codex가 전체 스크립트를 읽고 실제 저장소 대상으로 실행했다.

Browser plugin not available로 설치된 Playwright Chromium 사용. 실제 WebApp.html/Styles.html을 로컬 렌더링하고 google.script.run만 합성 성공/실패로 대체. 320/390/768/1440px, 52검사, 실패0, exit0. 입력 전달·빈 ID·실패 표시·합성 성공 콜백·수평 넘침·중복 ID 검사. 콘솔 warning/error 및 pageerror 수집 결과 errors=[]이다. 실제 Google 성공/모바일 실기기 검증은 아니다.

증거: `C:/Users/h19h2/AppData/Local/Temp/qr-owner-pilot-0dfd6c2d7c134d4093156fd7adb7bb79/setup-browser-20260909-08/setup-ui-browser-report.json` 및 같은 폴더 setup-390-initial.png, setup-390-error.png, setup-1440-initial.png, setup-1440-error.png. initial도 폼 입력 후 자동 스크롤된 뷰포트이며 전체 페이지 캡처는 아니다. Codex가 390/1440 initial을 직접 확인: Sheet ID 안내·입력·장소·기존 토큰 필드·저장 버튼에 겹침/가로 잘림이 보이지 않았다. 임시 서버 종료.

통합 Node245/245, Python16/16, unpublished22파일 빌드 통과. git diff --check exit0(줄바꿈 예고만 있음). 커밋/푸시/Google 변경/배포 없음. 전체 실사용 가능 판정 아님.

추가 회귀 필요: SchoolConfig.getSpreadsheet_의 schoolProp_ 읽기 오류→빈값→active Sheet fallback. Api 최초 직접 속성 읽기는 보호했으나 후속 읽기 실패까지 모두 차단됐다고 주장하지 않는다. 안전한 snapshot 복원, 중복 초기 설정/응답 유실, 완료 의미, 빌드 전체 계약, clean 릴리스와 실제 Google 검증도 남아 있다.

기록일: 2026-09-08 (KST). 아래 초기 기록은 G0 통과, G1 일부 검토 후 지원 범위 결정 대기 시점이다. 후속 승인/작업은 끝의 추가 기록으로 구분한다. 로컬 준비 완료·실연동 완료·출시 가능 판정이 아니다.

## 1. 실제 Muse 연결

- OpenCode CLI 1.18.29. 앞선 단계에서 --version, run --help, models 및 해당 모델의 --verbose 메타데이터를 확인했다.
- 요청 모델: opencode-go/muse-spark-1.3-contributor. 명시한 variant: xhigh.
- 재호출 시각: 2026-09-08T12:44:39.124Z ~ 12:44:44.131Z (21:44 KST).
- 실제 CLI 인수: run --pure --model opencode-go/muse-spark-1.3-contributor --variant xhigh --agent modellgihjt-muse --format json --title "QR readiness xhigh".
- 입력은 도구/파일 읽기·수정 없이 READY만 요청한 합성 문구. 프로젝트 파일은 전송하지 않았다. 별도 HOME/config/work 공간, 모델 고정, 세션 공유 비활성, 다른 모델 위임 금지.
- 응답 READY, OpenCode 종료 코드 0, 검사 도구 종료 코드 0, 오류 없음, 생성/수정 제품 파일 없음.
- OpenCode 로컬 DB의 해당 세션 user model 및 assistant metadata를 읽기 전용 조회했다. 모두 providerID=opencode-go, modelID=muse-spark-1.3-contributor, variant=xhigh. assistant finish=stop.
- 실행 기록: C:/Users/h19h2/AppData/Local/Temp/modellgihjt-muse-PRTrrS/receipt.json.
- 이는 CLI 실행 메타데이터의 확인이다. 공급자 내부 모델 독립 증명은 아니다(liveProviderAttested=false).
- 앞선 실패는 임시 검사 도구가 READY 대신 MUSE_SMOKE_OK를 기대한 Codex 작성 실수였다. 이번에는 그 비교만 수정했다. 인증·결제·전역 AGENTS·라우팅 설정을 변경하지 않았다.
- 모델 라우팅 스킬의 격리 실행/비밀값 비전송 원칙을 적용했고, 사용자 최신 지시의 정확한 모델·xhigh·실패 시 중단 조건을 우선했다.

## 2. 시작 상태와 보존

- 경로: D:/opencode/QR-check.
- 브랜치: work/school-owned-web.
- HEAD: 6e3a2b00e3eb34f24888205ef3f7aad1904d9292.
- git status --short 및 --porcelain=v1 --untracked-files=all 결과: 출력 없음. staged/unstaged/untracked 변경 없음.
- 인계서의 3c389d8 및 dirty 상태는 과거 기록이다. 되돌리지 않았다.
- git archive --format=zip으로 현재 HEAD 추적 소스의 복구 사본을 만들었다. 무시된 로컬 파일/자격증명은 사본에 넣지 않았으며 원래 위치에서 건드리지 않았다.
- 사본: C:/Users/h19h2/AppData/Local/Temp/qr-check-baseline-0616652a6c504e15a214402d36ca9b2e/source-6e3a2b0.zip.
- ZIP SHA256: FAD4A7CAD4189C9956E77F204F90E9E39A4F00FB834A29C93EB67A2E7805F8C8.
- 이번 저장소 변경은 이 보고서와 NEXT_EXECUTION_PLAN_20260908.md뿐이다. 제품/테스트/디자인/기존 Apps Script를 수정하지 않았다. 커밋·푸시·배포 없음.

## 3. Codex 직접 사전 검토

직접 읽은 핵심 코드: src/google/resources.mjs, rest.mjs, src/auth/config.js, google-auth.mjs, src/install/orchestrator.mjs, apps-script/Auth.gs, Code.gs, SchoolConfig.gs, appsscript.json 및 build-runtime.mjs. build-site.mjs는 확인을 시작했지만 전체 검토 완료로 계산하지 않는다.

적용 AGENTS, 첨부 인계서와 계획, AUTH_DEPLOYMENT_ADR, GAS_FEASIBILITY, OAUTH_SCOPE_MATRIX를 대조했다. 전체 인계서 11개 항목 감사나 보안 감사 완료를 주장하지 않는다.

| 분류 | 파일·함수·조건 | 영향·근거 | 최소 조치 / 검증 |
|---|---|---|---|
| B/C: 구조·지원 범위 결정 및 실측 | apps-script/appsscript.json USER_DEPLOYING + ANYONE_ANONYMOUS; Auth.gs activeEmail_/requireAdmin_ | 익명 QR는 소유자 권한 실행, 관리자 신원은 방문자 active email에 의존. 다른 계정/도메인 신원은 공식 문서상 보장되지 않음. 소유자/같은 Workspace 도메인은 예외가 있을 수 있어 모든 계정 실패라고 단정하지 않음 | 첫 시험을 소유자 관리자 1명으로 제한할지, 다중 관리자 인증·배포 설계를 먼저 할지 결정. 승인 후 계정별 live 양성/음성 검사 |
| D: 읽은 함수 범위에서 안전한 거부 | Auth.gs requireAdmin_ | 빈 active email 거부, 미등록 이메일 거부, payload의 email/role을 권한 근거로 사용하지 않음 | 그대로 보존. 전체 호출부·실제 Google 접근 검증은 아직 미실행 |
| A: 확인된 API 계약 불일치 | resources.mjs moveIntoFolder | POST /files/{id}:move 사용. 공식 Drive v3 이동은 files.update PATCH + addParents/removeParents. orchestrator가 실패를 삼켜 sheet_outside_folder로 남김 | REST PATCH 지원과 실제 부모 조회/변경 최소 수정 및 mock 계약 검사. 실제 이동 성공은 별도 live 확인 |
| A: 생성 중복 위험 | rest.mjs createRestClient/call | 메서드 구분 없이 네트워크 오류/429/5xx를 최대 3회 재시도. 생성 POST가 서버에 반영됐으나 응답 유실 시 중복 가능 | 생성 자동 재시도 차단, 결과 불명 상태 표시, 재개 시 조회로 대조. API 반영 후 응답 유실을 주입하는 회귀 검사 필요. 아직 미수정 |
| A: 모호한 자원 선택 | resources.mjs findDriveFolder/findSpreadsheet | 이름 검색 결과 첫 항목을 바로 재사용; 소유/설치 식별자/복수 후보 대조 없음 | 계정·설치 식별 대조와 복수/불명확 후보 중단. 동일 이름 후보 및 타인 공유 자원 회귀 검사 필요 |
| B | src/auth/config.js | GOOGLE_OAUTH_CLIENT_ID 공란. 실제 Cloud 콘솔 준비 여부는 조회하지 않음 | 승인된 origin/client/API/동의 준비 확인. 가짜 값 삽입 금지 |
| B: 기존 문서 오류 | OAUTH_SCOPE_MATRIX versions.create 항목 | 문서는 script.deployments로 적었으나 공식 문서는 script.projects 요구. config는 두 scope 모두 요청하므로 이 차이 자체로 실행 실패를 확정하지 않음 | 문서 수정 후보. 토큰의 실제 허용 scope 검사 별도 검토 |
| B: 문서/파일 불일치 | tools/build-release.mjs | 파일 검색에서 존재하지 않음. build-runtime.mjs/build-site.mjs 존재 | 없는 명령 실행하지 않음. 실제 빌드 경로 나머지 검토 후 문서 정정 |

## 4. 공식 Google 근거

조회일: 2026-09-08. 아래는 API/권한 계약 검토이며 실제 Google 자원 생성이나 설치 성공 증거가 아니다.

- [Session.getActiveUser/getEffectiveUser](https://developers.google.com/apps-script/reference/base/session): 사용자 승인 없이 소유자 권한 실행하는 웹앱에서 방문자 이메일 제한. 소유자 본인/같은 Workspace 도메인의 예외 설명도 확인했다. effective user는 방문자 인증 대체가 아니다.
- [웹앱 manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable): USER_DEPLOYING/USER_ACCESSING 실행 주체와 익명 접근 설정의 의미를 확인했다.
- [Apps Script API 접근 승인](https://developers.google.com/apps-script/api/how-tos/enable): 설치 앱 Cloud API 활성화, 학교 사용자의 Apps Script API 접근 허용 및 개별 앱 승인은 구분된다. 자동 우회하지 않는다.
- [Drive 폴더 이동](https://developers.google.com/workspace/drive/api/guides/folder): PATCH files.update, addParents/removeParents 계약.
- [Apps Script 버전 생성](https://developers.google.com/apps-script/api/reference/rest/v1/projects.versions/create): script.projects scope.

## 5. 중단 판정과 다음 결정

Muse 연결은 정상이다. 구조 변경 필요 지점에서 임의 진행하지 말라는 사용자 지시에 따라 **소유자 외 관리자 지원 범위**를 먼저 결정한다. 단일 공개 웹앱의 getActiveUser 신원 한계를 UI 수정이나 client email, getEffectiveUser, 토큰 fallback으로 우회하지 않는다.

최소 대안: 새 테스트 학교의 첫 지원 범위를 설치 소유자 관리자 1명으로 제한하고 기존 구조의 로컬 결함 수정과 E2E 준비를 먼저 진행한다. 다른 관리자 계정 지원이 필수라면 별도 인증·배포 설계를 먼저 검토·승인한다. 여러 배포/프로젝트 추가를 아직 구현하거나 확정 대안으로 승인한 것은 아니다.

이 결정은 테스트 계정 접근·OAuth 변경·Google 자원 생성·배포 승인을 대신하지 않는다. 외부 변경 범위는 독립적인 로컬 준비 후 묶어 확인한다.

## 6. 이번 검사와 미실행 범위

- 실행함: Muse 합성 실제 호출, 종료/실행 모델/variant 조회, git 상태/HEAD/브랜치, 추적 소스 복구 ZIP 및 SHA256, 코드 읽기, 공식 문서 조회.
- 미실행: 새 회귀 테스트, 전체 Node/Python, runtime/site 빌드, 6개 화면 브라우저, 실제 Google OAuth·자원 생성·배포·QR/Sheet/Drive 대조, 실제 Android/iPhone, 업데이트/rollback.
- 과거 130/172/16 등의 수치를 이번 결과로 사용하지 않는다.
- 최종 수준: G0 완료 / G1 일부 확인 및 범위 결정 대기. 로컬 준비 완료 아님, 새 테스트 학교 실연동 완료 아님, 제한 시범운영 승인 아님, 일반 학교 공개 불가.

## 7. 소유자 관리자 1명 범위 승인 후 작업 중 기록

- 사용자 승인: 소유자 계정 1개만 관리자인 테스트 학교부터 준비하고 다중 관리자는 이후 확장. 구현은 동일 Muse xhigh. 별도 모델 사용 없음.
- 시작 변경: 이전 실행에서 작성한 위 두 docs/review 문서만 미추적. 제품 HEAD 6e3a2b0 그대로. 두 문서 사본은 C:/Users/h19h2/AppData/Local/Temp/qr-owner-pilot-0dfd6c2d7c134d4093156fd7adb7bb79에 보존했다.
- 21:51 KST 기준선 실행: `node --test --test-reporter=spec installer/tests/*.test.mjs installer/src/install/*.test.mjs installer/src/update/*.test.mjs tests/gas/*.test.mjs` → 178 tests, 41 suites, pass178/fail0, exit0. 제품 변경 전, 문서만 untracked. Google/GAS는 mock 로컬 검사이며 live가 아니다.
- Muse 첫 단위: 실제 bootMaker의 릴리스 차단 회귀 테스트만 작성하도록 요청. 아직 제품 코드를 수정하도록 허용하지 않았다. 격리 실행 중 provider/model/variant 메타데이터가 지정 값과 일치함을 조회했다.
- 추가 직접 검토: maker.js 전체, state-machine.mjs 전체, update-page.js, update.mjs, build-site.mjs 전체, Api.gs/SchemaMigrations.gs/Admin.gs/Submit.gs/DriveFiles.gs/QrTokens.gs 및 installer.test.mjs.
- 인계서 표현 정정: 실제 Admin.gs 호출부는 requireAdmin_가 아니라 verifyAdmin_를 사용한다. verifyAdmin_도 현재 google_only/token_compat 양쪽에서 빈 신원·미등록 계정을 거부하지만, ADR과 함수 이름 설명을 실제 호출부에 맞춰 정정해야 한다. 클라이언트 email만으로 통과시키지 않는다.
- 추가 설치 단서: createScriptProject는 parentId 없이 독립 프로젝트를 만들고, 학교 바인딩은 ScriptProperties.spreadsheet_id를 필요로 한다. Api.gs는 setup payload의 spreadsheet ID 바인딩 경로가 있으나 현재 WebApp.html setup 폼에는 해당 입력/전달이 없다. 새 학교 초기 설정의 실제 바인딩 경로를 최소 보완할 필요가 있다. 기존 테스트 배포의 바인딩 상태를 새 설치 증거로 사용하지 않는다.
- 새로 확인한 공식 문서(2026-09-08): https://developers.google.com/identity/oauth2/web/guides/use-token-model 의 granular permissions. 현재 grantedScopes()는 요청 scope를 돌려주며 실제 승인 scope와 다를 수 있다. 설치 시작 전 실제 승인 범위 검사 후보로 기록한다.
- 나머지 빌드 계약/완료 의미/재개/중복 생성 결함은 아직 해결하지 않았다. 일반 공개·실사용 가능 판정을 내리지 않는다.

### 회귀 재현과 실행 환경

- Muse 첫 테스트 초안은 잘못된 릴리스 변수명, OAuth 동작 순서 및 URL 가정 때문에 Codex 직접 검토에서 반려. 원본 미반영. 수정 요청 후 실제 __QR_CHECK_RELEASE__ 계약, connect → create 흐름으로 재작성했다.
- 재현 명령: `node --experimental-vm-modules --test --test-reporter=spec installer/tests/maker-release-gate.test.mjs`, 격리 사본 modellgihjt-muse-3kSBQ9/work, 변경 전 제품 소스. 결과 5 tests, 1 pass(정상 대조군), 4 fail(실제 gis=1, 기대0), exit1. import 실패가 아니라 릴리스 차단 누락을 확인했다. Node VM 실험 기능 경고는 존재한다.
- zero-files 테스트의 OAuth>=1 기대는 요구와 상충하여 OAuth0/fetch0/snapshot없음으로 수정하도록 별도로 지적했다. 제품 수정 허용은 maker.js 릴리스 차단에 한정했다.
- Python 환경 검사: bundled Python은 pytest 없음으로 실패; 설치된 Python312의 `python -m pytest -q`는 tests/test_sync_client.py 수집 중 requests 없음으로 실패. 의존성 설치/변경은 수행하지 않았다. Python PASS 아님.
- Unit2는 별도 격리 사본에서 Google mutation 재시도/응답 유실/Drive PATCH/모호한 자원 선택의 테스트만 작성하도록 위임했다. Unit1과 쓰기 대상이 다르며 원본 저장소를 쓰는 Muse 작업자는 없다. 외부 Muse 최대 2개, 내부 재위임 없음.

### 인계서 11개 항목의 현재 직접 검토 분류

| 번호 | 분류·현재 근거 | 최소 조치와 검증 |
|---|---|---|
| 1 | A maker.js readRelease의 DOM 우선/maker-1 fallback, readRuntimeFiles의 단순 비어있음 검사. B source placeholder는 의도적 | 실제 빌드 메타데이터/필수 파일로 실행 차단; 실제 boot 회귀 재현 완료, 수정 검증 대기 |
| 2 | A boot의 install=null, safeResumeSnapshot은 표시/복사만. 실제 복원 입력 없음 | 비밀값 없는 수동 snapshot 입력, 재인증 및 실자원 대조 뒤 복원. 복원 전 쓰기 금지. 아직 미구현 |
| 3 | A rest.call 모든 메서드 재시도, find* 첫 후보 선택, createScriptProject 조회/설치 식별자 없음 | mutation 결과 불명 차단, 모호 후보 거부, 재개 시 대조; 단순 클릭 재시도 안전하다고 주장하지 않음 |
| 4 | A makerAvailability client/GIS만 검사, bind에서 async single-flight 없음. verifiedEmail 실제 Drive about 대조는 D | busy 및 단계/계정 guard, 재시도 잠금; 중복 클릭/계정 변경 회귀 필요 |
| 5 | A checkSchoolVerified setup_completed만 보고 VERIFIED, completionAvailability state만 봄 | 초기 설정 확인과 실제 record/attachment 검증을 분리. 수동 체크를 자동 검증으로 취급하지 않음 |
| 6 | A schoolName/adminEmail은 입력 존재 확인·폴더 이름 외 실제 초기 설정 전달 없음. 독립 script의 sheet ID 바인딩 UI 누락 | 소유자 초기 설정 입력/학교 sheet ID 연결 안내, 다른 관리자 이메일 차단. setup Key 비저장, 이후 동결 바인딩 검증 필요 |
| 7 | A Drive :move 계약 오류, 실제 grantedScopes 미확인. D script create/upload/version/deployment REST 경로 존재 및 entryPoints 웹앱 URL 사용. B API/OAuth 승인 필요, C live 미실행 | PATCH 및 승인 scope 확인, 실제 API 응답/소유자/URL 점검. 필요 없는 범위 확대 금지 |
| 8 | D verifyAdmin_/requireAdmin_의 빈·미등록 신원 거부, QR 검증 및 첨부 제한 존재. B 소유자1명 제한 승인, C 실제 계정 미검증 | 기존 권한 검사 보존, 신규 초기 설정 소유자 제한 및 binding 사전 변경 문제 추가 회귀 필요 |
| 9 | D build-site의 file bytes/hash 및 source_dirty=false 검사. A manifest가 지정한 파일만 검사하여 필수18/중복/불필요 파일 및 실제 커밋 대응 완전 검증 부족. public 묶음은 일부 공용 코드가 제외된 관리자 함수를 참조하므로 독립 배포 가능성 미검증 | public 묶음을 독립 사용 가능하다고 주장하지 않음. 실제 installer는 admin 전체 사용. 필수파일/중복/소스 일치 회귀 및 clean 빌드 필요 |
| 10 | D update 기존 deploymentID 사용·previous_version 반환·rollback 기존 버전 참조. A applyUpdate URL 불일치를 url_kept=false로 반환하지만 차단/복구 안 함. C live/운영 UI 미완성 | 기본 설치 뒤 별도 업데이트 검증. 백업·ID/URL 확인 없이 운영 완료 판정 금지 |
| 11 | A maker HTML footer의 실제 Google 연결/배포 미연결 고정 문구, releaseNoteText 문자열만 검사. D 4개 UI 단계는 실제10 상태의 파생 표시 | 준비·진행 상태에 따라 정직한 문구, 디자인 유지. 미게시/연결/실패 브라우저 검사 필요 |

표는 읽은 코드에 근거한 경로 검토이지 전체 보안 감사 완료 또는 모든 회귀 재현 완료가 아니다. 완료되지 않은 수정·실측은 남은 출시 차단 사항이다.

## 8. 지정 Go 경로 재승인 후 재개 (2026-09-08 22:44 KST 이후)

- 무료 경로만 허용한 최신 AGENTS와 이전 Go 실행의 불일치를 발견하여 진행 중 작업을 중단했다. 무료 doctor는 model_unavailable이었다. 사용자가 이후 `opencode-go/muse-spark-1.3-contributor`를 명시해 해당 경로 재개를 승인했다. 전역 설정/AGENTS/동의/결제 설정은 바꾸지 않았다.
- 재연결: 임시 xhigh runner의 `smoke --model opencode-go/muse-spark-1.3-contributor --allow-paid`를 실행. 2026-09-08T13:44:48.850Z~13:44:56.358Z, MUSE_SMOKE_OK, exit0, session ses_f7ebc52c3ffely6TTeZCTGhAHZ. 로컬 실행 DB assistant metadata는 정확히 opencode-go/muse-spark-1.3-contributor/xhigh, finish=stop. 증거: modellgihjt-muse-86XTQL/receipt.json. 공급자 내부 독립 증명은 아님.
- 재개 시작 변경: maker/maker.js(릴리스 게이트), tests/maker-release-gate.test.mjs, 이 보고서와 계획 문서. 모두 보존. HEAD 6e3a2b00e3eb34f24888205ef3f7aad1904d9292, work/school-owned-web 유지.
- Unit1: Muse 작성 릴리스 게이트를 직접 검토/통합했다. 미게시·잘못된 버전/커밋/날짜·필수18 파일 누락/중복/추가·실행 manifest 오류를 OAuth/생성 전에 거부한다. DOM 입력으로 버전 덮어쓰기 및 maker-1 fallback 제거. focused maker 39개 통과(이전 진행 단계). 런타임 진위의 암호학적 증명이나 실제 설치 성공을 의미하지 않는다.
- Unit2: Muse 작성 rest.mjs/resources.mjs/google-write-safety.test.mjs를 해시로 원본 변경 여부 대조 후 apply_patch로 반영했다. 생성/업데이트 네트워크·429/5xx는 자동 재시도 없이 OUTCOME_UNKNOWN. GET만 제한 재시도. Drive 이동은 부모 GET 후 PATCH. 동일 이름 복수/미소유/불완전 페이지 거부, 응답 ID/버전/웹앱 주소 검증. 원문 오류 detail 미보관. 현재 이름 기반 재사용은 완전한 설치 식별 증명이 아니다.
- Unit2 재현: 변경 전 계층에서 최초5개 실패(이전 단계); 마지막 보강 전 사본에서 새4개 실패/기존5개 통과; 최종 사본9/9 통과. 소스/테스트 전체 직접 검토, 실행 metadata xhigh/stop 대조. 최종 Muse 사본 modellgihjt-muse-Jq0olp. HTTP500/응답 유실은 합성 fetch로 주입했다.
- 원본 통합 검사: `node --experimental-vm-modules --test --test-reporter=spec installer/tests/*.test.mjs installer/src/install/*.test.mjs installer/src/update/*.test.mjs tests/gas/*.test.mjs` → 194 tests, 42 suites, pass194/fail0, exit0. HEAD는 그대로이고 위 변경은 dirty. VM Modules 실험 경고가 존재한다. 로컬/mock이며 live 아님.
- Python 후속 정정: 이전 단계에서 requests 의존성을 작업용 임시 python-deps에만 설치했다. 전역/프로젝트 의존성 파일 변경 없음. 기본 pytest 임시 경로 정리 권한 오류가 있었지만, 별도 pytest-isolated-01 경로와 해당 PYTHONPATH로 `python -m pytest -q --basetemp <작업임시경로>/pytest-isolated-01` 재실행은 16 passed, exit0. 이전 수집 실패 기록을 삭제하지 않는다.
- 중간 UI 검사 흐름: 각 화면 진입 → 실제 화면/컨트롤 표시 → 체험 등록·필터·상세·확인/CSV, 도움말 검색, 탭/메뉴, 미준비/미게시 상태. Browser plugin not available(해당 browser skill 없음)이므로 기존 Playwright 스크립트를 현재 작업 임시 폴더에 복사하여 실행했다.
- UI 대상: D:/opencode/QR-check/installer, 임시 서버 http://127.0.0.1:56310(검사 종료 후 닫힘). 6화면×320/390/768/1440 =24 레이아웃 검사 통과, 390/1440에서 11개 상호작용 묶음 통과. pageerror0. console warning/error 전체 수집은 이 기존 스크립트의 검사 범위에 없으므로 console 전체 무오류라고 주장하지 않는다. GIS 요청은 빈 응답으로 대체했다. 실제 Google 로그인/설치·Android/iPhone 스캔 미검증.
- UI 증거: C:/Users/h19h2/AppData/Local/Temp/qr-owner-pilot-0dfd6c2d7c134d4093156fd7adb7bb79/browser-results/report.json 및 390/1440 스크린샷12장. 중간 결과이며 이후 UI 변경 시 재검사한다.
- Unit3(single-flight/결과불명 재시도 차단) 및 실제 OAuth 승인 scope 검사는 격리 Muse 작업 중. 아직 이 항목의 제품 수정이 통합되지는 않았다. 재개/초기설정 바인딩/완료 의미/빌드 강화/외부 승인은 여전히 남았다. 로컬 준비 완료 판정 아님.

### MUSE_BLOCKED — 공급자 요청 제한으로 중단

- Unit3 테스트 작성은 정상 종료(모델 ses_f7ebbae51ffej695lS5tK2cg32, modellgihjt-muse-HhWxEd). 직접 읽고 갱신된 REST 사본으로 실행: 13 tests 중 기존7 통과/신규6 실패. 실제 중복 클릭3회 쓰기, 계정 확인 이전 이동, 결과불명 이동 누락, pending marker 누락을 재현했다. 원본에는 새6 테스트를 아직 반영하지 않았다.
- OAuth tests-only는 정상 종료(모델 ses_f7eb9bcb8ffeNOoKdwMLOl4mRt, modellgihjt-muse-5EuGtF). 직접 검토 후 실제 google-auth 실행3개 모두 기대대로 실패: 부분 승인 수락, 초기 grantedScopes가 요청값, 실패 후 이전 토큰 유지. 원본 미반영.
- Unit3 구현 호출 실패: 2026-09-08T13:51:34.854Z~13:52:51.983Z, exit1, `Error from provider (Console Go): Upstream request failed: [rate_limit_exceeded] Rate limit exceeded. Please retry after a brief wait.`
- 요청 경로/옵션: `opencode run --pure --model opencode-go/muse-spark-1.3-contributor --variant xhigh --agent modellgihjt-muse --format json`, controller-green.txt 지시. 실행 사본 modellgihjt-muse-KuuC4u, session ses_f7eb61ef8ffeJwpaWxk71JwgM0, receipt status failed_or_incomplete, changes=[]; 정상 최종 응답 없음. 공급자 요청 제한은 확정이며 순간 제한/일일 한도/구독 소진 세부 원인은 확인되지 않았다.
- 사용자 실패 시 중단 조건에 따라 자동 재시도/모델 대체 없이 중단했다. auth-green 취소를 요청할 때는 이미 정상 종료한 결과가 반환되었다(13:53:34.735Z, modellgihjt-muse-hOZ1G1, ses_f7eb71557ffeGiC6JM2mRJaRJb). 해당 산출물은 아직 직접 diff 검토/테스트/모델 metadata 대조를 하지 않았으므로 원본 미반영·미승인으로 보존한다. 관련 실행 프로세스는 남아 있지 않다.
- 원본 반영 상태: maker/maker.js(이전 단위), src/google/rest.mjs/resources.mjs, tests/maker-release-gate.test.mjs, tests/google-write-safety.test.mjs, 두 실행 문서. 기타 기존 변경 보존. 커밋/푸시/Google 설정/자원 생성/배포 없음.
- 중단 직전 검증: 통합194/194, 사이트 unpublished 22파일 빌드 exit0, 중간 UI24+11 통과, git diff --check exit0(LF→CRLF 알림 있음). pending/concurrency/권한 grant/재개/초기 설정 바인딩/운영 시험/clean 정식 릴리스 준비는 미완료.
- 재개 지점: 사용자가 요청 제한 해소 후 동일 경로 재개를 지시하면 합성 연결 검사 → controller-green 단위 재실행(보존된 red tests/지시 사용) → 보존된 auth-green 결과 직접 검토/검증(재작성부터 시작하지 않음) 순서. auth 별칭 scope URL 추가가 현재 build-site 허용 목록과 맞는지도 대조한다. 이후 새로고침 재개·초기 설정·완료 의미·빌드 강화 등 남은 계획 계속. 아직 실사용 가능 판정이 아니다.

## 9. 사용자 재시도 승인 후 (2026-09-08 23:05 KST)

- 사용자 “다시 시도해봐 가끔 끊겨”에 따라 재시도했다. 기존 변경을 보존했고 전역 설정 변경/모델 대체는 없다. 공급자 동시 부하를 줄이기 위해 이번에는 외부 Muse를 한 번에 하나만 실행한다.
- 연결 검사: 2026-09-08T14:05:29.946Z~14:05:35.977Z, MUSE_SMOKE_OK, exit0, modellgihjt-muse-hYkPME, ses_f7ea960f9ffeRfaXVl6vEzZPMm. 읽기 전용 OpenCode metadata의 provider/model/variant = opencode-go/muse-spark-1.3-contributor/xhigh, finish=stop. 공급자 내부 독립 증명은 아니다.
- controller-green 지시를 보존된 red 테스트 사본에서 다시 실행했다. 격리 사본 modellgihjt-muse-b3XXq2에서 정상 종료했고, 아래와 같이 검토 후 통합했다.
- 보존된 auth-green(hOZ1G1) 제품/테스트 diff 직접 검토 및 metadata 대조 완료(xhigh, stop). 실제 auth 회귀 테스트4/4 pass, 이전 auth 소스 사본에서는 동일4개 모두 fail. 부분/누락 승인 거부, 실패 후 토큰 폐기, 실제 granted scope 반환, email/profile 별칭 대조를 확인했다. 모두 synthetic GIS이며 live 아님.
- 중간 검사에서 auth source가 build-site.scanText의 userinfo.email URL 허용 목록 누락으로 거부되었다(exit1). 당시 통합을 보류했으며, 아래 후속 수정으로 두 공식 scope 식별자만 좁게 허용한 뒤 통합했다.
- 문서 정정: OAUTH_SCOPE_MATRIX.md에서 Drive PATCH 및 versions.create=script.projects, 현재 spreadsheets scope, 원문 오류 대신 비밀값 제거 기록으로 수정. AUTH_DEPLOYMENT_ADR.md에 실제 verifyAdmin_ 호출/빈 신원 거부, 초기 설정의 남은 결함 및 소유자1명 지원 범위를 추가했다. 제품 코드 수정이나 live 검증 완료를 뜻하지 않는다.

### 이번 재시도에서 통합한 단위

- controller-green 정상 응답: 14:05:59.047Z~14:12:19.236Z, ses_f7ea8eeb3ffeguZEanJMK8DHGT, b3XXq2. 직접 전체 diff/테스트 검토, 13/13 focused 통과, metadata 정확한 Go Muse/xhigh/stop 확인. 클릭 핸들러 single-flight, 계정/소유자1명 검사, 설치 prefix 고정, 결과불명 operation_pending 차단, 확정 Sheet/Script/버전 재사용을 통합했다. 표시 상태만 바꾸어 완료시키지 않는다.
- 기존 upload 재개 검사는 분류 없는 오류를 무조건 재시도하는 과거 가정 때문에9/10이었다. 실제 FORBIDDEN403의 확정 실패와 미분류 결과불명을 구분하도록 Muse에 수정 요청했다. 같은 script 재사용/성공 검증은 유지하고, 결과불명 재시도0회 및 원문 cause/detail 비노출 검사를 추가했다. fPfDg4(14:14:46.827Z~14:16:35.252Z, ses_f7ea0e258ffezLW22Zp59ntbxe) 전체 diff 검토 후14/14 통과. 보강 전 소스의 새 오류원문 검사에서 실제1개 실패를 확인했다.
- auth-grant(hOZ1G1) 및 auth-build-compat(DeyTFh,14:13:00.979Z~14:14:13.955Z,ses_f7ea27da5ffePr15Y2CyXUdO3j) 통합. 실제 부여 scope만 메모리에서 관리하고 누락/거부/실패 시 토큰과 grant를 비운다. build-site는 두 공식 userinfo scope 식별자만 추가 허용한다. 임의 URL/비밀값 검사는 유지. 빌드 호환성 회귀는 이전 builder1fail/2pass, 수정후3pass. 각 실행 metadata Go Muse/xhigh/stop 대조 완료.
- 최초 통합209개 중208pass/1fail: 실제 안전 snapshot 콜백 이름 onProgress가 기존 fake-progress 정적 검사에 걸렸다. Muse의 KrOlWn(14:18:06.028Z~14:19:02.093Z,ses_f7e9dd780ffeW9UQzIJnIePdHx)에서 onSnapshot/notifySnapshot으로만 변경했다. Codex가 원본 문자열 치환 결과와 Muse 산출물의 완전 일치를 검증해 그 외 동작 변경이 없음을 확인했다. 정적 검사를 느슨하게 바꾸지 않았다.
- 모든 제품/테스트 변경은 위 Muse 산출물에서만 가져왔다. Codex는 원본 SHA 대조, 실제 diff/호출부 검토, apply_patch 기계적 적용, 로컬 검사 및 문서 정정을 담당했다. 패치 전달 출력 한도 오류1회는 적용 전 거부되어 파일 변경 없이 끝났고, 파일별 적용으로 해결했다. 모델 실패와 구분한다.

### 최종 로컬 검사 (23:19 KST 이후, 현재 dirty 작업 트리)

| 검사 | 명령/대상 | 결과 |
|---|---|---|
| Node 통합 | `node --experimental-vm-modules --test --test-reporter=spec installer/tests/*.test.mjs installer/src/install/*.test.mjs installer/src/update/*.test.mjs tests/gas/*.test.mjs` | 209 tests /44 suites, pass209/fail0, exit0. VM Modules 실험 경고 있음 |
| Python | admin-desktop에서 임시 python-deps PYTHONPATH와 `python -m pytest -q --basetemp <작업임시경로>/pytest-isolated-02` | 16 passed, exit0, 0.88s. 전역 의존성 수정 없음 |
| 정적 사이트 | `node tools/build-site.mjs --out <작업임시경로>/site-unpublished-03` | exit0,22파일,unpublished,runtime0. 정식 릴리스 아님 |
| 공백 검사 | `git diff --check` | exit0. LF→CRLF 알림은 있음 |

최종 브라우저 재검사도 exit0: 현재 installer 소스의 6화면×320/390/768/1440 =24 레이아웃 및 11개 상호작용 묶음 통과, pageerror 0. 임시 서버 http://127.0.0.1:56879는 검사 종료 후 닫혔다. Browser plugin not available로 기존 Playwright 검사를 사용했다. GIS는 빈 응답으로 대체했고 console warning/error 전체는 수집하지 않았으므로 실제 Google 연결 또는 콘솔 전체 무오류를 뜻하지 않는다. 최종 maker-390 스크린샷을 직접 확인했으며 미준비 안내와 실행 버튼 차단이 표시된다.

최종 화면 증거: `C:/Users/h19h2/AppData/Local/Temp/qr-owner-pilot-0dfd6c2d7c134d4093156fd7adb7bb79/validation-2319/browser-results/report.json` 및 같은 폴더의 390/1440 스크린샷12장. 모바일 실기기 검증은 아니다.

### 남은 범위와 재개 순서

이번 단위는 중복 실행/결과불명 안전성과 OAuth grant 검증까지다. **로컬 준비 전체 완료 / 테스트 학교 실연동 완료 / 시범운영 가능 / 일반 공개 가능 중 어느 판정도 아직 아니다.**

1. 안전한 새로고침/브라우저 재실행 복원: 현재 snapshot은 복사 표시이고 자동 복원 기능은 없다. 재인증·실제 계정/자원/릴리스 대조 없이 입력 snapshot을 신뢰하지 않는다. 결과불명 마커를 사용자 클릭만으로 해제하지 않는다.
2. 신규 학교 초기 설정: standalone Script의 Sheet ID 바인딩 UI와 서버 검증, 최초 관리자 서버 소유자 일치, 바인딩을 lock/권한검사 전에 쓰는 경로 보완. 초기 키/QR/토큰 영구 저장 금지.
3. 설치 완료 의미: setup_completed/VERIFIED와 실제 QR 제출·Sheet/관리자/비공개 첨부 대조를 분리. 반복 연결검사 idempotence와 안내 문구 보완.
4. API 추가 계약: resources.toGasFile은 HTML 이름의 .html을 유지하지만 [공식 File 계약](https://developers.google.com/apps-script/api/reference/rest/v1/File)은 확장자를 name에서 제외한다(2026-09-08 조회). SubmitView가 include_('Client.js')를 호출하는 점과 함께 수정/회귀 필요. uploadRuntime의 실제 응답 shape 대조도 남아 있다.
5. build-site 필수18/중복/추가 파일 및 source 커밋 일치 검증 강화, 공개 묶음 독립성 검토, 검토된 clean 커밋 기반 정식 런타임/사이트 빌드. 현재 dirty를 숨기거나 임의 published 값으로 채우지 않았다.
6. 실제 설정/외부 승인: OAuth client ID 공란, source release unpublished 유지. Google 계정/Cloud API/동의화면/origin/새 시험 자원·비용·복구 범위를 승인받기 전 외부 쓰기 금지. 신규 Google 설치/배포/QR/첨부/기기/업데이트/rollback은 이번 실행 미검증.

현재 HEAD는 6e3a2b00e3eb34f24888205ef3f7aad1904d9292 그대로. 커밋/푸시/Google 변경/배포 없음. 기존 디자인 파일/site.css/tokens.css, 기존 Apps Script 원본은 이번 단위에서 수정하지 않았다. 무단 되돌리기/삭제 없음.

## 10. 2026-09-09 지정 Muse/xhigh 후속 실행

- 사용자 지정 경로 유지: opencode-go/muse-spark-1.3-contributor, 매 호출 --variant xhigh, 격리 작업공간 한 명씩. 기존 dirty 변경 보존. 전역 설정/결제/인증/모델 변경 없음.
- Smoke X5HUaF: 2026-09-08T15:47:46.660Z~15:47:52.342Z, ses_f7e4bba92ffew1EXM83DYNNTw4, exit0. OpenCode assistant metadata exact Go Muse/xhigh/stop 확인. 로컬 metadata 증거이며 공급자 내부 독립 증명 아님.
- 업로드 테스트 작성 KNnHKJ: ses_f7e4b179affeVkxNAGyxH7IiBF, 정상 종료. 공개 resources/rest 소스와 합성 fetch만 전달. 신규 runtime-upload-contract.test.mjs 전체 직접 검토 후 기존 제품에서 14개 중1pass/13fail로 HTML 확장자 오류 및 검증 누락 재현.
- 업로드 구현 Me056e: ses_f7e47faecffekyyFy2IEyaAP1T, 15:51:52.510Z~15:52:54.303Z, metadata exact Go Muse/xhigh/stop. resources.mjs만 수정: 마지막 .html 제거(Client.js 유지), updateContent 응답의 scriptId와 순서 무관 name/type/source 전체 일치 검사. 누락/중복/추가/불일치 응답은 비밀값 없는 OUTCOME_UNKNOWN, 단일 PUT 유지. 정상 서버 metadata는 허용한다.
- Codex가 원본 SHA(07a2dea...)를 대조하고 전체 diff 및 실제 설치/업데이트 호출부 검토 후 Muse 산출물만 apply_patch로 반영. 변경 전 사본은 KNnHKJ/work에 보존. focused14/14 및 원본 통합223/223(44 suites) 통과, VM Modules 실험 경고 있음. 새 테스트의 입력 검증은 범위 밖이며 업로드 전 전체 필수파일 검사는 기존 maker 게이트가 담당한다.
- 공식 근거(2026-09-09): [File.name 계약](https://developers.google.com/apps-script/api/reference/rest/v1/File), [updateContent 응답](https://developers.google.com/apps-script/api/reference/rest/v1/projects/updateContent). 실제 Google 업로드 성공 검증 아님.
- 중간 빌드: tools/build-site.mjs --out <작업임시경로>/site-unpublished-20260909-01 → exit0, unpublished22파일/runtime0. Python: 임시 python-deps PYTHONPATH + pytest --basetemp <작업임시경로>/pytest-20260909-01 →16passed/0.63s. 정식 릴리스나 Google 연결 증거 아님.
- 이어서 초기 설정의 소유자/Sheet 바인딩 선검증 테스트 작성 중. 이 시점에는 Apps Script 원본 미수정. 안전 복원·완료 의미·초기 설정 UI·clean 릴리스 및 live 검증은 아직 남아 있다.

### MUSE_BLOCKED — 초기 설정 구현의 정상 응답 미완료

- 초기 설정 tests-only vcCqqB는 정상 종료: ses_f7e45159bffeObMhZ5ivyNXc1F, metadata exact Go Muse/xhigh/stop. 새 setup-binding-safety.test.mjs 전체 직접 검토 후 실제 Api/Auth/Config/Sheets 등의 VM 실행에서17개 중3pass/14fail. 빈/다른 신원·입력 불일치·타 학교 소유·lock 실패·잘못된 입력에도 binding/seed 변경이 일어나는 결함을 재현했다. 테스트는 격리 사본에만 있으며 원본 미반영. 테스트의 null-owner fixture는 getOwner가 null인 경우가 아니라 getEmail이 null인 경우이므로 추가 보강 필요. bound-read 실패 검사도 다른 ID 교체 요청과 결합되어 있어 순수 read 실패 검사를 별도로 보강할 필요가 있다.
- 구현 호출: `opencode run --pure --model opencode-go/muse-spark-1.3-contributor --variant xhigh --agent modellgihjt-muse --format json` (검토된 setup-binding-green.txt 지시와 명시적 공개 파일 사본). 2026-09-08T15:59:11.053Z~16:03:42.111Z (KST 09-09 00:59~01:03), 격리 3gdvTF, ses_f7e414a10ffesAzHbVPqyH3lgm.
- OpenCode 자식 exit0이나 최종 텍스트가 없고 정상 stop이 없어 runner exit1/status failed_or_incomplete. 오류: `Muse did not return a complete successful response.` error.txt는 빈 파일. 읽기 전용 DB metadata에서 assistant7개 모두 opencode-go/muse-spark-1.3-contributor/xhigh, 마지막 finish=length 확인. changes=[]로 제품/테스트 파일 생성·수정 없음. 공급자 내부 독립 증명은 아니다.
- 확정: 정상 완료 응답이 아닌 length 종료. 추정: 출력/생성 한도에 걸렸을 가능성이 있으나 구체적인 한도·공급자 내부 원인은 확인되지 않았다. 이번 실패를 네트워크 끊김·사용량 소진·결제 오류로 단정하지 않는다. 자동 재시도/다른 모델 대체 없이 중단했다. 실행 프로세스 종료 결과를 받았다.
- 중단 시 원본 변경: 이번 추가 제품 수정은 installer/src/google/resources.mjs, 신규 installer/tests/runtime-upload-contract.test.mjs 및 실행 보고서/계획뿐이다. 그 외 기존 dirty 변경 전부 보존. Apps Script 원본, 디자인, auth 설정, 전역 AGENTS, Git HEAD는 이번 단위에서 변경하지 않았다. 커밋/푸시/Google 변경/배포 없음.
- 동시 진행한 로컬 브라우저 검사는 이미 정상 종료: http://127.0.0.1:50236 (서버 종료됨), 6화면×320/390/768/1440 24레이아웃 및11상호작용 통과, pageerror0. Browser plugin not available로 기존 Playwright 스크립트 사용. GIS 대체, console 전체 미수집, 모바일 실기기/Google live 미검증. 증거: <작업임시경로>/validation-20260909-01/browser-results/report.json 및390/1440 스크린샷12장. 화면 관련 제품 수정은 없었다.
- 재개 방법: 사용자가 동일 경로 재시도를 지시하면 연결 검사 후 초기 설정 구현을 더 작은 단위(기존 binding 교체/lock 순서부터)로 분리해 재실행한다. 성공한 테스트 사본 vcCqqB/work와 원본 SHA를 재사용하고, 완성되지 않은 구현을 성공 결과로 취급하지 않는다. 초기 설정/안전 복원/완료 의미/clean 릴리스/live 운영은 여전히 미완료다.

## 11. 2026-09-09 08:06 KST 재시도 — 작은 단위의 초기 설정 보완

사용자가 동일 Muse 계속 진행을 승인했다. 경로/추론은 opencode-go/muse-spark-1.3-contributor / xhigh 유지. 공개 소스·합성 입력만 격리 공간에 전달, 외부 작성자는 한 명씩. 모든 아래 실행은 정상 stop 및 정확한 provider/model/variant를 로컬 DB에서 대조했다(공급자 내부 독립 증명 아님). 전역 설정·결제·인증 변경 없음.

| 실행 사본 | 담당 단위 | 직접 검사 |
|---|---|---|
| jCXgvA | 실제 smoke | MUSE_SMOKE_OK, exit0, 23:06:39Z~23:06:44Z |
| 4qjAdJ | Api 잠금 선행·기존 binding 교체 거부 | 기존 실패3개 재실행0/3 → 정상 대조군 포함6/6 |
| 7iWOmF | Auth 최초 키 검증에 서버 active/effective/입력 관리자 일치 추가 | 관련9/9. 기존 관리자 인증·Desktop 경로는 유지 |
| 94H7gq | 명시적 신규 Sheet 읽기·Drive 소유자 검증 후 binding | 15/17, 입력 선검증2개는 다음 단위 |
| 7icdWd | 학교/관리자/장소 입력 검사 선행 | 17/17 |
| JXNo2C | 순수 일시 읽기 실패·이미 초기화된 Sheet 채택 거부 테스트, null-owner 스텁 정정 | 새2개 실제 실패, null-owner 대조군 통과 |
| cxCUZD | peek 읽기 실패 차단·초기화된 Sheet 채택 거부 | 19/19 |
| Iu6Fgb | container binding 저장 실패 회귀 | 새1개 실제 실패, 성공으로 진행하는 결함 재현 |
| cLQNYm | binding 저장 실패를 전파하고 초기 저장은 seed 전에 수행 | 20/20, 원본 통합243/243 |
| JLys2n | 실제 WebApp inline JS의 Sheet ID 전달 테스트 | 빈 ID 검사 실제 실패, 다른 검사는 VM 배열 realm 비교 오류 발견 |
| tlQMDw | WebApp Sheet ID 입력/전달 및 소유자·키 발급 안내 | 제품 diff 전체 직접 검토 |
| 1STb7S | 테스트 Array.from 정규화 한 줄만 수정 | 수정 테스트를 이전 HTML에서2/2 실패 재현 후 새 HTML에서2/2 통과 |

실행 receipt 및 변경 전·후 사본은 `C:/Users/h19h2/AppData/Local/Temp/modellgihjt-muse-<사본명>/`에 보존. Codex는 각 diff 및 테스트를 직접 읽고 원본 SHA를 대조한 후 Muse 산출물만 apply_patch로 적용했다. 원본 Apps Script 최초 SHA: Api17debca..., Auth40b6ba..., WebAppa78df739... . 기존 사용자 dirty 변경을 덮어쓰거나 되돌리지 않았다.

이번 추가 변경 파일: apps-script/Api.gs, apps-script/Auth.gs, apps-script/WebApp.html, tests/gas/setup-binding-safety.test.mjs, tests/gas/setup-ui-binding.test.mjs 및 실행 문서. Styles.html/site.css/tokens.css는 변경하지 않았다. 초기 설정 Sheet ID는 비밀키가 아닌 자원 식별자이며, 브라우저 입력만으로 권한을 부여하지 않는다. 신규 standalone Sheet 연결은 서버 소유자/접근 검증을 거친다. 초기 키/QR/토큰을 재개 목적으로 저장하지 않았다.

최신 중간 검증: 원본 dirty 작업 트리 Node245 tests/46 suites, pass245/fail0; Python16passed/0.79s (임시 python-deps와 pytest-20260909-08 경로); build-site의 site-unpublished-20260909-08 출력은 unpublished22파일/runtime0, exit0. 아직 clean 정식 릴리스가 아니다. Google 실계정/배포/QR/첨부 검증은 하지 않았다.

남은 중요 범위: 안전한 snapshot 복원, 완료 의미/운영 시험 구분, 초기 설정의 중복 요청·응답 유실에 대한 재실행 의미, 설치센터 안내 일치, build-site 전체 필수파일/커밋 대조와 clean 릴리스, 실제 Google/실기기 검증. 승인 후 초기 설정 도중 실제 Google 쓰기가 부분 성공할 수 있으며 이번 변경은 분산 트랜잭션이나 자동 rollback이 아니다. setup 권한 검사 외 전체 런타임 보안감사 완료를 의미하지 않는다. 로컬 준비 전체 완료·실사용 가능 판정은 아직 아니다.

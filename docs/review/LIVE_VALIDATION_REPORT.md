# Live Validation Report — Gmail 테스트 프로젝트

> 계획·단위 테스트·HTTP 200만으로 live PASS를 만들지 않는다. 실행하지 못한 항목은 `NOT_TESTED`, 도구나 권한 조건 때문에 중단된 항목은 `BLOCKED`로 남긴다.

## 환경과 기준점

- 테스트 일자: 2026-09-08 (KST)
- 계정 유형: Gmail 개인 테스트 소유자 1개
- 브랜치: `work/school-owned-web`
- 코드 기준: `5f4df10` (`fix(live): restore admin records and harden exec URL`)
- Apps Script: 기존 테스트 Script/Sheet, 단일 public+admin 배포
- 활성 배포: 기존 deployment ID 끝자리 `-deMQgC9`, version `11`
- 안전한 실행 표식: `app_version=0.1.0`, `build_id=qrcheck-20260908-admin-ui`
- 브라우저: Codex IAB, Chrome 확장 세션, Google Sheets UI
- 실기기: 사용하지 않음

식별자는 문서에서 최소화한다. Script ID 끝자리 `QfvFxd`, Spreadsheet ID 끝자리 `tx4E`가 이번 승인된 테스트 대상이다. QR 토큰·clasp OAuth 토큰·관리자 토큰은 기록하지 않는다.

## 로컬 검증

| 항목 | 결과 | 근거 |
|---|---|---|
| Apps Script/클라이언트 | PASS | `node --test tests/gas/*.test.mjs` → 43/43 |
| Windows 관리자 | PASS | 임시 의존성 경로에서 `pytest` → 16/16 |
| 전체 | PASS | 59/59 |
| 런타임 빌드 | PASS | public 12파일, admin 18파일 |
| 비밀 패턴 검사 | PASS | Apps Script/테스트 0건 |
| Muse 독립 리뷰 | PASS | Date 직렬화 방향 확인, invalid Date 격리 보강 후 재시험 |

## 확인된 원인

1. 관리자 템플릿이 JSON 문자열을 일반 출력 `<?= ... ?>`으로 한 번 더 이스케이프해, 실행 시 `window.__EXEC_URL__` 값 양끝에 실제 따옴표가 남았다. 브라우저는 이 값을 iframe 기준 상대 URL처럼 해석해 `n-*.script.googleusercontent.com/%22https...%22` 형태를 만들었다.
2. `n-*.script.googleusercontent.com` 자체는 HTML Service iframe의 정상 내부 주소다. 이 호스트가 보인다는 사실만으로 구버전·캐시라고 판단한 기존 설명은 틀렸다.
3. 관리자 제출 목록은 Sheets의 `Date` 객체를 그대로 `google.script.run` 응답에 포함해 `null` 응답이 되었고, 클라이언트가 `data.rooms`를 읽다 중단됐다. UI 경계에서 Date를 KST 문자열로 재귀 변환해 해결했다.
4. 자동화 브라우저에서는 Apps Script 상단 경고를 닫기 전 iframe 초기화가 지연됐다. 경고를 닫은 뒤 제출 항목과 담당자 목록이 정상 로드됐다. 이는 주소가 구버전이라는 증거가 아니다.

## 배포 증거

| 단계 | 결과 | 근거 |
|---|---|---|
| 원격 백업/비교 | PASS | 원격 HEAD 18파일과 로컬 SHA-256 불일치 0 |
| 업로드 | PASS | 승인된 Script에 18파일 업로드 |
| 고정 버전 | PASS | immutable version 11 생성, 로컬과 불일치 0 |
| 기존 deployment 갱신 | PASS | 새 deployment를 만들지 않고 동일 ID를 v10→v11로 갱신 |
| health | PASS | 기존 `/exec?page=health`가 안전한 5개 필드와 v11 build 표식만 반환 |
| 복구 가능성 | PASS | 고정 v10·v11과 원격 백업 보존. 실제 rollback 실행은 `NOT_TESTED` |

## 실제 테스트 결과

| ID | 테스트 | 결과 | 증거/한계 |
|---|---|---|---|
| A1 | 관리자 열기/복사 주소 일치 | PASS | 3개 장소의 링크와 복사 값이 동일한 canonical `script.google.com/macros/s/.../exec`, `roomId`·`submitToken` 포함, 값 양끝 따옴표 없음 |
| A2 | QR 출력물 실제 디코딩 | NOT_TESTED | 데스크톱 QR 빌더 단위 테스트는 PASS. 실제 출력 QR 스캔은 미실시 |
| B | 다른 브라우저에서 점검 화면 | PASS | IAB·Chrome 별도 세션에서 행정실 제목, 담당자/당직자, 5개 항목 로드. 로그인/오류 화면을 성공으로 세지 않음 |
| C1 | 정상 점검 제출 | PASS | 합성 담당자, 5개 `이상 무`, 고유 합성 비고로 제출 완료 및 `COMMITTED` 확인 |
| C2 | 실제 Sheet 동일 기록 | PASS | 제출 완료 `record_id`와 `submissions!A2`, 합성 비고와 `K2`가 정확히 일치 |
| C3 | 관리자 동일 기록 | PASS | 2026-09-08 조회 1건, 상세의 `record_id`·비고·행정실·합성 담당자·`COMMITTED`가 제출/Sheet와 일치 |
| D1 | 이상 있음 + 합성 사진 UI 제출 | BLOCKED | IAB와 Chrome 모두 파일 chooser 이벤트가 열리지 않음. 합성 PNG는 생성했지만 업로드/제출하지 않음 |
| D2 | Drive 파일/관리자 첨부/비공개 | NOT_TESTED | D1이 완료되지 않아 live 증거 없음. 소스상 공개 공유 호출은 없지만 이를 live PASS로 확대하지 않음 |
| E | 동일 ID 재전송/충돌 | NOT_TESTED | 로컬 테스트는 멱등·충돌 모두 PASS, live 재전송은 미실시 |
| F | 이름 변경 QR 유지/명시적 재발급 | NOT_TESTED | 로컬 HMAC 테스트 PASS. 관리자 prompt 자동화가 열리지 않았고 Sheets API는 테스트 OAuth 프로젝트에서 비활성이라 live 변경을 강행하지 않음 |
| G1 | 등록 관리자 허용 | PASS | `google_only` 등록 소유자가 관리자 조회·상세 사용 |
| G2 | 미등록/빈 신원 거부 | NOT_TESTED | 로컬 테스트 PASS. 별도 미등록 Google 계정 live 세션 없음 |
| H | 업데이트 후 주소·QR·기록 유지 | PASS | 동일 deployment ID로 v8→v9→v10→v11, 기존 행정실 링크로 제출 성공, 토큰 재발급 없음, v11 뒤 기존 기록 관리자 조회 성공 |
| I | 설치센터 독립성 | NOT_TESTED | 런타임에 중앙 DB/설치센터 호출 없음은 정적 확인. 실제 차단·권한 철회 시험은 미실시 |
| M | 실제 휴대폰 | NOT_TESTED | 브라우저 테스트만 수행 |
| W | 교육기관 Workspace | NOT_TESTED | Gmail 테스트 결과를 Workspace 전체로 확대하지 않음 |

## 테스트 데이터 변경

- `settings_people`에 전역 합성 담당자·당직자 2행 추가
- `submissions`에 정상 합성 점검 1행 추가
- QR 토큰은 재발급하지 않음
- 장소 이름/공유 권한/Drive 권한은 변경하지 않음
- 합성 PNG는 로컬에만 생성됐고 Google에 업로드되지 않음

## OpenCode/Muse 실행 기록

요청 모델은 매번 `opencode/muse-spark-1.3-contributor-free`로 고정했다. wrapper receipt의 `liveProviderAttested`는 `false`이므로 provider 내부 모델을 별도 증명했다고 확대하지 않는다.

| 작업 | 모드 | 입력 범위 | 변경/검사 |
|---|---|---|---|
| URL 흐름 원인 조사 | review | 공개 URL 관련 파일 | 변경 없음, unsafe iframe fallback 지적 |
| AdminView force-print 수정 | build | 격리 복사본 1파일 | `<?=`→`<?!=`, 원본 반영 전 Codex diff 검토 |
| 제출 bootstrap 조사 | review | 공개 제출 파일 | 변경 없음, 초기화 전 실패 가설 정리 |
| 제출 초기화 오류 노출 | build | 격리 복사본 2파일 | Client/SubmitView 수정, Codex 테스트 후 반영 |
| Date 직렬화 독립 리뷰 | review | Api + 합성 테스트 | 변경/테스트 없음, invalid Date 위험 지적 및 Codex 보강 |

## 남은 가장 작은 사용자 작업

Chrome에서 `chrome://extensions` → ChatGPT 브라우저 확장 `세부정보` → **파일 URL에 대한 액세스 허용**을 켠 뒤 알려준다. 그러면 D1/D2만 이어서 실행할 수 있다.

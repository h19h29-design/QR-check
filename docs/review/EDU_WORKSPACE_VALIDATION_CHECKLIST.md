# EDU_WORKSPACE_VALIDATION_CHECKLIST — 교육기관 Workspace 대비 (2026-09-08)

상태: **Workspace = NOT_TESTED** (Gmail 개인계정 live도 아직 미실시. 교육기관 계정 미확보).
Gmail 검증 성공을 Workspace 검증 성공으로 보고하지 않는다. 우회 방법을 만들지 않는다.

## 사전 확인 (기관 전산담당자 + 테스트 계정 필요)

- [ ] 외부 OAuth 앱 허용 여부 (차단 시 설치센터 승인 불가 → 기관 승인 요청으로 종료, 우회 금지)
- [ ] Apps Script API 접근 허용 여부 (사용자 설정 + 조직 정책)
- [ ] Apps Script 실행·신규 프로젝트 생성 허용 여부
- [ ] 웹앱 공개 배포(ANYONE_ANONYMOUS) 허용 여부 — 점검자 무로그인 제출의 전제
- [ ] Drive API / Sheets API 허용 여부
- [ ] `userinfo.email` 반환 정책 (관리자 식별의 전제)

## 계정 유형별 검증 매트릭스

| 항목 | Gmail | Workspace(기관 허용) | Workspace(기관 차단) |
|---|---|---|---|
| 설치센터 OAuth·자원 생성 | live 예정 | NOT_TESTED | 차단 안내로 종료 |
| 학교 앱 자체 승인 | live 예정 | NOT_TESTED | — |
| 익명 QR 제출 | live 예정 | NOT_TESTED | 구조상 불가, 안내 |
| 관리자 Google 인증 | live 예정 | NOT_TESTED | — |
| 설치센터 철회 후 독립 운영 | live 예정 | NOT_TESTED | — |

## 차단 시 안내 원칙

- 개인 Gmail로 업무 자료를 우회하라고 안내하지 않는다.
- 차단 사유·요청 대상(기관 전산담당자)·필요 허용 항목을 한글로 안내한다.
- `안내형 설치` 표기를 사용하고 자동 설치 완료로 표시하지 않는다.

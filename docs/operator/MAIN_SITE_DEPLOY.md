# 메인 사이트 배포 절차

초기 문서 작성 모델: opencode/muse-spark-1.3-contributor-free (현재 운영 구성은 Codex가 대조)
대상: GitHub Pages, `h19h29-design/QR-check` 저장소의 `gh-pages` 브랜치, `qr-safe.h19h19.com`
주의: 이 문서는 절차만 정의하며 배포를 수행하지 않음

## 전제 조건

- 검토 완료된 clean 커밋
- 런타임 빌드 `dirty=false`
- 매니페스트/해시 검증 통과
- OAuth 클라이언트 ID와 허용 출처는 운영자가 별도 구성
- 공개 OAuth client ID만 포함하며 client secret·계정 토큰·학교 비밀은 포함하지 않음
- 출력 디렉터리는 비어 있는 새 디렉터리 사용

## 로컬 빌드와 미리보기

```sh
node tools/build-site.mjs --out <new-empty-output-dir>
```

위 명령은 미게시 화면 검사다. 설치 가능한 산출물은 clean 소스에서 런타임을 먼저 빌드하고 `node tools/build-site.mjs --runtime <verified-runtime-dir> --out <new-empty-output-dir>`로 만든다. `published`는 파일 패키징 상태이지 신규 학교 설치 검증 성공을 의미하지 않는다.

```sh
python3 -m http.server 57917 --directory <new-empty-output-dir>
```

또는 동등한 정적 서버로 다음을 확인한다:

- `http://127.0.0.1:57917/`
- `http://127.0.0.1:57917/demo`
- `http://127.0.0.1:57917/update`

## 산출물 기대값

- 정적 파일 25개(개인정보처리방침 포함), 호스팅 전용 `CNAME`·`.nojekyll`은 별도
- 발행용 런타임 데이터는 런타임 매니페스트가 제공된 경우에만 포함
- 미발행 빌드(`runtime_file_count 0`, `status unpublished`)는 로컬 임시 산출물이며 릴리스로 취급하지 않음
- `dirty true` 런타임은 발행 금지
- 런타임 매니페스트가 제공되면 build-site가 매니페스트/해시/dirty 상태를 검증함

## 배포 전 점검표

- [ ] clean 커밋 확인
- [ ] `dirty=false` 런타임 확인
- [ ] 매니페스트/해시 검증 통과
- [ ] OAuth 클라이언트 ID와 허용 출처 구성 확인
- [ ] 실제 비밀 미포함 확인
- [ ] 25파일 산출물과 라우트 새로고침 동작 확인
- [ ] 보안/개인정보 스캔 완료

## 중첩 라우트 새로고침

- 정적 호스팅에서 중첩 경로 직접 접근과 새로고침이 정상 동작하도록 호스팅 측 폴백/리라이트 설정을 운영자가 확인한다
- 예: `/demo/`, `/maker/`, `/guide/`, `/help/`, `/update/`, `/privacy/`
- GitHub Pages 배포는 별도 `gh-pages` 체크아웃에 검증한 파일만 복사하고 `CNAME`과 `.nojekyll`을 보존한다. 소스 저장소 루트를 복사하지 않는다.

## 보안과 개인정보 검사

- 비밀 패턴 스캔에서 일치 항목이 없어야 함
- `.git`과 인증 파일이 업로드되지 않아야 함
- 실시간 사용자 데이터가 산출물에 포함되지 않아야 함

## 롤백

- 이전 정적 산출물을 보관하고 문제 발생 시 이전 산출물로 복원한다
- 실제 롤백 동작은 NOT_TESTED로 유지한다

## 금지 행위

- 저장소 루트 통째 업로드 금지
- `.git`/인증 파일 업로드 금지
- 실시간 데이터 포함 금지
- 학교 런타임 자동 가져오기 금지
- 승인 없는 push, clasp, DNS, OAuth 변경 금지

## 미발행 미리보기와 발행 릴리스 구분

- 미발행 미리보기: 로컬 검증용 임시 산출물
- 발행 릴리스: 전제 조건과 점검표를 모두 통과한 산출물만 해당
- 두 종류를 혼동하지 않는다

## 다음 운영자 조치

- 확정 호스트는 `https://qr-safe.h19h19.com`이다. 별도 지시 없이 DNS를 다시 쓰거나 학교 데이터·학교 스크립트를 덮어쓰지 않는다.

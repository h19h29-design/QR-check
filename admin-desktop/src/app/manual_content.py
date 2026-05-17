from __future__ import annotations

import re
from html import unescape


MANUAL_SECTIONS: list[tuple[str, str, str, str]] = [
    (
        "install",
        "1",
        "설치와 첫 실행",
        """
        <p>설치 EXE를 실행하면 설치 위치를 선택한 뒤 현재 사용자 권한으로 프로그램을 설치합니다. 설치가 끝나면 바탕화면과 시작 메뉴에 <b>QR보안점검표 관리자</b> 바로가기가 만들어집니다.</p>
        <figure>
          <img src="manual_installer_flow.png" alt="설치 흐름 그림">
          <figcaption>설치 흐름: 설치파일 실행 → 설치 위치 선택 → 바로가기 생성 → 프로그램 실행</figcaption>
        </figure>
        <ol>
          <li>설치파일을 실행하고 설치할 폴더를 선택합니다. 기본값은 현재 사용자 폴더의 QR보안점검표 폴더입니다.</li>
          <li>설치가 끝나면 바탕화면 바로가기로 프로그램을 실행합니다.</li>
          <li>왼쪽 메뉴에서 <b>설정</b>을 열고 학교명, 관리자 이메일, 저장 방식, 연결값을 입력합니다.</li>
          <li>운영 전에는 실 하나로 QR을 만들어 스마트폰 제출 테스트를 먼저 진행합니다.</li>
        </ol>
        """,
    ),
    (
        "storage",
        "2",
        "저장 방식 선택",
        """
        <p>이 프로그램은 기존 <b>Google Drive 방식</b>을 그대로 유지하면서 <b>Supabase 방식</b>을 추가로 선택할 수 있습니다. 두 방식 모두 관리자 PC의 SQLite는 캐시와 업무용 보관 DB로 사용합니다.</p>
        <figure>
          <img src="manual_storage_flow.png" alt="저장 방식 흐름 그림">
          <figcaption>점검자는 QR로 제출하고, 관리자는 나중에 서버 저장소와 동기화합니다.</figcaption>
        </figure>
        <ul>
          <li><b>Google Drive 방식</b>: 기존 Apps Script, Google Sheet, Google Drive 흐름입니다.</li>
          <li><b>Supabase 방식</b>: 학교별 Supabase 프로젝트를 원본 저장소로 사용하므로 학교 PC가 꺼져 있어도 제출을 받을 수 있습니다.</li>
          <li>설정 화면에서 저장 방식을 고르면 해당 방식에 필요한 입력칸만 활성화됩니다.</li>
        </ul>
        """,
    ),
    (
        "google",
        "3",
        "Google Drive 방식 설정",
        """
        <p>Google 방식은 Apps Script 웹앱이 제출 화면과 관리자 동기화 API 역할을 하고, 데이터는 학교 Google Sheet/Drive에 저장됩니다.</p>
        <ol>
          <li>학교 관리자 Google 계정으로 Google Sheet를 새로 만듭니다.</li>
          <li>Google Sheet에서 <b>확장 프로그램 &gt; Apps Script</b>를 엽니다.</li>
          <li>배포본의 <b>2_Google_AppsScript_Code</b> 폴더에 있는 파일을 Apps Script에 같은 이름으로 붙여 넣습니다.</li>
          <li><b>배포 &gt; 새 배포 &gt; 웹 앱</b>을 선택합니다.</li>
          <li>실행 사용자는 <b>나</b>, 액세스 권한은 QR 제출을 위해 <b>모든 사용자</b>로 설정합니다.</li>
          <li>배포 후 표시되는 <b>Web App URL</b>을 프로그램 설정 화면의 Apps Script URL에 넣습니다.</li>
          <li>Apps Script 편집기에서 <b>createInitialSetupKey</b> 함수를 실행해 초기 설정 키를 발급합니다.</li>
          <li>Web App URL 뒤에 <b>?page=setup</b>을 붙여 열고 학교명과 관리자 이메일을 입력합니다.</li>
          <li>화면에 표시되는 <b>Desktop Sync Key</b>를 프로그램 설정 화면에 입력한 뒤 연결 테스트를 실행합니다.</li>
        </ol>
        <div class="warn">Google Sheet/Drive를 “링크가 있는 모든 사용자 편집 가능”으로 공유하지 마세요. 공개 대상은 Sheet/Drive가 아니라 Apps Script 웹앱 URL입니다.</div>
        """,
    ),
    (
        "supabase",
        "4",
        "Supabase 방식 설정",
        """
        <p>Supabase 방식은 각 학교가 자기 Supabase 계정과 프로젝트를 만들어 독립 운영하는 방식입니다. 개발자 서버나 중앙 서버를 사용하지 않습니다.</p>
        <figure>
          <img src="manual_settings_modes.png" alt="설정 화면 예시 그림">
          <figcaption>Supabase 모드에서는 Supabase 주소, anon key, 학교 코드, 제출 페이지 주소를 입력합니다.</figcaption>
        </figure>
        <ol>
          <li><b>https://supabase.com</b>에 가입하고 <b>New project</b>를 만듭니다.</li>
          <li>프로젝트의 <b>SQL Editor</b>에서 배포본의 <b>setup_supabase.sql</b>을 실행합니다.</li>
          <li>필요하면 <b>seed_sample.sql</b>의 학교 코드, 학교명, Desktop Sync Key 값을 학교 값으로 바꿔 실행합니다.</li>
          <li><b>Project Settings &gt; API Keys</b> 또는 <b>Connect</b> 화면에서 <b>Project URL</b>을 복사합니다.</li>
          <li>같은 화면에서 <b>anon public key</b>를 복사합니다. <b>service_role key는 절대 입력하거나 공유하지 않습니다.</b></li>
          <li>배포본의 <b>7_Supabase_Submit_Page</b> 정적 제출 페이지를 학교가 선택한 정적 호스팅에 올립니다.</li>
          <li>정적 제출 페이지 주소를 프로그램 설정의 <b>Supabase 제출 페이지 주소</b>에 입력합니다.</li>
          <li><b>연결 테스트</b>와 <b>필수 테이블 확인</b>을 실행합니다.</li>
        </ol>
        """,
    ),
    (
        "master-data",
        "5",
        "실, 담당자, 점검항목 등록",
        """
        <ul>
          <li><b>실 관리</b>: 보안점검 대상 실을 등록합니다. 실을 추가하면 room_id와 제출 토큰이 생성됩니다.</li>
          <li><b>담당자/당직자 관리</b>: 담당자와 당직자를 등록합니다.</li>
          <li><b>점검항목 관리</b>: 문단속, 전등, 냉난방, 청소 상태 등 학교 기준에 맞는 항목을 등록합니다.</li>
          <li>정렬 순서는 10, 20, 30처럼 여유 있게 넣으면 중간 항목을 추가하기 쉽습니다.</li>
          <li>Google 방식은 변경 후 Google 업로드를 실행하고, Supabase 방식은 Supabase 동기화/업로드 흐름을 사용합니다.</li>
        </ul>
        """,
    ),
    (
        "qr",
        "6",
        "QR 생성과 부착",
        """
        <ol>
          <li><b>QR 생성</b> 메뉴를 엽니다.</li>
          <li>저장 방식에 따라 Google Apps Script 제출 URL 또는 Supabase 제출 페이지 URL이 자동으로 사용됩니다.</li>
          <li>QR에는 roomId와 submitToken이 들어갑니다. Supabase anon key는 QR URL에 넣지 않습니다.</li>
          <li><b>등록된 실 QR PNG와 A4 부착용 HTML 생성</b>을 누릅니다.</li>
          <li>생성된 QR을 출력해 각 실 출입문이나 점검 위치에 부착합니다.</li>
          <li>토큰이 노출되었다고 판단되면 토큰을 재발급하고 QR을 다시 출력합니다.</li>
        </ol>
        """,
    ),
    (
        "submit",
        "7",
        "점검 제출",
        """
        <ol>
          <li>점검자는 스마트폰으로 실별 QR을 스캔합니다.</li>
          <li>실명이 맞는지 확인합니다.</li>
          <li>담당자 또는 당직자를 선택합니다.</li>
          <li>기본값은 모두 <b>이상 무</b>입니다.</li>
          <li>문제가 있는 항목만 <b>이상 유</b>로 바꾸고 메모나 사진/PDF를 첨부합니다.</li>
          <li><b>최종 확인 및 전송</b>을 누릅니다.</li>
        </ol>
        """,
    ),
    (
        "records",
        "8",
        "기록 확인과 관리자 확인",
        """
        <ul>
          <li><b>점검기록</b> 메뉴에서 기간, 실, 상태를 선택해 조회합니다.</li>
          <li>행을 더블클릭하면 상세보기 창이 열립니다.</li>
          <li><b>이상 없음</b> 기록은 목록에서 일괄 확인할 수 있습니다.</li>
          <li><b>이상 있음</b> 기록은 상세 내용을 확인한 뒤 개별 확인합니다.</li>
          <li>Supabase 방식에서는 관리자 확인 이력이 audit_logs에 남도록 설계되어 있습니다.</li>
        </ul>
        """,
    ),
    (
        "backup",
        "9",
        "출력, 보관, 백업",
        """
        <ul>
          <li><b>출력/보관</b> 메뉴에서 날짜별, 기간별, 실별로 조회합니다.</li>
          <li><b>엑셀 출력</b>은 보관용 XLSX 파일을 만듭니다.</li>
          <li><b>HTML 인쇄 출력</b>은 브라우저에서 인쇄할 수 있는 파일을 만듭니다.</li>
          <li>Supabase 방식은 <b>백업 생성</b>으로 CSV/JSON 백업을 만들 수 있습니다.</li>
          <li>첨부파일 목록과 백업 결과는 백업 폴더의 metadata.json과 CSV 파일로 확인합니다.</li>
        </ul>
        """,
    ),
    (
        "update-security",
        "10",
        "업데이트와 보안",
        """
        <ul>
          <li>상단의 <b>업데이트 확인</b> 버튼은 추후 세르파 홈페이지 릴리즈 페이지와 연결할 수 있게 준비되어 있습니다.</li>
          <li>릴리즈 URL이 확정되면 배포 환경 변수 <b>QRSEC_UPDATE_URL</b> 또는 프로그램 상수에 주소를 넣어 배포합니다.</li>
          <li>Desktop Sync Key, Supabase anon key, QR submit token은 공개 문서나 메신저에 올리지 않습니다.</li>
          <li>Supabase service_role key는 프로그램, QR, 제출 페이지, 사용자 문서에 절대 넣지 않습니다.</li>
          <li>무료 배포용 설치파일은 코드서명 인증서가 없어서 Windows SmartScreen 경고가 나올 수 있습니다.</li>
        </ul>
        """,
    ),
]


def _build_manual_html() -> str:
    nav = "\n".join(
        f'<a class="toc-item" href="#{anchor}"><span>{number}</span>{title}</a>'
        for anchor, number, title, _ in MANUAL_SECTIONS
    )
    sections = "\n".join(
        f"""
        <section id="{anchor}">
          <h2><span>{number}</span>{title}</h2>
          {body}
          <p class="back"><a href="#top">맨 위로</a></p>
        </section>
        """
        for anchor, number, title, body in MANUAL_SECTIONS
    )
    return f"""
    <div id="top"></div>
    <h1>QR보안점검표 관리자 사용 매뉴얼</h1>
    <p class="lead">왼쪽 번호나 아래 목차를 누르면 해당 설명으로 바로 이동합니다. Google Drive 방식과 Supabase 방식 모두 같은 관리자 화면에서 사용할 수 있습니다.</p>
    <nav class="toc">{nav}</nav>
    {sections}
    """


MANUAL_HTML = _build_manual_html()


def manual_search_text() -> str:
    text = re.sub(r"<[^>]+>", " ", MANUAL_HTML)
    return " ".join(unescape(text).split())

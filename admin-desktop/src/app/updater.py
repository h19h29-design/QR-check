from __future__ import annotations

import os
import webbrowser


DEFAULT_RELEASE_PAGE_URL = ""
UPDATE_URL_ENV = "QRSEC_UPDATE_URL"


def resolve_update_url() -> str:
    return (os.environ.get(UPDATE_URL_ENV) or DEFAULT_RELEASE_PAGE_URL).strip()


def update_unconfigured_message() -> str:
    return (
        "업데이트 릴리즈 주소가 아직 설정되지 않았습니다.\n\n"
        "추후 세르파 홈페이지의 릴리즈 주소가 확정되면 "
        f"{UPDATE_URL_ENV} 환경 변수 또는 프로그램의 DEFAULT_RELEASE_PAGE_URL 값에 주소를 넣어 배포하세요."
    )


def open_update_page() -> bool:
    url = resolve_update_url()
    if not url:
        return False
    return bool(webbrowser.open(url))

from __future__ import annotations

from app.manual_content import MANUAL_HTML, manual_search_text


def test_manual_contains_setup_and_daily_workflow():
    text = manual_search_text()

    assert "Google 설정 순서" in MANUAL_HTML
    assert "QR 생성" in text
    assert "점검기록 조회" in text
    assert "출력/보관" in text
    assert "Desktop Sync Key" in text

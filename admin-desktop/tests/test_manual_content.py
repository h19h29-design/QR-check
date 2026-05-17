from __future__ import annotations

from app.manual_content import MANUAL_HTML, MANUAL_SECTIONS, manual_search_text


def test_manual_contains_numbered_html_sections_and_daily_workflow():
    text = manual_search_text()

    assert len(MANUAL_SECTIONS) >= 10
    assert 'href="#google"' in MANUAL_HTML
    assert 'id="supabase"' in MANUAL_HTML
    assert "Google Drive 방식 설정" in text
    assert "Supabase 방식 설정" in text
    assert "QR 생성과 부착" in text
    assert "기록 확인과 관리자 확인" in text
    assert "출력, 보관, 백업" in text
    assert "Desktop Sync Key" in text
    assert "릴리즈 URL" in text
    assert "manual_storage_flow.png" in MANUAL_HTML

from __future__ import annotations

from app.resources import resource_path
from app.updater import UPDATE_URL_ENV, resolve_update_url, update_unconfigured_message
from ui.main_window import server_badge_text


def test_required_visual_resources_exist():
    assert resource_path("app_icon.ico").exists()
    assert resource_path("manual/manual_storage_flow.png").exists()
    assert resource_path("manual/manual_settings_modes.png").exists()
    assert resource_path("manual/manual_installer_flow.png").exists()


def test_server_badge_uses_storage_neutral_wording():
    assert server_badge_text(False, "Google") == "서버연동 미설정"
    assert server_badge_text(True, "Supabase") == "서버연동 대기 (Supabase)"
    assert server_badge_text(True, "Supabase", "connected") == "서버연동 완료 (Supabase)"


def test_update_url_is_future_configurable(monkeypatch):
    monkeypatch.delenv(UPDATE_URL_ENV, raising=False)
    assert resolve_update_url() == ""
    assert "세르파" in update_unconfigured_message()

    monkeypatch.setenv(UPDATE_URL_ENV, "https://example.com/releases")
    assert resolve_update_url() == "https://example.com/releases"

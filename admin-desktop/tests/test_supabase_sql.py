from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_supabase_setup_contains_rls_rpc_and_no_service_role_key():
    sql = (ROOT / "supabase" / "setup_supabase.sql").read_text(encoding="utf-8").lower()

    assert "enable row level security" in sql
    assert "security definer" in sql
    assert "submit_check_record" in sql
    assert "desktop_pull" in sql
    assert "desktop_backup" in sql
    assert "service_role =" not in sql
    assert "service_role_key" not in sql


def test_supabase_submit_page_keeps_key_in_config_not_qr_url():
    html = (ROOT / "supabase-submit" / "index.html").read_text(encoding="utf-8")

    assert "config.js" in html
    assert "roomId" in html
    assert "submit_check_record" in html
    assert "service_role" not in html.lower()

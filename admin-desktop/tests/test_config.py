from __future__ import annotations

import json
import sys

from app.config import AppConfig, load_config, save_config
from app.security import DPAPI_PREFIX


def test_sync_key_round_trip_and_at_rest_protection(tmp_path):
    path = tmp_path / "local_settings.json"
    config = AppConfig(school_name="테스트학교", sync_key="sync-secret-value")

    save_config(config, path)
    raw = json.loads(path.read_text(encoding="utf-8"))
    loaded = load_config(path)

    assert loaded.sync_key == "sync-secret-value"
    if sys.platform == "win32":
        assert raw["sync_key"].startswith(DPAPI_PREFIX)
        assert "sync-secret-value" not in path.read_text(encoding="utf-8")
    else:
        assert raw["sync_key"] == "sync-secret-value"


def test_supabase_config_round_trip_and_anon_key_protection(tmp_path):
    path = tmp_path / "local_settings.json"
    config = AppConfig(
        storage_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon-secret-value-with-enough-length",
        supabase_org_code="school-2026",
        supabase_submit_url="https://submit.example.com",
    )

    save_config(config, path)
    raw = json.loads(path.read_text(encoding="utf-8"))
    loaded = load_config(path)

    assert loaded.normalized_storage_mode == "supabase"
    assert loaded.supabase_anon_key == "anon-secret-value-with-enough-length"
    assert loaded.supabase_org_code == "school-2026"
    if sys.platform == "win32":
        assert raw["supabase_anon_key"].startswith(DPAPI_PREFIX)
        assert "anon-secret-value-with-enough-length" not in path.read_text(encoding="utf-8")

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

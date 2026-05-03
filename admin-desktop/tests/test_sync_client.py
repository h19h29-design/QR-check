from __future__ import annotations

import json

from app.db import connect
from app.migrations import init_db
from app.sync_client import AppsScriptClient
from app.sync_client import sync_payload_to_db


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
        self.text = json.dumps(payload)

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_pull_injects_sync_key(monkeypatch):
    captured = {}

    def fake_post(url, data, headers, timeout):
        captured["body"] = json.loads(data)
        return FakeResponse({"ok": True, "data": {"submissions": []}})

    monkeypatch.setattr("requests.post", fake_post)
    client = AppsScriptClient("https://example.com/exec", "secret")
    result = client.pull("")
    assert result["submissions"] == []
    assert captured["body"]["payload"]["syncKey"] == "secret"


def test_health(monkeypatch):
    def fake_get(url, params, timeout):
        return FakeResponse({"ok": True})

    monkeypatch.setattr("requests.get", fake_get)
    assert AppsScriptClient("https://example.com").health()["ok"] is True


def test_sync_state_uses_server_next_since(tmp_path):
    db_path = tmp_path / "sync.sqlite3"
    init_db(db_path)
    with connect(db_path) as conn:
        sync_payload_to_db(conn, {"next_since": "2026-05-03T10:00:00+09:00", "submissions": []})
        row = conn.execute("SELECT value FROM sync_state WHERE key='last_sync_at'").fetchone()
    assert row["value"] == "2026-05-03T10:00:00+09:00"

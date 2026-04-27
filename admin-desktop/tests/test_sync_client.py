from __future__ import annotations

import json

from app.sync_client import AppsScriptClient


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


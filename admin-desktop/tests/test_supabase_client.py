from __future__ import annotations

import pytest

from app.config import AppConfig
from app.supabase_client import SupabaseClient, SupabaseClientError, normalize_supabase_url
from app.sync_client import create_storage_client, sync_state_key


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = "" if payload is None else str(payload)

    def json(self):
        return self.payload


def test_normalize_supabase_url_rejects_invalid_url():
    with pytest.raises(SupabaseClientError):
        normalize_supabase_url("not-a-url")


def test_schema_version_uses_rest_headers(monkeypatch):
    captured = {}

    def fake_request(method, url, params, json, headers, timeout):
        captured.update({"method": method, "url": url, "params": params, "headers": headers, "json": json})
        return FakeResponse([{"version": 1, "applied_at": "2026-05-16T00:00:00+09:00"}])

    monkeypatch.setattr("requests.request", fake_request)
    client = SupabaseClient("https://example.supabase.co", "x" * 40, "school")

    assert client.schema_version()["version"] == 1
    assert captured["method"] == "GET"
    assert captured["url"] == "https://example.supabase.co/rest/v1/schema_version"
    assert captured["headers"]["apikey"] == "x" * 40
    assert captured["headers"]["Authorization"] == f"Bearer {'x' * 40}"


def test_pull_calls_desktop_rpc_with_org_and_sync_key(monkeypatch):
    captured = {}

    def fake_request(method, url, params, json, headers, timeout):
        captured.update({"method": method, "url": url, "json": json})
        return FakeResponse({"submissions": [], "next_since": "2026-05-16T00:00:00+09:00"})

    monkeypatch.setattr("requests.request", fake_request)
    client = SupabaseClient("https://example.supabase.co", "x" * 40, "school", sync_key="desktop-secret")

    result = client.pull("2026-05-15T00:00:00+09:00")

    assert result["submissions"] == []
    assert captured["url"].endswith("/rest/v1/rpc/desktop_pull")
    assert captured["json"]["p_organization_code"] == "school"
    assert captured["json"]["p_desktop_sync_key"] == "desktop-secret"
    assert captured["json"]["p_since"] == "2026-05-15T00:00:00+09:00"


def test_create_storage_client_returns_supabase_client():
    config = AppConfig(
        storage_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="x" * 40,
        supabase_org_code="school",
        sync_key="desktop-secret",
    )
    client = create_storage_client(config)
    assert isinstance(client, SupabaseClient)
    assert sync_state_key(config.normalized_storage_mode) == "last_sync_at_supabase"

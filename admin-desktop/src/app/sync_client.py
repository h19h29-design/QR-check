from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import requests

from .config import STORAGE_MODE_SUPABASE
from .supabase_client import SupabaseClient


class SyncClientError(RuntimeError):
    pass


@dataclass(slots=True)
class AppsScriptClient:
    base_url: str
    sync_key: str = ""
    timeout: int = 30

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.sync_key:
            headers["X-Desktop-Sync-Key"] = self.sync_key
        return headers

    def health(self) -> dict[str, Any]:
        response = requests.get(self.base_url, params={"page": "health"}, timeout=self.timeout)
        response.raise_for_status()
        try:
            return response.json()
        except ValueError:
            return {"ok": True, "text": response.text}

    def post_action(self, action: str, payload: dict | None = None) -> dict[str, Any]:
        merged_payload = dict(payload or {})
        if self.sync_key and "syncKey" not in merged_payload and "sync_key" not in merged_payload:
            merged_payload["syncKey"] = self.sync_key
        body = {"action": action, "payload": merged_payload}
        response = requests.post(self.base_url, data=json.dumps(body, ensure_ascii=False), headers=self._headers(), timeout=self.timeout)
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            error = data.get("error") or {}
            raise SyncClientError(error.get("message") or error.get("code") or "Apps Script 요청 실패")
        return data.get("data") or {}

    def pull(self, since: str = "") -> dict[str, Any]:
        return self.post_action("desktop.syncPull", {"since": since})

    def push_settings(self, payload: dict) -> dict[str, Any]:
        return self.post_action("desktop.pushSettings", payload)

    def verify_record(self, record_id: str, admin_memo: str = "") -> dict[str, Any]:
        return self.post_action("desktop.verifyRecord", {"record_id": record_id, "admin_memo": admin_memo})

    def bulk_verify_normal(self, start_date: str, end_date: str | None = None, room_id: str = "") -> dict[str, Any]:
        return self.post_action(
            "desktop.bulkVerifyNormal",
            {"start_date": start_date, "end_date": end_date or start_date, "room_id": room_id},
        )


def sync_payload_to_db(conn, payload: dict, state_key: str = "last_sync_at") -> int:
    from .migrations import upsert_submission
    from .db import upsert_dict
    from .models import now_iso

    count = 0
    for row in payload.get("settings_school", []):
        upsert_dict(conn, "settings_school", {"key": row.get("key", ""), "value": row.get("value", ""), "updated_at": now_iso()}, ["key"])
    for row in payload.get("settings_admins", []):
        if row.get("admin_id"):
            upsert_dict(conn, "settings_admins", row, ["admin_id"])
    for row in payload.get("settings_rooms", []):
        if row.get("room_id"):
            upsert_dict(conn, "settings_rooms", row, ["room_id"])
    for row in payload.get("settings_people", []):
        if row.get("person_id"):
            upsert_dict(conn, "settings_people", row, ["person_id"])
    for row in payload.get("settings_check_items", []):
        if row.get("item_id"):
            upsert_dict(conn, "settings_check_items", row, ["item_id"])
    for row in payload.get("submissions", []):
        upsert_submission(conn, row)
        count += 1
    for row in payload.get("attachments", []):
        if row.get("attachment_id"):
            data = dict(row)
            data.setdefault("local_path", "")
            upsert_dict(conn, "attachments", data, ["attachment_id"])
    next_since = payload.get("next_since") or payload.get("server_time") or now_iso()
    upsert_dict(conn, "sync_state", {"key": state_key, "value": next_since, "updated_at": now_iso()}, ["key"])
    return count


def sync_payload_to_db_with_state(conn, payload: dict, state_key: str = "last_sync_at") -> int:
    return sync_payload_to_db(conn, payload, state_key=state_key)


def sync_state_key(storage_mode: str) -> str:
    return "last_sync_at_supabase" if storage_mode == STORAGE_MODE_SUPABASE else "last_sync_at"


def provider_label(storage_mode: str) -> str:
    return "Supabase" if storage_mode == STORAGE_MODE_SUPABASE else "Google"


def create_storage_client(config, timeout: int = 30):
    if config.normalized_storage_mode == STORAGE_MODE_SUPABASE:
        return SupabaseClient(
            config.supabase_url,
            config.supabase_anon_key,
            config.supabase_org_code,
            sync_key=config.sync_key,
            admin_email=config.admin_email,
            timeout=timeout,
        )
    return AppsScriptClient(config.apps_script_url, config.sync_key, timeout=timeout)


def is_storage_configured(config) -> bool:
    if config.normalized_storage_mode == STORAGE_MODE_SUPABASE:
        return bool(config.supabase_url and config.supabase_anon_key and config.supabase_org_code and config.sync_key)
    return bool(config.apps_script_url and config.sync_key)

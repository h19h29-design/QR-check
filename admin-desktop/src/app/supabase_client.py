from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests


class SupabaseClientError(RuntimeError):
    pass


def normalize_supabase_url(value: str) -> str:
    url = (value or "").strip().rstrip("/")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise SupabaseClientError("Supabase 주소는 https://... 형식이어야 합니다.")
    return url


def validate_anon_key(value: str) -> str:
    key = (value or "").strip()
    if not key:
        raise SupabaseClientError("Supabase anon public key가 비어 있습니다.")
    # Supabase anon keys are JWT-like strings in hosted projects. Local/dev keys can
    # vary, so keep this as a guardrail instead of a hard JWT parser.
    if len(key) < 20:
        raise SupabaseClientError("Supabase anon public key가 너무 짧습니다.")
    return key


@dataclass(slots=True)
class SupabaseClient:
    supabase_url: str
    anon_key: str
    organization_code: str
    sync_key: str = ""
    admin_email: str = ""
    timeout: int = 30

    def __post_init__(self) -> None:
        self.supabase_url = normalize_supabase_url(self.supabase_url)
        self.anon_key = validate_anon_key(self.anon_key)
        self.organization_code = (self.organization_code or "").strip()
        if not self.organization_code:
            raise SupabaseClientError("학교 코드(organization_code)가 비어 있습니다.")

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"

    def _headers(self, prefer: str | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def _request(self, method: str, path: str, *, params: dict[str, str] | None = None, json_body: dict | None = None) -> Any:
        response = requests.request(
            method,
            f"{self.rest_url}/{path.lstrip('/')}",
            params=params,
            json=json_body,
            headers=self._headers(),
            timeout=self.timeout,
        )
        if not response.ok:
            raise SupabaseClientError(self._error_message(response))
        if response.status_code == 204 or not response.text:
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise SupabaseClientError("Supabase 응답을 JSON으로 읽을 수 없습니다.") from exc

    def _rpc(self, name: str, payload: dict[str, Any] | None = None) -> Any:
        return self._request("POST", f"rpc/{name}", json_body=payload or {})

    def _desktop_payload(self, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.sync_key:
            raise SupabaseClientError("Supabase 모드에서 Desktop Sync Key가 비어 있습니다.")
        payload = {
            "p_organization_code": self.organization_code,
            "p_desktop_sync_key": self.sync_key,
        }
        payload.update(extra or {})
        return payload

    def schema_version(self) -> dict[str, Any]:
        data = self._request(
            "GET",
            "schema_version",
            params={"select": "version,applied_at", "order": "applied_at.desc", "limit": "1"},
        )
        if isinstance(data, list) and data:
            return data[0]
        raise SupabaseClientError("schema_version 테이블을 찾을 수 없습니다. setup_supabase.sql을 먼저 실행하세요.")

    def health(self) -> dict[str, Any]:
        schema = self.schema_version()
        result: dict[str, Any] = {"ok": True, "schema_version": schema}
        if self.sync_key:
            result["desktop"] = self._rpc("desktop_health", self._desktop_payload())
        return result

    def pull(self, since: str = "") -> dict[str, Any]:
        return self._rpc("desktop_pull", self._desktop_payload({"p_since": since or ""}))

    def push_settings(self, payload: dict) -> dict[str, Any]:
        return self._rpc(
            "desktop_push_settings",
            self._desktop_payload(
                {
                    "p_rooms": payload.get("rooms", []),
                    "p_people": payload.get("people", []),
                    "p_items": payload.get("items", []),
                    "p_base_since": payload.get("base_since") or payload.get("baseSince") or "",
                    "p_force": bool(payload.get("force")),
                }
            ),
        )

    def verify_record(self, record_id: str, admin_memo: str = "") -> dict[str, Any]:
        return self._rpc(
            "desktop_verify_record",
            self._desktop_payload(
                {
                    "p_record_id": record_id,
                    "p_admin_email": self.admin_email or "desktop",
                    "p_admin_memo": admin_memo or "",
                }
            ),
        )

    def bulk_verify_normal(self, start_date: str, end_date: str | None = None, room_id: str = "") -> dict[str, Any]:
        return self._rpc(
            "desktop_bulk_verify_normal",
            self._desktop_payload(
                {
                    "p_start_date": start_date,
                    "p_end_date": end_date or start_date,
                    "p_room_id": room_id or "",
                    "p_admin_email": self.admin_email or "desktop",
                }
            ),
        )

    def backup(self) -> dict[str, Any]:
        return self._rpc("desktop_backup", self._desktop_payload())

    @staticmethod
    def _error_message(response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return f"Supabase 요청 실패: HTTP {response.status_code} {response.text[:300]}"
        if isinstance(payload, dict):
            message = payload.get("message") or payload.get("error") or payload.get("hint") or str(payload)
            details = payload.get("details") or payload.get("hint")
            if details and details != message:
                return f"{message} ({details})"
            return str(message)
        return f"Supabase 요청 실패: HTTP {response.status_code}"

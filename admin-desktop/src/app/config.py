from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

from .security import protect_local_secret, unprotect_local_secret


APP_NAME = "QR보안점검표 관리자"
APP_CODE = "qr-security-admin"
STORAGE_MODE_GOOGLE = "google"
STORAGE_MODE_SUPABASE = "supabase"
STORAGE_MODES = {STORAGE_MODE_GOOGLE, STORAGE_MODE_SUPABASE}


def default_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    if base:
        return Path(base) / APP_CODE
    return Path.home() / f".{APP_CODE}"


@dataclass(slots=True)
class AppConfig:
    school_name: str = ""
    admin_email: str = ""
    storage_mode: str = STORAGE_MODE_GOOGLE
    apps_script_url: str = ""
    sync_key: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_org_code: str = ""
    supabase_submit_url: str = ""
    sync_interval_minutes: int = 5
    data_dir: str = ""
    qr_output_dir: str = ""
    export_output_dir: str = ""

    @property
    def resolved_data_dir(self) -> Path:
        return Path(self.data_dir) if self.data_dir else default_data_dir()

    @property
    def db_path(self) -> Path:
        return self.resolved_data_dir / "qr_security_admin.sqlite3"

    @property
    def qr_dir(self) -> Path:
        return Path(self.qr_output_dir) if self.qr_output_dir else self.resolved_data_dir / "qrcodes"

    @property
    def export_dir(self) -> Path:
        return Path(self.export_output_dir) if self.export_output_dir else self.resolved_data_dir / "exports"

    @property
    def normalized_storage_mode(self) -> str:
        mode = (self.storage_mode or STORAGE_MODE_GOOGLE).strip().lower()
        return mode if mode in STORAGE_MODES else STORAGE_MODE_GOOGLE


def config_path(data_dir: Path | None = None) -> Path:
    root = data_dir or default_data_dir()
    return root / "local_settings.json"


def load_config(path: Path | None = None) -> AppConfig:
    target = path or config_path()
    if not target.exists():
        return AppConfig()
    data = json.loads(target.read_text(encoding="utf-8"))
    if "sync_key" in data:
        data["sync_key"] = unprotect_local_secret(str(data.get("sync_key") or ""))
    if "supabase_anon_key" in data:
        data["supabase_anon_key"] = unprotect_local_secret(str(data.get("supabase_anon_key") or ""))
    if str(data.get("storage_mode") or "").strip().lower() not in STORAGE_MODES:
        data["storage_mode"] = STORAGE_MODE_GOOGLE
    return AppConfig(**{k: v for k, v in data.items() if k in AppConfig.__dataclass_fields__})


def save_config(config: AppConfig, path: Path | None = None) -> Path:
    target = path or config_path(config.resolved_data_dir)
    target.parent.mkdir(parents=True, exist_ok=True)
    data = asdict(config)
    data["storage_mode"] = config.normalized_storage_mode
    data["sync_key"] = protect_local_secret(config.sync_key)
    data["supabase_anon_key"] = protect_local_secret(config.supabase_anon_key)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return target

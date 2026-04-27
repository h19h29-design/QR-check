from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path


APP_NAME = "QR보안점검표 관리자"
APP_CODE = "qr-security-admin"


def default_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    if base:
        return Path(base) / APP_CODE
    return Path.home() / f".{APP_CODE}"


@dataclass(slots=True)
class AppConfig:
    school_name: str = ""
    admin_email: str = ""
    apps_script_url: str = ""
    sync_key: str = ""
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


def config_path(data_dir: Path | None = None) -> Path:
    root = data_dir or default_data_dir()
    return root / "local_settings.json"


def load_config(path: Path | None = None) -> AppConfig:
    target = path or config_path()
    if not target.exists():
        return AppConfig()
    data = json.loads(target.read_text(encoding="utf-8"))
    return AppConfig(**{k: v for k, v in data.items() if k in AppConfig.__dataclass_fields__})


def save_config(config: AppConfig, path: Path | None = None) -> Path:
    target = path or config_path(config.resolved_data_dir)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(asdict(config), ensure_ascii=False, indent=2), encoding="utf-8")
    return target

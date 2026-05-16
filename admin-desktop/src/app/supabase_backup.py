from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping


BACKUP_TABLES = [
    "settings_school",
    "settings_rooms",
    "settings_people",
    "settings_check_items",
    "submissions",
    "check_record_items",
    "attachments",
    "admin_verifications",
    "audit_logs",
]


def create_supabase_backup(client, output_root: str | Path) -> Path:
    root = Path(output_root)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = root / f"supabase_backup_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)

    payload = client.backup()
    metadata = {
        "created_at": datetime.now().astimezone().replace(microsecond=0).isoformat(),
        "organization_code": getattr(client, "organization_code", ""),
        "source": "supabase",
        "tables": BACKUP_TABLES,
    }
    (backup_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    (backup_dir / "full_backup.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    for table in BACKUP_TABLES:
        rows = payload.get(table, [])
        if isinstance(rows, list):
            _write_csv(backup_dir / f"{table}.csv", rows)
        else:
            _write_csv(backup_dir / f"{table}.csv", [])

    files_dir = backup_dir / "files"
    files_dir.mkdir(exist_ok=True)
    (files_dir / "README.txt").write_text(
        "Supabase Storage 파일 본문은 1차 백업에서 자동 다운로드하지 않습니다.\n"
        "attachments.csv의 storage_path를 기준으로 Supabase Dashboard 또는 향후 파일 백업 기능에서 내려받으세요.\n",
        encoding="utf-8",
    )
    return backup_dir


def _write_csv(path: Path, rows: list[Mapping[str, Any]]) -> None:
    fieldnames = sorted({key for row in rows if isinstance(row, Mapping) for key in row.keys()})
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: _csv_value(row.get(key)) for key in fieldnames})


def _csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)

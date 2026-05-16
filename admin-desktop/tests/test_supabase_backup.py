from __future__ import annotations

import json

from app.supabase_backup import create_supabase_backup


class FakeSupabaseClient:
    organization_code = "school-2026"

    def backup(self):
        return {
            "settings_rooms": [{"room_id": "room_1", "room_name": "교무실"}],
            "submissions": [{"record_id": "rec_1", "room_name": "교무실", "abnormal": False}],
            "attachments": [{"attachment_id": "att_1", "storage_path": "school/rec/file.pdf"}],
            "audit_logs": [{"action": "desktop_backup"}],
        }


def test_create_supabase_backup_writes_json_and_csv(tmp_path):
    backup_dir = create_supabase_backup(FakeSupabaseClient(), tmp_path)

    assert backup_dir.exists()
    metadata = json.loads((backup_dir / "metadata.json").read_text(encoding="utf-8"))
    assert metadata["organization_code"] == "school-2026"
    assert (backup_dir / "full_backup.json").exists()
    assert "room_1" in (backup_dir / "settings_rooms.csv").read_text(encoding="utf-8-sig")
    assert "storage_path" in (backup_dir / "attachments.csv").read_text(encoding="utf-8-sig")
    assert (backup_dir / "files" / "README.txt").exists()

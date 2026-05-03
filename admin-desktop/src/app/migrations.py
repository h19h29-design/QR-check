from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path

from .db import connect, upsert_dict
from .models import now_iso
from .security import generate_token, hash_token, protect_local_secret


SCHEMA_VERSION = 1


DEFAULT_ITEMS = [
    ("item_document", "document", "서류보관상태", 10),
    ("item_cleaning", "cleaning", "청소상태", 20),
    ("item_lighting", "lighting", "소등상태", 30),
    ("item_fire", "fire", "화기단속상태", 40),
    ("item_door", "door", "문단속상태", 50),
]


def init_db(db_path: str | Path) -> None:
    with connect(db_path) as conn:
        _create_schema(conn)
        _migrate_schema(conn)
        _set_schema_version(conn)
        seed_defaults(conn)


def _create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL,
            applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings_school (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings_admins (
            admin_id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'admin',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings_rooms (
            room_id TEXT PRIMARY KEY,
            room_name TEXT NOT NULL,
            room_order INTEGER NOT NULL DEFAULT 100,
            submit_token_hash TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS room_submit_tokens_local (
            room_id TEXT PRIMARY KEY,
            submit_token TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings_people (
            person_id TEXT PRIMARY KEY,
            person_name TEXT NOT NULL,
            role_type TEXT NOT NULL,
            room_id TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 100,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings_check_items (
            item_id TEXT PRIMARY KEY,
            item_key TEXT NOT NULL UNIQUE,
            item_name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 100,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS submissions (
            record_id TEXT PRIMARY KEY,
            submitted_at TEXT NOT NULL,
            inspection_date TEXT NOT NULL,
            room_id TEXT NOT NULL,
            room_name TEXT NOT NULL,
            person_id TEXT NOT NULL DEFAULT '',
            person_name TEXT NOT NULL DEFAULT '',
            role_type TEXT NOT NULL DEFAULT '',
            status_json TEXT NOT NULL DEFAULT '{}',
            abnormal INTEGER NOT NULL DEFAULT 0,
            remarks TEXT NOT NULL DEFAULT '',
            client_info TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT 'desktop',
            admin_verified INTEGER NOT NULL DEFAULT 0,
            admin_verified_by TEXT NOT NULL DEFAULT '',
            admin_verified_at TEXT NOT NULL DEFAULT '',
            admin_memo TEXT NOT NULL DEFAULT '',
            desktop_synced INTEGER NOT NULL DEFAULT 0,
            desktop_synced_at TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(inspection_date);
        CREATE INDEX IF NOT EXISTS idx_submissions_room ON submissions(room_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_flags ON submissions(abnormal, admin_verified);

        CREATE TABLE IF NOT EXISTS attachments (
            attachment_id TEXT PRIMARY KEY,
            record_id TEXT NOT NULL,
            item_key TEXT NOT NULL,
            file_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            drive_file_id TEXT NOT NULL DEFAULT '',
            drive_url TEXT NOT NULL DEFAULT '',
            local_path TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(record_id) REFERENCES submissions(record_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            log_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            detail_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS sync_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_logs (
            log_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            detail_json TEXT NOT NULL DEFAULT '{}'
        );
        """
    )


def _set_schema_version(conn: sqlite3.Connection) -> None:
    row = conn.execute("SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1").fetchone()
    if not row:
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, ?)", (SCHEMA_VERSION, now_iso()))
    elif int(row["version"]) < SCHEMA_VERSION:
        conn.execute("INSERT INTO schema_version(version, applied_at) VALUES (?, ?)", (SCHEMA_VERSION, now_iso()))


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """기존 학교 PC의 오래된 SQLite DB도 현재 앱에서 열 수 있게 부족한 컬럼을 보강한다."""
    expected = {
        "settings_school": {
            "updated_at": "TEXT NOT NULL DEFAULT ''",
        },
        "attachments": {
            "local_path": "TEXT NOT NULL DEFAULT ''",
        },
        "submissions": {
            "desktop_synced": "INTEGER NOT NULL DEFAULT 0",
            "desktop_synced_at": "TEXT NOT NULL DEFAULT ''",
            "admin_memo": "TEXT NOT NULL DEFAULT ''",
        },
    }
    for table, columns in expected.items():
        existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        for column, definition in columns.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def seed_defaults(conn: sqlite3.Connection) -> None:
    now = now_iso()
    for key, value in {
        "school_name": "",
        "timezone": "Asia/Seoul",
        "apps_script_version": "0.1.0",
        "drive_folder_id": "",
        "uploads_folder_id": "",
        "exports_folder_id": "",
    }.items():
        conn.execute(
            "INSERT OR IGNORE INTO settings_school(key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, now),
        )

    for item_id, item_key, item_name, order in DEFAULT_ITEMS:
        conn.execute(
            """
            INSERT OR IGNORE INTO settings_check_items(
                item_id, item_key, item_name, sort_order, active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (item_id, item_key, item_name, order, now, now),
        )


def add_room(conn: sqlite3.Connection, room_name: str, room_order: int = 100) -> tuple[str, str]:
    room_id = f"room_{uuid.uuid4().hex[:12]}"
    token = generate_token()
    now = now_iso()
    conn.execute(
        """
        INSERT INTO settings_rooms(room_id, room_name, room_order, submit_token_hash, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        """,
        (room_id, room_name, room_order, hash_token(token, room_id), now, now),
    )
    conn.execute(
        "INSERT INTO room_submit_tokens_local(room_id, submit_token, created_at) VALUES (?, ?, ?)",
        (room_id, protect_local_secret(token), now),
    )
    return room_id, token


def add_person(conn: sqlite3.Connection, person_name: str, role_type: str, room_id: str = "", sort_order: int = 100) -> str:
    person_id = f"person_{uuid.uuid4().hex[:12]}"
    now = now_iso()
    conn.execute(
        """
        INSERT INTO settings_people(person_id, person_name, role_type, room_id, active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        """,
        (person_id, person_name, role_type, room_id, sort_order, now, now),
    )
    return person_id


def upsert_submission(conn: sqlite3.Connection, submission: dict) -> None:
    now = now_iso()
    data = {
        "record_id": submission["record_id"],
        "submitted_at": submission.get("submitted_at", now),
        "inspection_date": submission.get("inspection_date", now[:10]),
        "room_id": submission.get("room_id", ""),
        "room_name": submission.get("room_name", ""),
        "person_id": submission.get("person_id", ""),
        "person_name": submission.get("person_name", ""),
        "role_type": submission.get("role_type", ""),
        "status_json": json.dumps(submission.get("status_json", {}), ensure_ascii=False)
        if not isinstance(submission.get("status_json"), str)
        else submission.get("status_json", "{}"),
        "abnormal": 1 if submission.get("abnormal") else 0,
        "remarks": submission.get("remarks", ""),
        "client_info": submission.get("client_info", ""),
        "source": submission.get("source", "google"),
        "admin_verified": 1 if submission.get("admin_verified") else 0,
        "admin_verified_by": submission.get("admin_verified_by", ""),
        "admin_verified_at": submission.get("admin_verified_at", ""),
        "admin_memo": submission.get("admin_memo", ""),
        "desktop_synced": 1,
        "desktop_synced_at": now,
        "created_at": submission.get("created_at", now),
        "updated_at": submission.get("updated_at", now),
    }
    upsert_dict(conn, "submissions", data, ["record_id"])


def log_event(conn: sqlite3.Connection, actor: str, action: str, target_type: str, target_id: str, detail: dict | None = None) -> None:
    conn.execute(
        """
        INSERT INTO audit_log(log_id, created_at, actor, action, target_type, target_id, detail_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (f"log_{uuid.uuid4().hex}", now_iso(), actor, action, target_type, target_id, json.dumps(detail or {}, ensure_ascii=False)),
    )

from __future__ import annotations

import json

from app.db import connect
from app.migrations import add_person, add_room, init_db, upsert_submission


def test_db_schema_and_defaults(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    init_db(db_path)
    with connect(db_path) as conn:
        version = conn.execute("SELECT version FROM schema_version").fetchone()
        items = conn.execute("SELECT COUNT(*) count FROM settings_check_items").fetchone()
    assert version["version"] == 1
    assert items["count"] >= 5


def test_room_person_and_duplicate_submission(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    init_db(db_path)
    with connect(db_path) as conn:
        room_id, token = add_room(conn, "행정실", 10)
        person_id = add_person(conn, "홍길동", "responsible", room_id)
        assert token
        assert person_id
        upsert_submission(
            conn,
            {
                "record_id": "rec_1",
                "submitted_at": "2026-04-26T09:00:00+09:00",
                "inspection_date": "2026-04-26",
                "room_id": room_id,
                "room_name": "행정실",
                "person_id": person_id,
                "person_name": "홍길동",
                "role_type": "responsible",
                "status_json": {"document": "이상 무"},
                "abnormal": False,
            },
        )
        upsert_submission(
            conn,
            {
                "record_id": "rec_1",
                "submitted_at": "2026-04-26T09:00:00+09:00",
                "inspection_date": "2026-04-26",
                "room_id": room_id,
                "room_name": "행정실",
                "person_id": person_id,
                "person_name": "홍길동",
                "role_type": "responsible",
                "status_json": {"document": "이상 유"},
                "abnormal": True,
            },
        )
        count = conn.execute("SELECT COUNT(*) count FROM submissions").fetchone()["count"]
        row = conn.execute("SELECT abnormal, status_json FROM submissions WHERE record_id='rec_1'").fetchone()
    assert count == 1
    assert row["abnormal"] == 1
    assert json.loads(row["status_json"])["document"] == "이상 유"


def test_bulk_verify_filter_policy(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    init_db(db_path)
    with connect(db_path) as conn:
        for record_id, abnormal in [("normal", False), ("bad", True)]:
            upsert_submission(
                conn,
                {
                    "record_id": record_id,
                    "inspection_date": "2026-04-26",
                    "room_id": "room",
                    "room_name": "실",
                    "abnormal": abnormal,
                },
            )
        conn.execute(
            """
            UPDATE submissions
            SET admin_verified=1
            WHERE inspection_date='2026-04-26' AND abnormal=0 AND admin_verified=0
            """
        )
        normal = conn.execute("SELECT admin_verified FROM submissions WHERE record_id='normal'").fetchone()
        bad = conn.execute("SELECT admin_verified FROM submissions WHERE record_id='bad'").fetchone()
    assert normal["admin_verified"] == 1
    assert bad["admin_verified"] == 0


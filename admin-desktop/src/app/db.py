from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable, Mapping, Sequence


def connect(db_path: str | Path) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]


def upsert_dict(conn: sqlite3.Connection, table: str, data: Mapping[str, object], key_columns: Sequence[str]) -> None:
    columns = list(data.keys())
    placeholders = ", ".join(["?"] * len(columns))
    update_columns = [c for c in columns if c not in key_columns]
    updates = ", ".join([f"{c}=excluded.{c}" for c in update_columns])
    sql = (
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT({', '.join(key_columns)}) DO UPDATE SET {updates}"
    )
    conn.execute(sql, [data[c] for c in columns])


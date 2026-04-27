from __future__ import annotations

import sqlite3
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    db_path = root / "legacy" / "original" / "inspections.db"
    print(f"DB: {db_path}")
    if not db_path.exists():
        print("DB not found")
        return
    conn = sqlite3.connect(db_path)
    for name, sql in conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"):
        print("\nTABLE", name)
        print(sql)
        count = conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        print("COUNT", count)
    conn.close()


if __name__ == "__main__":
    main()


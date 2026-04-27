from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


NORMAL = "이상 무"
ABNORMAL = "이상 유"


@dataclass(slots=True)
class Room:
    room_id: str
    room_name: str
    room_order: int = 100
    submit_token: str | None = None
    submit_token_hash: str | None = None
    active: bool = True


@dataclass(slots=True)
class Person:
    person_id: str
    person_name: str
    role_type: str
    room_id: str = ""
    active: bool = True
    sort_order: int = 100


@dataclass(slots=True)
class CheckItem:
    item_id: str
    item_key: str
    item_name: str
    sort_order: int = 100
    active: bool = True


@dataclass(slots=True)
class Submission:
    record_id: str
    submitted_at: str
    inspection_date: str
    room_id: str
    room_name: str
    person_id: str
    person_name: str
    role_type: str
    status_json: dict[str, Any] = field(default_factory=dict)
    abnormal: bool = False
    remarks: str = ""
    admin_verified: bool = False
    admin_verified_by: str = ""
    admin_verified_at: str = ""
    admin_memo: str = ""


def now_iso() -> str:
    return datetime.now().astimezone().replace(microsecond=0).isoformat()


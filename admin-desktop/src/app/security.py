from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import re
from pathlib import Path


def generate_token(num_bytes: int = 24) -> str:
    """URL에 넣기 쉬운 난수 토큰을 만든다."""
    return secrets.token_urlsafe(num_bytes)


def hash_token(token: str, salt: str = "") -> str:
    normalized = (token or "").strip()
    payload = f"{salt}:{normalized}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_token(token: str, expected_hash: str, salt: str = "") -> bool:
    return hmac.compare_digest(hash_token(token, salt), expected_hash or "")


def token_fingerprint(token: str) -> str:
    digest = hashlib.sha256((token or "").encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest[:6]).decode("ascii").rstrip("=")


def safe_filename(name: str, fallback: str = "file") -> str:
    stem = Path(name or fallback).name
    stem = re.sub(r"[^0-9A-Za-z가-힣._ -]+", "_", stem).strip(" .")
    return stem or fallback


def is_allowed_mime(mime_type: str) -> bool:
    return (mime_type or "").lower() in {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "application/pdf",
    }


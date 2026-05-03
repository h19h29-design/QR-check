from __future__ import annotations

import base64
import ctypes
import hashlib
import hmac
import secrets
import re
import sys
from pathlib import Path
from ctypes import wintypes


DPAPI_PREFIX = "dpapi:"


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


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


def protect_local_secret(value: str) -> str:
    """Windows DPAPI로 현재 사용자 계정에 묶어 로컬 비밀값을 보호한다."""
    if not value or value.startswith(DPAPI_PREFIX) or sys.platform != "win32":
        return value
    try:
        raw = value.encode("utf-8")
        in_blob, in_buffer = _blob_from_bytes(raw)
        out_blob = _DataBlob()
        ok = ctypes.windll.crypt32.CryptProtectData(
            ctypes.byref(in_blob),
            "qr-security-admin",
            None,
            None,
            None,
            0x01,  # CRYPTPROTECT_UI_FORBIDDEN
            ctypes.byref(out_blob),
        )
        if not ok:
            return value
        encrypted = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)
        # in_buffer keeps the input bytes alive while CryptProtectData runs.
        _ = in_buffer
        return DPAPI_PREFIX + base64.b64encode(encrypted).decode("ascii")
    except Exception:
        return value


def unprotect_local_secret(value: str) -> str:
    """DPAPI로 보호된 로컬 비밀값을 복호화한다. 실패하면 원문을 그대로 돌려준다."""
    if not value or not value.startswith(DPAPI_PREFIX) or sys.platform != "win32":
        return value
    try:
        encrypted = base64.b64decode(value[len(DPAPI_PREFIX) :])
        in_blob, in_buffer = _blob_from_bytes(encrypted)
        out_blob = _DataBlob()
        ok = ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(in_blob),
            None,
            None,
            None,
            None,
            0x01,  # CRYPTPROTECT_UI_FORBIDDEN
            ctypes.byref(out_blob),
        )
        if not ok:
            return value
        raw = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)
        _ = in_buffer
        return raw.decode("utf-8")
    except Exception:
        return value


def _blob_from_bytes(data: bytes) -> tuple[_DataBlob, ctypes.Array]:
    buffer = ctypes.create_string_buffer(data)
    return _DataBlob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char))), buffer

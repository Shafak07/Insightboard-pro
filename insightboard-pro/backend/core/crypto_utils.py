"""Encrypt sensitive JSON (e.g. API headers) at rest."""

from __future__ import annotations

import base64
import hashlib
import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet

from core.config import get_settings


@lru_cache
def _fernet() -> Fernet:
    digest = hashlib.sha256(get_settings().secret_key.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_json(data: dict[str, Any]) -> dict[str, str]:
    token = _fernet().encrypt(json.dumps(data).encode()).decode()
    return {"_enc": token}


def decrypt_json(blob: dict[str, Any] | None) -> dict[str, Any]:
    if not blob:
        return {}
    if "_enc" in blob:
        raw = _fernet().decrypt(blob["_enc"].encode()).decode()
        return json.loads(raw)
    return dict(blob)

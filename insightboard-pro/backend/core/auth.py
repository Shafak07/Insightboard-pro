from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientError, PyJWKSetError, PyJWTError
from pydantic import BaseModel, EmailStr

from core.config import get_settings
from services.profile_service import ensure_profile_sync, get_profile_sync

settings = get_settings()
security = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    id: str
    email: EmailStr | str
    role: str = "user"
    full_name: str | None = None
    avatar_url: str | None = None
    plan: str = "free"


@lru_cache
def _jwks_client() -> PyJWKClient | None:
    if not settings.supabase_url:
        return None
    base = settings.supabase_url.rstrip("/")
    return PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")


def verify_supabase_token(token: str) -> dict:
    decode_opts = {"verify_aud": True}
    audience = "authenticated"

    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=audience,
                options=decode_opts,
            )
        except InvalidTokenError:
            pass

    jwks = _jwks_client()
    if jwks is not None:
        try:
            signing_key = jwks.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256", "EdDSA"],
                audience=audience,
                options=decode_opts,
            )
        except (InvalidTokenError, PyJWKSetError, PyJWKClientError, PyJWTError):
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _role_from_payload(payload: dict) -> str:
    app_meta = payload.get("app_metadata") or {}
    user_meta = payload.get("user_metadata") or {}
    return (
        app_meta.get("role")
        or user_meta.get("role")
        or payload.get("role")
        or "user"
    )


async def _fetch_profile(user_id: str, email: str) -> CurrentUser:
    full_name: str | None = None
    avatar_url: str | None = None
    plan = "free"

    try:
        row = get_profile_sync(user_id)
        if row:
            full_name = row.get("full_name")
            avatar_url = row.get("avatar_url")
            plan = row.get("plan") or "free"
    except Exception:
        pass

    return CurrentUser(
        id=user_id,
        email=email,
        role="user",
        full_name=full_name,
        avatar_url=avatar_url,
        plan=plan,
    )


async def get_user_from_token(token: str) -> CurrentUser:
    payload = verify_supabase_token(token)
    user_id = payload.get("sub")
    email = payload.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await _fetch_profile(user_id, email)
    user.role = _role_from_payload(payload)
    try:
        ensure_profile_sync(
            user_id,
            str(email),
            user.full_name,
            user.avatar_url,
        )
    except Exception:
        pass
    return user


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(security)
    ] = None,
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_user_from_token(credentials.credentials)

"""JWT verification dependency (FR-046, DECISION-9, Principle IX).

The service trusts NO client-supplied user id. The caller's identity is the
``sub`` of a Supabase access token verified HS256 with the shared secret; the
token must carry ``aud == "authenticated"`` and a valid ``exp``.
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)
_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="missing or invalid bearer token",
    headers={"WWW-Authenticate": "Bearer"},
)


def verify_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> str:
    """Return the verified ``user_id`` (token ``sub``) or raise 401."""
    if credentials is None or not credentials.credentials:
        raise _UNAUTHORIZED
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:  # expired, bad signature, wrong aud, malformed
        raise _UNAUTHORIZED from exc

    user_id = payload.get("sub")
    if not user_id:
        raise _UNAUTHORIZED
    return str(user_id)

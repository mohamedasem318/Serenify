"""JWT verification dependency (FR-046, DECISION-9, Principle IX).

The service trusts NO client-supplied user id. The caller's identity is the
``sub`` of a verified Supabase access token; the token must carry
``aud == "authenticated"`` and a valid ``exp``.

Current Supabase signs access tokens with asymmetric **ES256** signing keys by
default (local CLI + cloud), published at
``<supabase_url>/auth/v1/.well-known/jwks.json``; those are verified against the
public keys (JWKS). Legacy projects that still sign **HS256** with the shared
secret are supported via a fallback (and exercised by the unit tests). This
revises DECISION-9's original HS256-only spec — see docs/CHANGELOG.md
(2026-05-28, anchor service auth-mode amendment). Verifying public keys needs no
secret, so the no-DB-credentials posture of DECISION-9 is preserved.
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)
_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="missing or invalid bearer token",
    headers={"WWW-Authenticate": "Bearer"},
)


class ForbiddenRoleError(Exception):
    """Raised by ``require_employee`` when an authenticated non-employee calls an
    employees-only endpoint. Rendered as ``403 {"error":"forbidden_role"}`` by a
    handler registered in ``app.main`` (matching the ``/anchor`` error-body shape,
    not FastAPI's default ``{"detail": …}`` wrapper). (FR-010)"""

# Asymmetric algorithms Supabase may sign access tokens with (ES256 today). The
# list is pinned here and never derived from the token header (algorithm-
# confusion guard); the symmetric secret and asymmetric public keys are used on
# strictly separate branches, so an attacker cannot force a public key to be read
# as an HMAC secret.
_ASYMMETRIC_ALGS = ["ES256", "RS256", "EdDSA"]

# One cached PyJWKClient per JWKS URL — it memoizes the fetched signing keys, so
# verification does not hit the network on every request.
_jwk_clients: dict[str, PyJWKClient] = {}


def _jwk_client(jwks_url: str) -> PyJWKClient:
    client = _jwk_clients.get(jwks_url)
    if client is None:
        client = PyJWKClient(jwks_url)
        _jwk_clients[jwks_url] = client
    return client


def verify_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> str:
    """Return the verified ``user_id`` (token ``sub``) or raise 401."""
    if credentials is None or not credentials.credentials:
        raise _UNAUTHORIZED
    token = credentials.credentials

    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            # Legacy symmetric verification (shared secret); the unit-test path too.
            key: object = settings.supabase_jwt_secret
            algorithms = ["HS256"]
        elif settings.supabase_url:
            # Asymmetric verification against Supabase's published JWKS; the public
            # key is matched by the token's ``kid``.
            jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            key = _jwk_client(jwks_url).get_signing_key_from_jwt(token).key
            algorithms = _ASYMMETRIC_ALGS
        else:
            # Asymmetric token but no JWKS source configured — cannot verify.
            raise _UNAUTHORIZED
        payload = jwt.decode(token, key, algorithms=algorithms, audience="authenticated")
    except jwt.PyJWTError as exc:  # malformed/expired/bad-sig/bad-aud, JWKS fetch/parse
        raise _UNAUTHORIZED from exc

    user_id = payload.get("sub")
    if not user_id:
        raise _UNAUTHORIZED
    return str(user_id)


def require_employee(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    user_id: str = Depends(verify_jwt),
    settings: Settings = Depends(get_settings),
) -> str:
    """Employees-only gate (FR-010): verify the JWT, then confirm the caller's role
    is ``employee`` by reading **their own** ``profiles.role`` as the user (forwarded
    JWT, RLS select-self — ``role`` is in the profiles SELECT whitelist). Team
    leads / admins do not calibrate and MUST NOT run inference.

    Uses the user-context client (publishable anon key + forwarded JWT) — **no
    service-role**. Non-employee → ``ForbiddenRoleError`` → 403
    ``{"error":"forbidden_role"}``. Returns the verified ``user_id`` on success.
    """
    # verify_jwt already validated the token (it 401s otherwise), so credentials is
    # present here; reuse the raw token to act as the caller against PostgREST.
    from .supabase_user import user_client

    assert credentials is not None  # narrows the Optional; verify_jwt guarantees it
    client = user_client(settings, credentials.credentials)
    resp = client.table("profiles").select("role").eq("id", user_id).execute()
    role = resp.data[0]["role"] if resp.data else None
    if role != "employee":
        raise ForbiddenRoleError()
    return user_id

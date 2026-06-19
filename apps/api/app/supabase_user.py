"""User-context Supabase data layer (revised D-1, feature 008) — NO service-role.

Every DB operation runs **as the caller**: a PostgREST client built from the
publishable anon key (the `apikey`) with the **forwarded user access token** as the
`Authorization` bearer, so Postgres resolves `auth.uid()` to the caller and RLS
(select-own / insert-own / update-own) is the control. There is **no service-role
key** anywhere in this service — the anon key grants nothing beyond RLS.

`user_client()` builds a **fresh** client per request on purpose: `postgrest.auth()`
mutates the client's session-wide `Authorization` header, so a shared client would
let one request's bearer bleed into another's under concurrency. A per-request
client keeps each caller's identity isolated. (Graduation-scale: one concurrent
session per user; the per-request httpx setup cost is negligible.)

The anchor is read ONLY through `get_my_anchor()` (the self-scoped SECURITY DEFINER
RPC) — never via a column SELECT, since the `anchor_vector` column is withheld from
every client role by the anchor-columns whitelist.
"""

from __future__ import annotations

import base64
from typing import Any

import numpy as np
from ml_video import FEATURE_DIM
from supabase import Client, create_client

from .config import Settings

SESSIONS_TABLE = "monitoring_sessions"
READINGS_TABLE = "window_readings"


def user_client(settings: Settings, access_token: str) -> Client:
    """A PostgREST client scoped to the caller via the forwarded JWT (RLS applies).

    `apikey` = the publishable anon key; `Authorization` = the user's access token.
    No service-role key is ever used. Build one per request (see module docstring).
    """
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    # Override the default (anon) Authorization with the caller's token. PostgREST
    # then runs the request as `authenticated` with request.jwt.claims.sub = caller.
    client.postgrest.auth(access_token)
    return client


def _decode_anchor(value: Any) -> np.ndarray:
    """Decode a PostgREST-returned `bytea` anchor into a `(FEATURE_DIM,)` float64.

    The stored bytes are little-endian float32 (`<f4`) — the same encoding the
    `/anchor` route emits (`vector.astype("<f4").tobytes()`). PostgREST may hand a
    `bytea` back either as a Postgres hex string (`\\x...`) or base64; handle both.
    """
    if isinstance(value, (bytes, bytearray)):
        raw = bytes(value)
    elif isinstance(value, str):
        if value.startswith("\\x"):  # Postgres hex output (bytea_output = hex)
            raw = bytes.fromhex(value[2:])
        else:  # base64 (PostgREST JSON scalar)
            raw = base64.b64decode(value)
    else:
        raise ValueError(f"unexpected anchor bytea payload type: {type(value)!r}")

    vector = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    if vector.shape != (FEATURE_DIM,):
        raise ValueError(f"anchor decoded to {vector.shape}, expected ({FEATURE_DIM},)")
    return vector


def get_my_anchor(client: Client) -> np.ndarray | None:
    """Return the caller's anchor vector, or `None` when uncalibrated (→ no_anchor).

    Calls the self-scoped SECURITY DEFINER `public.get_my_anchor()` (takes no
    argument; filters `auth.uid()`), so a caller can only ever retrieve their own.
    """
    resp = client.rpc("get_my_anchor").execute()
    if resp.data is None:
        return None
    return _decode_anchor(resp.data)


def insert_session(client: Client, *, user_id: str, model_version: str) -> dict[str, Any]:
    """Create a monitoring session as the caller (RLS insert-own). Returns the row."""
    resp = (
        client.table(SESSIONS_TABLE)
        .insert({"user_id": user_id, "status": "active", "model_version": model_version})
        .execute()
    )
    return resp.data[0]


def get_session(client: Client, session_id: str) -> dict[str, Any] | None:
    """Fetch one owned session (RLS select-own); `None` if not visible to the caller."""
    resp = (
        client.table(SESSIONS_TABLE)
        .select("id, user_id, status, started_at, ended_at, model_version")
        .eq("id", session_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def update_session(client: Client, session_id: str, **fields: Any) -> dict[str, Any] | None:
    """Update an owned session's lifecycle fields (RLS update-own). Returns the row."""
    resp = client.table(SESSIONS_TABLE).update(fields).eq("id", session_id).execute()
    return resp.data[0] if resp.data else None


def insert_reading(
    client: Client,
    *,
    session_id: str,
    user_id: str,
    captured_at: str,
    scored: bool,
    band: str | None = None,
    skip_cause: str | None = None,
    label: int | None = None,
    stress_probability: float | None = None,
) -> dict[str, Any]:
    """Persist one window reading as the caller (RLS insert-own; the insert WITH
    CHECK also requires an owned `session_id`).

    `label` + `stress_probability` are the SERVER-ONLY raw signal: the INSERT grant
    includes them so the API writes them, but the SELECT whitelist withholds them, so
    the owner can never read them back (FR-015 enforced structurally).
    """
    row: dict[str, Any] = {
        "session_id": session_id,
        "user_id": user_id,
        "captured_at": captured_at,
        "scored": scored,
        "band": band,
        "skip_cause": skip_cause,
        "label": label,
        "stress_probability": stress_probability,
    }
    resp = client.table(READINGS_TABLE).insert(row).execute()
    return resp.data[0]

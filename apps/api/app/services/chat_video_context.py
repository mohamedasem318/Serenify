"""Opportunistic recent-video-read context for Ren (FR-047–FR-050; Principle IV
dual-mode reconcile; research R-7).

This is the ONE direction signal-sharing is allowed: a recent STORED video read may
be handed to Ren's opener as a soft, hedged context line, and noted as agreement in
rollup. It NEVER fuses with the chat band, and the chat band NEVER flows back to any
video surface (that separation is structural — chat bands are written only to
chat_conversations). If a typed message conflicts with a live read ≥70 s stale, the
conversation wins; for the shallow opener we use the recent stored read (today / last
few days), no 70 s gate (spec Assumptions).

The recent-read note is derived CONTEXT (not a prompt seam): calm, hedged, never
clinical, and never claiming certainty (Principle V voice).
"""

from __future__ import annotations

from typing import Any

from supabase import Client

_READINGS_TABLE = "window_readings"

# Calm, hedged opener notes by recent band. at_ease / unknown → no opener (empty).
_RECENT_READ_NOTES: dict[str, str] = {
    "a_little_tense": "Earlier, a quiet check-in hinted things may have felt a little uneasy.",
    "tense": "Earlier, a quiet check-in hinted earlier in the day may have felt like a lot.",
}


def recent_read_band(client: Client, *, since_iso: str) -> str | None:
    """The caller's most recent stored video band since `since_iso` (today / last few
    days), or None. Owner-scoped read (RLS); `band` is on the readings SELECT
    whitelist. Returns the band of the latest scored window."""
    try:
        resp = (
            client.table(_READINGS_TABLE)
            .select("band, captured_at")
            .eq("scored", True)
            .gte("captured_at", since_iso)
            .order("captured_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        # No monitoring data / table not reachable for this caller → no opener.
        return None
    rows: list[dict[str, Any]] = resp.data or []
    if not rows:
        return None
    return rows[0].get("band")


def recent_read_line(band: str | None) -> str:
    """A calm, hedged opener note for a recent band, or "" when there's nothing
    worth gently raising (no recent read, or an at-ease one)."""
    if not band:
        return ""
    return _RECENT_READ_NOTES.get(band, "")

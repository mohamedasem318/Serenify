"""Current-suggestion context for Ren (feature 014, R-7; the `chat_video_context` pattern).

Ren is made AWARE that a suggestion is currently open; nothing else changes. Chat renders
no recommendation cards (`CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS` stays `false`) and
there is no write path back from here — this module reads one owner-scoped row and renders
one fixed hedged sentence. Like the recent-read note it is derived CONTEXT, not a prompt
seam: calm, hedged, never insisting (Principle V voice).

The read runs on the forwarded-JWT client, so it is subject to `recommendation_picks`'
owner-only RLS exactly as the browser's own reads are. There is no service-role path here
and none may be added.

── The day bound, and why it is deliberately loose ──────────────────────────────────
`recommendation_picks.local_day` is a DATE **computed by the browser** from the today-card
day boundary (`localDayWindow`, the `iso_week_start` precedent). The server is never told
the caller's timezone and no column here records one, so "today" is not a question this
module can answer exactly — and it does not pretend to.

Real UTC offsets run from UTC-12 to UTC+14, so a caller's local date is always
`utc_date - 1`, `utc_date`, or `utc_date + 1`. Filtering on `utc_date` alone would silently
drop a genuinely current pick for anyone east of UTC in their early morning and anyone west
of UTC in their late evening. That is the failure mode that matters here: a missing line is
invisible to the reader, while a line about the wrong day is not. So the bound is
`local_day >= utc_date - 1 day` — the tightest filter that cannot exclude the caller's real
local today. No upper bound is needed: a client only ever writes its own local day, which
can never exceed `utc_date + 1`.

The cost of the looseness is bounded and cheap. At most one extra day enters the window;
the row must still be unresolved to qualify at all (`rp_one_active_per_user_day` permits
one such row per person per local day); the most recently surfaced one wins; and the
rendered sentence says "Earlier", never "today". This mirrors
`chat_video_context.recent_read_band`, which bounds "recent" with a deliberately loose
three-day UTC lookback for the same reason — neither helper claims a precision the schema
cannot give it.

── The item name ────────────────────────────────────────────────────────────────────
The fifteen reviewed items live in the repo, web-side
(`apps/web/lib/recommendations/library.ts`), and are deliberately NOT mirrored here: one
reviewed copy of that text, in one place, is what makes "same pick, same words" structural
rather than remembered. `recommendation_picks` stores only the slug (`item_id`, no FK by
design), so the name Ren is given is derived from that slug. It recovers the reviewed title
exactly except for punctuation inside a title, which a slug cannot carry — a difference of
one comma inside a note Ren paraphrases anyway.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

_PICKS_TABLE = "recommendation_picks"

#: How far back the `local_day` filter reaches. One day — see the day-bound note above.
_PICK_LOOKBACK_DAYS = 1

#: Mirrors the `item_id` CHECK in `20260815090000_recommendation_picks.sql` and
#: `LIBRARY_ITEM_ID_PATTERN` web-side. A value that does not match is not rendered: the
#: derived name goes into a model prompt, so it never carries anything but a known slug
#: shape.
_ITEM_ID_PATTERN = re.compile(r"^[a-z0-9-]{1,64}$")

#: The one fixed sentence. The item name is the only variable part, and the hedging is
#: `chat_video_context`'s: soft enough that Ren can let it go the moment the person says
#: something that does not fit it.
_CURRENT_PICK_NOTE = (
    "Earlier, Serenify suggested something small to try - {title} - and there's no word "
    "yet on whether it helped."
)


def pick_lookback_day(now: datetime | None = None) -> str:
    """The inclusive lower bound for the `local_day` filter, as an ISO date string.

    See the module docstring: one day back from the UTC date, which is the tightest bound
    that cannot exclude the caller's actual local today for any real timezone offset.
    """
    reference = now or datetime.now(UTC)
    return (reference.date() - timedelta(days=_PICK_LOOKBACK_DAYS)).isoformat()


def active_pick_item_id(client: Client, *, since_local_day: str) -> str | None:
    """The caller's most recently surfaced ACTIVE pick slug, or None.

    Active means exactly what the table means by it: no outcome recorded and not swapped
    away. Owner-scoped read (RLS). Any failure — no table, no rows, a client error — is a
    None, because a missing context line costs nothing and a wrong one costs trust.
    """
    try:
        resp = (
            client.table(_PICKS_TABLE)
            .select("item_id, suggested_at")
            .gte("local_day", since_local_day)
            .is_("outcome", "null")
            .is_("swapped_away_at", "null")
            .order("suggested_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        # No picks / table not reachable for this caller → no note.
        return None
    rows: list[dict[str, Any]] = resp.data or []
    if not rows:
        return None
    item_id = rows[0].get("item_id")
    if not isinstance(item_id, str) or not _ITEM_ID_PATTERN.match(item_id):
        return None
    return item_id


def _name_from_item_id(item_id: str) -> str:
    """The reviewed item title, recovered from its slug (see the module docstring)."""
    words = item_id.replace("-", " ").strip()
    if not words:
        return ""
    return words[0].upper() + words[1:]


def current_pick_line(item_id: str | None) -> str:
    """A calm, hedged note about the suggestion currently open, or "" when there is
    none — which is also what every failure upstream renders as."""
    if not item_id or not _ITEM_ID_PATTERN.match(item_id):
        return ""
    name = _name_from_item_id(item_id)
    if not name:
        return ""
    return _CURRENT_PICK_NOTE.format(title=name)

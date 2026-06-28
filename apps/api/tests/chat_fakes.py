"""Shared fakes for chat orchestration tests (no network, no real LLM, no real DB).

`FakeLLM` satisfies the `LLMClient` surface the orchestrator uses (`complete` +
`emit_validation_failure`) and scripts replies per call kind. `FakeChatClient` is a
stateful PostgREST stand-in for the chat tables + the small profile/window_readings
reads the orchestrator makes.
"""

from __future__ import annotations

from typing import Any

from llm_client.provider import LLMResponse

# ── FakeLLM ──────────────────────────────────────────────────────────────


class FakeLLM:
    """Scripts replies by call kind, detected from the request (response_format +
    a stable keyword in the system prompt). Each script may be a str, an Exception
    instance (raised), a list used as a queue, or a callable(request)->str."""

    def __init__(
        self,
        *,
        ren: Any = "Thanks for telling me. What's been the heaviest part?",
        scorer: Any = '{"band": "at_ease", "crisis": false}',
        rollup: Any = '{"band": "at_ease", "crisis": false}',
        title: Any = "A brief check-in",
    ) -> None:
        self.ren = ren
        self.scorer = scorer
        self.rollup = rollup
        self.title = title
        self.requests: list[tuple[str, Any]] = []
        self.validation_failures: list[str] = []

    def _kind(self, request) -> str:
        system = request.messages[0].content if request.messages else ""
        if request.response_format == "json_object":
            return "rollup" if "LANDED" in system else "scorer"
        return "title" if "gentle title" in system else "ren"

    def _resolve(self, spec: Any, request) -> Any:
        if isinstance(spec, list):
            return spec.pop(0)
        if isinstance(spec, BaseException):
            return spec
        if callable(spec):
            return spec(request)
        return spec

    async def complete(self, request) -> LLMResponse:
        kind = self._kind(request)
        self.requests.append((kind, request))
        content = self._resolve(getattr(self, kind), request)
        if isinstance(content, BaseException):
            raise content
        return LLMResponse(
            provider="groq", model="fake", content=content, finish_reason="stop", latency_ms=1
        )

    def emit_validation_failure(self, *, provider: str, failure: str) -> None:
        self.validation_failures.append(failure)

    # convenience: messages handed to a given kind
    def messages_for(self, kind: str) -> list:
        for k, req in self.requests:
            if k == kind:
                return req.messages
        return []


# ── FakeChatClient ─────────────────────────────────────────────────────────


class _Resp:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Q:
    def __init__(self, fake: FakeChatClient, table: str):
        self._fake = fake
        self._table = table
        self._op: str | None = None
        self._payload: Any = None
        self._cols: str = ""
        self._filters: dict = {}

    def insert(self, row):
        self._op, self._payload = "insert", row
        return self

    def select(self, cols, count=None):
        self._op, self._cols = "select", cols
        return self

    def update(self, fields):
        self._op, self._payload = "update", fields
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def gte(self, col, val):
        self._filters[f"{col}__gte"] = val
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, _n):
        return self

    def execute(self):
        return self._fake._dispatch(self)


class FakeChatClient:
    def __init__(self, *, conversation=None, profile=None, recent_band=None,
                 country_column_exists: bool = True):
        self.conversation: dict[str, Any] = conversation or {
            "id": "conv1",
            "user_id": "u1",
            "state": "open",
            "title": None,
            "rollup_band": None,
            "message_count": 0,
            "last_message_at": None,
            "created_at": "2026-06-28T00:00:00+00:00",
            "updated_at": "2026-06-28T00:00:00+00:00",
        }
        self.messages: list[dict[str, Any]] = []
        self.profile = profile or {"full_name": "Sam Lee", "country": None}
        self.recent_band = recent_band
        self.country_column_exists = country_column_exists
        self._seq = 0

    def _ts(self) -> str:
        self._seq += 1
        return f"2026-06-28T00:00:{self._seq:02d}+00:00"

    def table(self, name: str) -> _Q:
        return _Q(self, name)

    def _dispatch(self, q: _Q) -> _Resp:
        if q._table == "chat_messages":
            if q._op == "insert":
                row = {
                    "id": f"m{len(self.messages) + 1}",
                    "conversation_id": q._payload["conversation_id"],
                    "user_id": q._payload["user_id"],
                    "role": q._payload["role"],
                    "content": q._payload["content"],
                    "created_at": self._ts(),
                }
                self.messages.append(row)
                return _Resp([row])
            if q._op == "select":
                cid = q._filters.get("conversation_id")
                rows = [m for m in self.messages if cid is None or m["conversation_id"] == cid]
                return _Resp(rows)
            if q._op == "delete":
                return _Resp([])

        if q._table == "chat_conversations":
            if q._op == "select":
                if self.conversation["id"] == q._filters.get("id", self.conversation["id"]):
                    return _Resp([dict(self.conversation)])
                return _Resp([])
            if q._op == "update":
                self.conversation.update(q._payload)
                self.conversation["updated_at"] = self.conversation.get("updated_at") or self._ts()
                return _Resp([dict(self.conversation)])
            if q._op == "insert":
                self.conversation.update(q._payload)
                return _Resp([dict(self.conversation)])

        if q._table == "profiles":
            if "country" in q._cols:
                if not self.country_column_exists:
                    raise RuntimeError("column profiles.country does not exist")
                return _Resp([{"country": self.profile.get("country")}])
            return _Resp([{"full_name": self.profile.get("full_name")}])

        if q._table == "window_readings":
            if self.recent_band:
                return _Resp(
                    [{"band": self.recent_band, "captured_at": "2026-06-27T12:00:00+00:00"}]
                )
            return _Resp([])

        return _Resp([])

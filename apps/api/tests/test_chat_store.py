"""T023 — chat_store helpers issue owner-scoped ops against a user-context client.

DB is faked (the real RLS is Postgres-enforced and covered statically by
test_chat_storage_rls.py). Here we assert the helpers build the right PostgREST
calls and return rows — and that nothing writes a forbidden field.
"""

from __future__ import annotations

from app.services import chat_store


class _Resp:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Query:
    def __init__(self, fake, table):
        self._fake = fake
        self._table = table
        self._op = None
        self._payload = None
        self._filters: dict = {}
        self._order = None
        self._limit = None
        self._count = None

    def insert(self, row):
        self._op = "insert"
        self._payload = row
        return self

    def select(self, _cols, count=None):
        self._op = "select"
        self._count = count
        return self

    def update(self, fields):
        self._op = "update"
        self._payload = fields
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

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        self._fake.calls.append(
            {
                "table": self._table,
                "op": self._op,
                "payload": self._payload,
                "filters": self._filters,
                "order": self._order,
                "limit": self._limit,
                "count": self._count,
            }
        )
        return self._fake.next_resp


class FakeClient:
    def __init__(self):
        self.calls: list[dict] = []
        self.next_resp = _Resp([])

    def table(self, name):
        return _Query(self, name)


def test_insert_conversation_creates_open_owned_thread():
    c = FakeClient()
    c.next_resp = _Resp([{"id": "conv1", "user_id": "u1", "state": "open"}])
    row = chat_store.insert_conversation(c, user_id="u1")
    call = c.calls[-1]
    assert call["table"] == "chat_conversations"
    assert call["op"] == "insert"
    assert call["payload"] == {"user_id": "u1", "state": "open", "message_count": 0}
    # No crisis / band / scorer field is ever written here.
    assert set(call["payload"]) == {"user_id", "state", "message_count"}
    assert row["id"] == "conv1"


def test_list_conversations_orders_recent_first():
    c = FakeClient()
    c.next_resp = _Resp([{"id": "a"}, {"id": "b"}])
    rows = chat_store.list_conversations(c, limit=10)
    call = c.calls[-1]
    assert call["op"] == "select"
    assert call["order"] == ("updated_at", True)
    assert call["limit"] == 10
    assert len(rows) == 2


def test_get_conversation_filters_by_id_and_returns_none_when_absent():
    c = FakeClient()
    c.next_resp = _Resp([])
    assert chat_store.get_conversation(c, "missing") is None
    assert c.calls[-1]["filters"] == {"id": "missing"}


def test_get_current_conversation_is_most_recent_open():
    c = FakeClient()
    c.next_resp = _Resp([{"id": "latest", "state": "open"}])
    row = chat_store.get_current_conversation(c)
    call = c.calls[-1]
    assert call["order"] == ("updated_at", True)
    assert call["limit"] == 1
    # A finalized (ended) conversation is never "current" — the query filters to open.
    assert call["filters"] == {"state": "open"}
    assert row["id"] == "latest"


class _ConvQuery:
    """PostgREST stand-in that actually honors the .eq('state', …) filter + ordering,
    so we can prove get_current_conversation never resumes a finalized conversation."""

    def __init__(self, rows):
        self._rows = rows
        self._filters: dict = {}
        self._order = ("updated_at", False)
        self._limit = None

    def select(self, _cols, count=None):
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        rows = [r for r in self._rows if all(r.get(k) == v for k, v in self._filters.items())]
        col, desc = self._order
        rows = sorted(rows, key=lambda r: r.get(col, ""), reverse=desc)
        return _Resp(rows[: self._limit] if self._limit is not None else rows)


class _ConvClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, _name):
        return _ConvQuery(self._rows)


def test_get_current_conversation_excludes_finalized_returns_open():
    open_row = {"id": "open1", "state": "open", "updated_at": "2026-06-28T02:00:00Z"}
    ended_row = {"id": "ended1", "state": "ended", "updated_at": "2026-06-28T03:00:00Z"}

    # Even though the ended chat is the most recently updated, it is NOT "current" —
    # the open one is resumed instead.
    c = _ConvClient([ended_row, open_row])
    row = chat_store.get_current_conversation(c)
    assert row is not None and row["id"] == "open1"

    # With ONLY a finalized conversation, there is no current chat → None → fresh start.
    c = _ConvClient([ended_row])
    assert chat_store.get_current_conversation(c) is None


def test_insert_message_persists_only_stripped_text_fields():
    c = FakeClient()
    c.next_resp = _Resp([{"id": "m1", "role": "user", "content": "hi"}])
    chat_store.insert_message(
        c, conversation_id="conv1", user_id="u1", role="user", content="hi"
    )
    payload = c.calls[-1]["payload"]
    assert payload == {
        "conversation_id": "conv1",
        "user_id": "u1",
        "role": "user",
        "content": "hi",
    }
    # No band / crisis / scorer columns.
    assert "band" not in payload and "crisis" not in payload


def test_update_conversation_targets_the_row():
    c = FakeClient()
    c.next_resp = _Resp([{"id": "conv1", "title": "A calm note"}])
    chat_store.update_conversation(c, "conv1", title="A calm note", state="ended")
    call = c.calls[-1]
    assert call["op"] == "update"
    assert call["filters"] == {"id": "conv1"}
    assert call["payload"] == {"title": "A calm note", "state": "ended"}


def test_delete_conversation_is_owner_scoped_delete():
    c = FakeClient()
    c.next_resp = _Resp([])
    chat_store.delete_conversation(c, "conv1")
    call = c.calls[-1]
    assert call["op"] == "delete"
    assert call["filters"] == {"id": "conv1"}


def test_get_messages_orders_oldest_first():
    c = FakeClient()
    c.next_resp = _Resp([{"id": "m1"}, {"id": "m2"}])
    chat_store.get_messages(c, "conv1")
    call = c.calls[-1]
    assert call["filters"] == {"conversation_id": "conv1"}
    assert call["order"] == ("created_at", False)


def test_count_user_messages_since_uses_exact_count():
    c = FakeClient()
    c.next_resp = _Resp([], count=3)
    n = chat_store.count_user_messages_since(c, user_id="u1", since_iso="2026-06-28T00:00:00Z")
    call = c.calls[-1]
    assert call["count"] == "exact"
    assert call["filters"]["user_id"] == "u1"
    assert call["filters"]["role"] == "user"
    assert "created_at__gte" in call["filters"]
    assert n == 3

"""T024 — POST /recommendations/reflective-copy (feature 014).

Four things are pinned here, in rising order of how expensive it would be to get them
wrong:

1. **Auth** — a verified token or nothing.
2. **A facts-only input surface** — the body is the `ReflectiveFacts` bundle and *only*
   that. An extra field is a 422, not a quiet pass-through to a model.
3. **No fallback and no database** — every failure answers non-200, and neither the router
   nor the service can reach a table.
4. **Credential isolation (Amendment 3, 2026-08-16)** — this path resolves
   `GROQ_API_KEY_REFLECTIVE_COPY` and never `GROQ_API_KEY`. Ren's key is not read, not
   loaded-then-overwritten, and not sent. Card copy cannot eat the conversation's rate
   limit, and the conversation cannot be taken down by the card.

No test here needs a real key: an absent credential is a *supported* state that raises at
request time without touching the network, which is exactly what several of these assert.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from llm_client import (
    LLMClientConfig,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
    ProviderCallResult,
)

from app.routers import recommendations as recommendations_router
from app.services import llm_client as llm_mod
from app.services import reflective_copy as reflective_mod

REN_KEY_SENTINEL = "ren-key-must-never-be-read-by-this-path"
REFLECTIVE_KEY_SENTINEL = "reflective-copy-key"

CALM_FACTS = {
    "state": 2,
    "checkin_count": 3,
    "times": ["9:40", "11:15"],
    "band_labels": ["Calm"],
    "fallback_text": (
        "Calm at all 3 check-ins today, at 9:40 and 11:15. "
        "Suggestions show up here when something shifts."
    ),
}

AT_REST_FACTS = {
    "state": 9,
    "checkin_count": 2,
    "times": ["9:40"],
    "band_labels": ["Uneasy"],
    "tried_item_title": "Box breathing",
    "tried_at_label": "2:20",
    "fallback_text": (
        "You tried Box breathing at 2:20. If today shifts again, something new shows up here."
    ),
}


@pytest.fixture(autouse=True)
def _clear_client_caches():
    """Both accessors are `@lru_cache` singletons that read the environment once. A test
    that changes the environment must not inherit — or leave behind — a client built from
    a different one."""
    llm_mod.get_llm_client.cache_clear()
    llm_mod.get_reflective_copy_llm_client.cache_clear()
    yield
    llm_mod.get_llm_client.cache_clear()
    llm_mod.get_reflective_copy_llm_client.cache_clear()


# ── Test doubles ──────────────────────────────────────────────────────────────


class _ScriptedRegistry:
    """Answers with a fixed provider body, or raises a fixed error."""

    def __init__(self, *, content: str | None = None, error: Exception | None = None) -> None:
        self._content = content
        self._error = error
        self.calls = 0

    async def complete(self, request: LLMRequest) -> ProviderCallResult:
        self.calls += 1
        if self._error is not None:
            raise self._error
        return ProviderCallResult(
            response=LLMResponse(
                provider="groq",
                model="openai/gpt-oss-120b",
                content=self._content or "",
                finish_reason="stop",
                latency_ms=90,
            ),
            used_fallback=False,
        )


def _install_client(monkeypatch, registry: _ScriptedRegistry) -> None:
    """Swap the accessor the ROUTER holds — it imported the name, so patching the service
    module would leave the router's reference untouched."""
    client = llm_mod.LLMClient(registry=registry)
    monkeypatch.setattr(
        recommendations_router, "get_reflective_copy_llm_client", lambda: client
    )


def _post(client, token: str | None, body: dict):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/recommendations/reflective-copy", json=body, headers=headers)


# ── 1. Auth ───────────────────────────────────────────────────────────────────


def test_requires_a_token(client):
    assert _post(client, None, CALM_FACTS).status_code == 401


def test_rejects_a_forged_token(client):
    from .conftest import make_token

    forged = make_token(secret="not-the-configured-secret-0123456789abcdef")
    assert _post(client, forged, CALM_FACTS).status_code == 401


def test_rejects_an_expired_token(client):
    from .conftest import make_token

    assert _post(client, make_token(exp_delta=-60), CALM_FACTS).status_code == 401


# ── 2. Facts-only input surface ───────────────────────────────────────────────


def test_accepts_the_facts_bundle(client, valid_token, monkeypatch):
    registry = _ScriptedRegistry(content='{"text": "Calm across today\'s 3 check-ins."}')
    _install_client(monkeypatch, registry)

    resp = _post(client, valid_token, CALM_FACTS)
    assert resp.status_code == 200
    assert resp.json() == {"text": "Calm across today's 3 check-ins."}
    assert registry.calls == 1


def test_accepts_the_state_9_bundle(client, valid_token, monkeypatch):
    _install_client(
        monkeypatch, _ScriptedRegistry(content='{"text": "Box breathing was what you opened."}')
    )
    resp = _post(client, valid_token, AT_REST_FACTS)
    assert resp.status_code == 200


@pytest.mark.parametrize(
    "extra",
    [
        {"user_name": "Sam"},
        {"readings": [0.81, 0.42]},
        {"conversation_id": "11111111-1111-1111-1111-111111111111"},
        {"probability": 0.7},
    ],
)
def test_rejects_any_field_outside_the_facts_bundle(client, valid_token, monkeypatch, extra):
    # `extra="forbid"` is the enforcement — without it these would be silently dropped
    # and the endpoint's "facts only" claim would rest on the client behaving.
    registry = _ScriptedRegistry(content='{"text": "x"}')
    _install_client(monkeypatch, registry)

    resp = _post(client, valid_token, {**CALM_FACTS, **extra})
    assert resp.status_code == 422
    assert registry.calls == 0, "a rejected body must never reach the provider"


@pytest.mark.parametrize(
    "body",
    [
        {k: v for k, v in CALM_FACTS.items() if k != "fallback_text"},
        {**CALM_FACTS, "fallback_text": ""},
        {**CALM_FACTS, "state": 1},
        {**CALM_FACTS, "state": 4},
        {**CALM_FACTS, "checkin_count": -1},
    ],
)
def test_rejects_a_malformed_facts_bundle(client, valid_token, monkeypatch, body):
    registry = _ScriptedRegistry(content='{"text": "x"}')
    _install_client(monkeypatch, registry)

    assert _post(client, valid_token, body).status_code == 422
    assert registry.calls == 0


# ── 3. Failure answers non-200, and the endpoint never falls back ─────────────


@pytest.mark.parametrize(
    "content",
    [
        "not json at all",
        "[1, 2, 3]",
        '{"reply": "wrong key"}',
        '{"text": 42}',
        '{"text": null}',
        '{"text": "   "}',
    ],
)
def test_parse_failure_is_non_200(client, valid_token, monkeypatch, content):
    _install_client(monkeypatch, _ScriptedRegistry(content=content))

    resp = _post(client, valid_token, CALM_FACTS)
    assert resp.status_code != 200
    assert resp.status_code == 502
    assert resp.json()["error"] == "reflective_copy_unavailable"


def test_parse_failure_emits_validation_telemetry(client, valid_token, monkeypatch):
    events = []
    monkeypatch.setattr(llm_mod, "emit_telemetry", lambda e: events.append(e))
    _install_client(monkeypatch, _ScriptedRegistry(content='{"reply": "wrong key"}'))

    assert _post(client, valid_token, CALM_FACTS).status_code == 502
    outcomes = [e.outcome for e in events]
    assert "validation_error" in outcomes
    failure = next(e.validation_failure for e in events if e.outcome == "validation_error")
    assert failure == "missing_key"


def test_provider_error_is_non_200(client, valid_token, monkeypatch):
    _install_client(
        monkeypatch,
        _ScriptedRegistry(error=LLMProviderError("down", provider="groq", retryable=False)),
    )
    assert _post(client, valid_token, CALM_FACTS).status_code == 502


def test_extraction_survives_a_code_fence(client, valid_token, monkeypatch):
    # `extract_json_object` is the reasoning-leakage / fence defense; this is the one
    # case where a "malformed" body is still a good answer.
    _install_client(
        monkeypatch,
        _ScriptedRegistry(content='Sure thing.\n```json\n{"text": "A quiet day so far."}\n```'),
    )
    resp = _post(client, valid_token, CALM_FACTS)
    assert resp.status_code == 200
    assert resp.json() == {"text": "A quiet day so far."}


_DB_TOKENS = ("supabase", "postgrest", "chat_store", "require_employee")


def _import_lines(source: str) -> list[str]:
    """Every import statement in a module, docstrings and comments excluded. Parsed with
    `ast` rather than matched with substrings: a relative import reads as
    `from ..supabase_user import …` in the text, which a naive `"from supabase_user"`
    check would sail straight past."""
    import ast

    lines: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            lines.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            lines.extend(f"{module}.{alias.name}" for alias in node.names)
    return lines


def test_no_database_module_is_reachable_from_this_endpoint():
    """FR-020/FR-023 as a source guard: the facts arrive precomputed, so nothing on this
    path may import a client that could read a table — including the employee gate, which
    reads `profiles.role`."""
    api = Path(__file__).resolve().parents[1] / "app"
    sources = [
        api / "routers" / "recommendations.py",
        api / "services" / "reflective_copy.py",
    ]
    for path in sources:
        imported = _import_lines(path.read_text(encoding="utf-8"))
        for name in imported:
            for token in _DB_TOKENS:
                assert token not in name, f"{path.name} imports {name!r}"


def test_the_db_guard_would_actually_catch_an_offending_import():
    # A guard that cannot fail is not a guard. This is the shape it is watching for.
    offending = "from ..supabase_user import user_client\n"
    names = _import_lines(offending)
    assert any(token in name for name in names for token in _DB_TOKENS)


# ── 4. Credential isolation (Amendment 3) ────────────────────────────────────


def test_reflective_config_never_resolves_rens_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", REN_KEY_SENTINEL)
    monkeypatch.delenv("GROQ_API_KEY_REFLECTIVE_COPY", raising=False)

    config = llm_mod.reflective_copy_config()

    assert config.primary.api_key is None
    # Not anywhere in the object either — this catches a "load it then overwrite it"
    # implementation, which would leave the secret sitting in the fallback endpoint.
    assert REN_KEY_SENTINEL not in repr(config)


def test_the_config_loader_never_even_SEES_rens_key(monkeypatch):
    """The strongest form of "never read": Ren's variable is filtered out of the
    environment BEFORE `load_config` runs, so nothing downstream can resolve it."""
    monkeypatch.setenv("GROQ_API_KEY", REN_KEY_SENTINEL)
    monkeypatch.setenv("GROQ_API_KEY_REFLECTIVE_COPY", REFLECTIVE_KEY_SENTINEL)

    seen: list[dict] = []
    real_load_config = llm_mod.load_config

    def spy(env=None) -> LLMClientConfig:
        seen.append(dict(env) if env is not None else dict(__import__("os").environ))
        return real_load_config(env)

    monkeypatch.setattr(llm_mod, "load_config", spy)
    llm_mod.reflective_copy_config()

    assert len(seen) == 1
    assert "GROQ_API_KEY" not in seen[0]
    assert "GROQ_API_KEY_REFLECTIVE_COPY" in seen[0]
    assert REN_KEY_SENTINEL not in seen[0].values()


def test_reflective_config_uses_its_own_key_when_present(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", REN_KEY_SENTINEL)
    monkeypatch.setenv("GROQ_API_KEY_REFLECTIVE_COPY", REFLECTIVE_KEY_SENTINEL)

    config = llm_mod.reflective_copy_config()

    assert config.primary.api_key == REFLECTIVE_KEY_SENTINEL
    assert config.silent_fallback is False


def test_rens_client_is_untouched_by_the_second_credential(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", REN_KEY_SENTINEL)
    monkeypatch.setenv("GROQ_API_KEY_REFLECTIVE_COPY", REFLECTIVE_KEY_SENTINEL)

    ren = llm_mod.get_llm_client()
    assert ren._config.primary.api_key == REN_KEY_SENTINEL
    assert REFLECTIVE_KEY_SENTINEL not in repr(ren._config)


def test_reflective_path_has_no_fallback_provider(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY_REFLECTIVE_COPY", REFLECTIVE_KEY_SENTINEL)
    registry = llm_mod.build_reflective_copy_registry(llm_mod.reflective_copy_config())

    assert registry.silent_fallback is False
    assert isinstance(registry.fallback, llm_mod._NoFallbackProvider)


async def test_the_fallback_provider_raises_if_anything_ever_calls_it():
    with pytest.raises(LLMProviderError) as excinfo:
        await llm_mod._NoFallbackProvider().complete(LLMRequest(messages=[]))
    assert excinfo.value.retryable is False


async def test_only_the_reflective_key_goes_on_the_wire(monkeypatch):
    """The end of the chain: what is actually sent. A config assertion proves the value
    was chosen correctly; this proves nothing else is transmitted."""
    monkeypatch.setenv("GROQ_API_KEY", REN_KEY_SENTINEL)
    monkeypatch.setenv("GROQ_API_KEY_REFLECTIVE_COPY", REFLECTIVE_KEY_SENTINEL)

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "model": "openai/gpt-oss-120b",
                "choices": [{"message": {"content": '{"text": "ok"}'}, "finish_reason": "stop"}],
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        registry = llm_mod.build_reflective_copy_registry(
            llm_mod.reflective_copy_config(), client=http_client
        )
        await registry.complete(LLMRequest(messages=[], response_format="json_object"))

    assert len(captured) == 1
    sent = captured[0]
    assert sent.headers["Authorization"] == f"Bearer {REFLECTIVE_KEY_SENTINEL}"
    assert REN_KEY_SENTINEL not in str(sent.headers)


def test_endpoint_is_non_200_when_only_rens_key_is_set(client, valid_token, monkeypatch):
    """The headline case. Ren is fully configured; the reflective credential is not. The
    card must degrade, NOT borrow — and nothing here touches the network, because the
    Groq adapter fails clean on a missing key before it builds a request."""
    monkeypatch.setenv("GROQ_API_KEY", REN_KEY_SENTINEL)
    monkeypatch.delenv("GROQ_API_KEY_REFLECTIVE_COPY", raising=False)
    llm_mod.get_reflective_copy_llm_client.cache_clear()

    resp = _post(client, valid_token, CALM_FACTS)

    assert resp.status_code == 502
    assert resp.json()["error"] == "reflective_copy_unavailable"
    # And the client the endpoint just built carries no key at all.
    assert llm_mod.get_reflective_copy_llm_client()._config.primary.api_key is None


def test_the_service_reads_only_the_reflective_env_name():
    """A source guard on the resolver itself. `GROQ_API_KEY` appears in the module only as
    the name being EXCLUDED — never as something fetched."""
    source = Path(llm_mod.__file__).read_text(encoding="utf-8")
    assert 'os.environ.get("GROQ_API_KEY")' not in source
    assert 'os.environ["GROQ_API_KEY"]' not in source
    assert 'os.environ.get(REFLECTIVE_COPY_API_KEY_ENV)' in source


# ── Prompt wiring ─────────────────────────────────────────────────────────────


def test_the_service_renders_the_registered_prompt_with_the_facts():
    facts = reflective_mod.ReflectiveFacts(
        state=9,
        checkin_count=2,
        times=("9:40",),
        band_labels=("Uneasy",),
        fallback_text="You tried Box breathing at 2:20.",
        tried_item_title="Box breathing",
        tried_at_label="2:20",
    )
    messages = reflective_mod.build_messages(facts)

    assert len(messages) == 1
    assert messages[0].role == "system"
    rendered = messages[0].content
    assert "You tried Box breathing at 2:20." in rendered
    assert "{fallback_text}" not in rendered
    assert "{tried_at_label}" not in rendered


def test_absent_optional_facts_render_as_blank_not_as_none():
    facts = reflective_mod.ReflectiveFacts(
        state=2,
        checkin_count=1,
        times=("9:40",),
        band_labels=("Calm",),
        fallback_text="Calm at your one check-in today, at 9:40.",
    )
    rendered = reflective_mod.build_messages(facts)[0].content
    assert "None" not in rendered

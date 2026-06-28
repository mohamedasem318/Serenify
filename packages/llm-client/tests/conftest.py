"""Shared fixtures for llm-client tests (Constitution Principle IV + VII).

Two things every test here leans on:
  * A FAKE provider that satisfies the `LLMProvider` protocol structurally (no
    vendor SDK, no network) — proving app/test code can drive the boundary with a
    stand-in (T013).
  * The REAL fixed prompt files under `packages/llm-client/prompts/` — tests read
    them, they never author or assert their wording (Prompt input rule).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from pathlib import Path

import pytest

# Repo prompt directory (packages/llm-client/prompts). tests/ sits beside src/ and
# prompts/ under the package root, so two parents up from this file.
PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


@pytest.fixture
def prompts_dir() -> Path:
    """Absolute path to the fixed 011 prompt files (verbatim input)."""
    return PROMPTS_DIR


class FakeProvider:
    """A scripted `LLMProvider` stand-in (structural; no import of the protocol
    needed, no vendor SDK, no network). Returns queued contents in order, or a
    single fixed content for every call."""

    def __init__(
        self,
        *,
        name: str = "groq",
        model: str = "fake-model",
        contents: Sequence[str] | None = None,
        on_complete: Callable[[object], str] | None = None,
    ) -> None:
        self.name = name
        self._model = model
        self._contents = list(contents or [])
        self._on_complete = on_complete
        self.calls: list[object] = []

    async def complete(self, request: object):  # -> LLMResponse
        from llm_client.provider import LLMResponse

        self.calls.append(request)
        if self._on_complete is not None:
            content = self._on_complete(request)
        elif self._contents:
            content = self._contents.pop(0)
        else:
            content = ""
        return LLMResponse(
            provider=self.name,  # type: ignore[arg-type]
            model=self._model,
            content=content,
            finish_reason="stop",
            latency_ms=1,
        )


@pytest.fixture
def make_fake_provider() -> Callable[..., FakeProvider]:
    """Factory so a test can script provider replies per scenario."""

    def _make(**kwargs) -> FakeProvider:
        return FakeProvider(**kwargs)

    return _make

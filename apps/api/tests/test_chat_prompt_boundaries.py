"""T016 — no inline prompt strings in API chat call sites (FR-008, FR-010; Principle IV).

Prompts are FIXED FILES loaded via `llm_client`. This guard scans the API chat
source for distinctive prompt wording (which would mean someone inlined or rewrote a
prompt) and confirms the orchestrator pulls prompts through the boundary instead.
"""

from __future__ import annotations

from pathlib import Path

_APP = Path(__file__).resolve().parents[1] / "app"

# Files that make LLM/chat calls — the only place a prompt string could be inlined.
_CHAT_SOURCES = [
    _APP / "routers" / "chat.py",
    _APP / "services" / "chat_orchestrator.py",
    _APP / "services" / "chat_store.py",
    _APP / "services" / "llm_client.py",
    _APP / "services" / "crisis_resources.py",
    _APP / "services" / "chat_video_context.py",
]

# Distinctive substrings from the fixed prompt files. None may appear in app code.
_PROMPT_FINGERPRINTS = (
    "You are Ren",
    "supportive companion inside Serenify",
    "You are a stress classifier",
    "You are a safety classifier",
    "Return ONLY a JSON object",
    "Give this conversation a short",
    "not a substitute for professional care",  # disclaimer is UI copy, not API prompt
)


def _existing_sources() -> list[Path]:
    return [p for p in _CHAT_SOURCES if p.is_file()]


def test_no_inline_prompt_wording_in_api_chat_sources():
    for path in _existing_sources():
        text = path.read_text(encoding="utf-8")
        for fingerprint in _PROMPT_FINGERPRINTS:
            assert fingerprint not in text, f"inline prompt wording in {path.name}: {fingerprint!r}"


def test_orchestrator_loads_prompts_through_the_boundary():
    orchestrator = _APP / "services" / "chat_orchestrator.py"
    assert orchestrator.is_file(), "chat_orchestrator.py must exist"
    text = orchestrator.read_text(encoding="utf-8")
    # Prompts are loaded by id from the package, never authored inline.
    assert "render_prompt" in text or "load_prompt" in text
    assert "llm_client" in text

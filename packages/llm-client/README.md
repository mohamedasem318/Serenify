# llm-client

Serenify's shared LLM provider boundary (Constitution Principle IV).

All server-side LLM access goes through this package — application code never
imports a vendor SDK. It provides:

- `LLMProvider` — a structural async completion protocol.
- Config-driven providers: Groq `openai/gpt-oss-120b` primary (`reasoning_effort=low`),
  LM Studio `openai/gpt-oss-20b` fallback, both OpenAI-compatible over `httpx`.
- `ProviderRegistry` — fail-clean by default; silent fallback only behind an explicit flag.
- File-backed prompts (`prompts/<id>.txt`), loaded verbatim — no inline prompt strings.
- Scorer JSON validation + defensive extraction (`{band, crisis}`).
- Privacy-safe telemetry types (allow-list only; no message/prompt/crisis/band fields).

Consumed by `apps/api` as a local editable `uv` source (see `apps/api/pyproject.toml`).

```bash
uv run pytest
```

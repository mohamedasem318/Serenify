# Contract — reflective copy generation (states 2 and 9)

**Rule of the surface**: the deterministic fallback string is the source of truth for
*what* is said; generation changes only *how* (FR-021). The card never blocks and never
shows an error (FR-030).

## Endpoint (apps/api)

`POST /recommendations/reflective-copy` — forwarded-JWT auth (the `/chat/*` pattern).

Request body = the `ReflectiveFacts` bundle ([data-model.md](../data-model.md) §4), and
nothing else. The endpoint MUST NOT read `window_readings`, chat tables, or any other
user data — the facts arrive precomputed (FR-020/FR-023).

Response: `{ "text": string }` (the generated phrasing) or a non-200 on any provider
failure. The endpoint does **not** fall back itself — the fallback decision is
client-side, next to the deterministic string.

## Provider path (FR-024 — no new provider; second credential per Amendment 3, 2026-08-16)

- **Separate credential from Ren's** (Amendment 3): the endpoint calls
  `get_reflective_copy_llm_client()` — a new, additive `@lru_cache` accessor in
  `apps/api/app/services/llm_client.py` beside Ren's untouched `get_llm_client()`. Same
  provider (Groq `openai/gpt-oss-120b`), transient retry per `LLM_MAX_RETRIES` unchanged,
  but the primary endpoint's key is rebuilt from **`GROQ_API_KEY_REFLECTIVE_COPY`** and
  this path has **no fallback provider**. The resolver is
  `os.environ.get("GROQ_API_KEY_REFLECTIVE_COPY") or None` — it MUST NOT read
  `GROQ_API_KEY`, take a default-key parameter, or fall back to Ren's client under any
  condition. Zero edits to `packages/llm-client`.
- **Absent or invalid key**: nothing raises at import or construction; the provider raises
  a non-retryable error at request time; the endpoint returns non-200; the web client
  renders the deterministic fallback. The card never breaks and never borrows Ren's
  credential or rate limits (the point of the second key).
- **Configuration sites**: `apps/api/.env` (local), a documented block in
  `apps/api/.env.example`, and the `serenify-api` Azure Container App env/secret (set by
  CLI — no IaC in-repo). CI sets nothing; tests must not require a real key. The secret
  itself is placed by Mohamed; the code ships tolerating its absence.
- New versioned prompt `packages/llm-client/prompts/reflective_copy.txt`, registered in
  the `PromptId` literal + `PROMPT_IDS` (`prompts.py` is a closed set — a file on disk is
  not enough). Variables: the facts fields, rendered via `render_prompt` literal
  replacement.
- `response_format="json_object"`; response parsed with the scorer's
  `extract_json_object` (reasoning-leakage / code-fence defense). Missing or non-string
  `text` → validation failure telemetry (the `ScorerValidationError` pattern), non-200.

## Validation before display (client, pure TS — SC-004)

`apps/web/lib/recommendations/reflective-copy-validation.ts`,
`validateReflectiveCopy(text, facts) → { ok: true } | { ok: false; reason }`:

1. Every maximal digit run in `text` appears verbatim in the supplied facts
   (`checkinCount` as string, `times`, `triedAtLabel`, `durationLabel`-free — numbers not
   in facts are fabrications).
2. Every time-shaped token (`/\b\d{1,2}[:.]\d{2}\b/`, am/pm forms) appears in the facts.
3. Every band word (`calm|uneasy|tense`, case-insensitive; plus the internal enum spellings
   as a guard) appears in `bandLabels`.
4. No exclamation mark; no forbidden clinical/alarmist vocabulary (`alert`, `abnormal`,
   `elevated risk`, `detected`) — Principle V (FR-028).
5. Length cap (≤ 220 chars) and non-empty after trim.

Any failure → render `facts.fallbackText`.

## First paint (text never flips under the reader)

The invariant: the reflective line is painted **once** per mounted state — the reader
never sees one text replaced by another. Rules, in order:

1. **Cache hit** → paint the cached (already-validated) text immediately. No skeleton,
   no network call.
2. **Cache miss** → the card shell (title, description, tile) paints immediately as
   usual; only the reflective line renders as a **skeleton** (a shimmer bar in the
   line's slot, static under `prefers-reduced-motion`, `aria-busy`), on a budget of
   **800 ms**.
   - *Why 800 ms, and why a skeleton at all*: the sibling today card has no skeleton
     anywhere — it paints a stable shell and upgrades exactly once after a single local
     Supabase round trip, typically well under a second. A generated line that lags
     materially behind that sibling reads as a broken card, and painting the fallback
     early just to swap it later is the flip this contract forbids — so the line's slot
     waits, briefly. 800 ms keeps the wait a blink on the same visual clock as the
     sibling's single round trip, and is ~4× tighter than the 3.5 s generation budget:
     the generation budget bounds *background* work; the skeleton budget bounds what a
     *reader* watches.
3. **Generated text arrives within the skeleton budget** (and validates) → it is the
   first and only paint of the line.
4. **Skeleton budget expires** → paint `facts.fallbackText`, and it **stands for that
   mounted state**. Generation may continue in the background up to the 3.5 s budget;
   a late (validated) result is written to the cache only — it applies to the next
   first paint (the next state change, or a later fresh mount via rule 1), never to
   the paint already on screen.

## Timing, caching, reuse

- Skeleton budget 800 ms (reader-facing, above); background generation budget ≈ 3.5 s
  (request timeout below it); both expiries resolve to the deterministic string.
- Cache (FR-022): `sessionStorage`, key = SHA-fingerprint of `(state, facts minus
  fallbackText, local_day)`. Same fingerprint → reuse without a network call; changed
  fingerprint (a state change by definition) → one regeneration. Day boundary changes the
  fingerprint (FR-019). Only **validated** text is ever cached.
- The generated text is never persisted to the database.

## Tests

- Vitest: validator against fabricated-number / fabricated-time / fabricated-band /
  exclamation / oversized outputs; fallback rendering with the provider disabled (mock
  client) — SC-004's 100% clauses. First-paint rules with fake timers: cache hit skips
  the skeleton; result inside 800 ms paints once; result after 800 ms never replaces the
  painted fallback and lands only in the cache.
- pytest (apps/api): endpoint auth, facts-only input surface, prompt registration,
  JSON-contract parse failure → non-200 + telemetry.

# Contract: Scorer JSON

## Request

Scorer calls must request JSON-object output:

```json
{
  "response_format": { "type": "json_object" }
}
```

## Valid Output

```json
{
  "band": "at_ease",
  "crisis": false
}
```

`band` enum:

- `at_ease`
- `a_little_tense`
- `tense`

`crisis`: boolean.

## Defensive Extraction

The adapter accepts only one clean object after defensive extraction:

1. Trim content.
2. If the content is a JSON object, parse it.
3. Otherwise extract the first balanced `{...}` object from the content.
4. Reject if parsing fails, extra required keys are missing, enum values are invalid, or `crisis` is not boolean.
5. Retry malformed output according to the orchestration contract.

Hidden reasoning or prose must never appear in user-visible text or persisted scorer data.

## Use By Call Site

- Per-message scorer: uses `band` for live turn handling and `crisis` for live crisis panel triggering. It does not persist per-message band/crisis.
- Rollup scorer: returns the same shape for prompt compatibility, but 011 reads and persists only `band`; `crisis` is discarded and must not drive the panel.


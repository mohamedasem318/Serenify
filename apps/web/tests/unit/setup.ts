import "@testing-library/jest-dom/vitest";

// The validated env module (lib/env/*) parses process.env at import time and
// throws on missing/malformed values (slice 4 Finding 1 — fail-fast at boot).
// Unit tests run without a real .env, so seed schema-valid placeholders here,
// before any module under test imports an env binding. Values are dummy: a
// valid localhost URL and JWT-length (>=100 char) filler keys. `??=` leaves any
// real value (e.g. from CI) untouched.
const DUMMY_KEY = "x".repeat(120);
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= DUMMY_KEY;

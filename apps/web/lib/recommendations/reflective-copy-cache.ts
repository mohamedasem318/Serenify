/**
 * Feature 014 — the reflective-copy session cache (T022; spec FR-019/FR-022;
 * `contracts/reflective-copy.md` §Timing, caching, reuse).
 *
 * One job: a state that has not changed never regenerates (FR-022), and a new day never
 * reuses yesterday's sentence (FR-019). Storage is `sessionStorage` — per tab, cleared
 * when the tab closes. **Nothing here ever reaches the database**: generated copy is a
 * rendering detail, not a record, and the only tables this feature writes are
 * `recommendation_picks` rows written elsewhere.
 *
 * ── Two invariants this module owns, not its callers ─────────────────────────────────
 *
 * **Only VALIDATED text is ever cached.** `writeCachedReflectiveCopy` validates before it
 * stores and returns whether it stored — a caller cannot cache a fabrication even by
 * mistake, because the validation is on this side of the door. `readCachedReflectiveCopy`
 * validates again on the way out: `sessionStorage` is writable by anyone with devtools
 * open, and a cache read that skipped validation would be a way around SC-004.
 *
 * **It never throws.** Storage can be absent (server render), disabled, or full (Safari
 * private mode throws on `setItem`). The reflective line is decoration over a
 * deterministic string that is already correct, so every failure here degrades to "cache
 * miss" and the card carries on.
 *
 * ── Why the key is canonical JSON and not a SHA ──────────────────────────────────────
 * The contract calls the key a "SHA-fingerprint". A real SHA in the browser means
 * `crypto.subtle.digest`, which is **async** — and the first-paint rule this cache serves
 * is "cache hit paints immediately, no skeleton" (contract §First paint rule 1). An async
 * key would make the hit path a microtask behind first paint, which is the one thing the
 * rule forbids. So the fingerprint is the canonical serialisation itself: deterministic,
 * synchronous, and injective (no hash collision can ever serve one state's sentence for
 * another's). Same guarantee, strictly stronger, one round trip cheaper.
 */

import {
  type ReflectiveFacts,
  validateReflectiveCopy,
} from "@/lib/recommendations/reflective-copy-validation";

/**
 * Namespaced and versioned. The version moves when the FACTS SHAPE or the validator
 * changes, so a tab holding a session from before a deploy cannot serve text that the new
 * rules would have rejected.
 */
export const REFLECTIVE_COPY_CACHE_PREFIX = "serenify.014.reflective-copy.v1:";

/**
 * The fingerprinted material: `(state, facts minus fallbackText, local_day)`.
 *
 * `fallbackText` is excluded because it is *derived* from the other fields — including it
 * would add nothing and would couple the key to the deterministic builders' wording, so a
 * pure copy edit would silently invalidate every live tab's cache.
 */
function fingerprint(facts: ReflectiveFacts, localDay: string): string {
  // Built as an explicit tuple, not `JSON.stringify(object)`: object key order is a
  // property of how the object was CONSTRUCTED, and a caller spreading fields in a
  // different order must not produce a different key for the same state.
  return JSON.stringify([
    facts.state,
    facts.checkinCount,
    facts.times,
    facts.bandLabels,
    facts.triedItemTitle ?? null,
    facts.triedAtLabel ?? null,
    localDay,
  ]);
}

/** The full `sessionStorage` key for one (state, facts, day). Exported for tests. */
export function reflectiveCopyCacheKey(facts: ReflectiveFacts, localDay: string): string {
  return REFLECTIVE_COPY_CACHE_PREFIX + fingerprint(facts, localDay);
}

/**
 * `sessionStorage`, or `null` where there isn't one. Accessing the property itself can
 * throw (some privacy modes), which is why even the lookup is guarded.
 */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * The cached sentence for this exact state/day, or `null` on a miss.
 *
 * Re-validates before returning, so tampered or stale-shaped storage reads as a miss
 * rather than as text to paint.
 */
export function readCachedReflectiveCopy(
  facts: ReflectiveFacts,
  localDay: string,
): string | null {
  const store = storage();
  if (store === null) return null;

  let raw: string | null = null;
  try {
    raw = store.getItem(reflectiveCopyCacheKey(facts, localDay));
  } catch {
    return null;
  }
  if (raw === null || raw.length === 0) return null;

  return validateReflectiveCopy(raw, facts).ok ? raw : null;
}

/**
 * Store one generated sentence, if it validates against the facts it was generated from.
 *
 * Returns `true` when the text was validated and stored, `false` when it was rejected or
 * storage was unavailable. A `false` is never an error the reader sees — the caller
 * already has the deterministic string.
 */
export function writeCachedReflectiveCopy(
  text: string,
  facts: ReflectiveFacts,
  localDay: string,
): boolean {
  if (!validateReflectiveCopy(text, facts).ok) return false;

  const store = storage();
  if (store === null) return false;

  try {
    store.setItem(reflectiveCopyCacheKey(facts, localDay), text);
    return true;
  } catch {
    // Quota exceeded or storage disabled mid-session. The line still paints; it just
    // regenerates next time.
    return false;
  }
}

/**
 * Drop every entry this cache owns, leaving other `sessionStorage` keys alone. Used by
 * tests; also a safe hand-hold if a session ever needs a clean slate.
 */
export function clearReflectiveCopyCache(): void {
  const store = storage();
  if (store === null) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key !== null && key.startsWith(REFLECTIVE_COPY_CACHE_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    // Nothing to clean up we can reach.
  }
}

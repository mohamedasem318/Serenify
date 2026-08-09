"use client";

import { useSyncExternalStore } from "react";

import {
  ANCHOR_BANNER_DISMISS_KEY,
  broadcastAnchorBannerDismissed,
} from "@/lib/auth-broadcast";

/**
 * The session-scoped dismissal shared by the two anchor prompts — the calibration
 * banner (no anchor yet) and the recalibration prompt (anchor exists, capture has
 * moved on since).
 *
 * EXTRACTED, NOT REIMPLEMENTED. Every line here was `calibration-banner.tsx`'s own
 * module-level store; the banner now consumes this hook and its behaviour is
 * unchanged. The second surface needed exactly the same semantics — hide for this
 * auth session, come back on the next sign-in, stay hidden across sibling tabs — and
 * a copy of a subtle storage protocol is a copy that drifts.
 *
 * ONE KEY FOR BOTH SURFACES, deliberately. `app/(authed)/app/page.tsx` renders the
 * banner only when `hasAnchor === false` and the prompt only when `hasAnchor === true`,
 * so they are mutually exclusive per user and a shared key can never attribute one
 * surface's dismissal to the other. Sharing it is what makes sign-out clearing
 * (`clearAnchorBannerDismissal`) and the cross-tab mirror in `cross-tab-auth.tsx`
 * apply to the new surface for free, rather than growing a second parallel mechanism.
 *
 * Storage split (unchanged from the banner): the dismissal itself lives in
 * sessionStorage — per tab, surviving that tab's refreshes — while the cross-tab
 * signal travels on a separate localStorage key, because `storage` events only fire
 * across documents for localStorage.
 */

// Same-tab subscribers (sessionStorage writes don't emit a `storage` event in the
// writing tab). The `storage` listener is what picks up the cross-tab dismissal
// mirror that cross-tab-auth performs (sessionStorage write + synthetic
// StorageEvent), so both surfaces react in sibling tabs even though each tab has
// its own sessionStorage.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  return sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY) === "1";
}

/**
 * Record the dismissal for this auth session and tell sibling tabs.
 *
 * Exported as a bare function rather than returned from the hook so non-React call
 * sites (and tests) can drive it directly; the hook's subscribers are notified
 * either way via the module-level `listeners` set.
 */
export function dismissAnchorPrompt(): void {
  sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
  listeners.forEach((notify) => notify());
  // ST-17 fix 2026-05-28: propagate the dismissal to sibling tabs so the prompt
  // hides everywhere this user is signed in (Mohamed: same session, same intent —
  // see auth-broadcast.ts). Same-tab effects are still owned by the sessionStorage
  // write above; this only adds the cross-tab signal.
  broadcastAnchorBannerDismissed();
}

/**
 * `true` once the prompt has been dismissed for this auth session.
 *
 * The server snapshot pretends "dismissed" so SSR + initial hydration render nothing
 * (📌 ST-11 fix 2026-05-28). Without this, a dismissed user refreshing the page sees
 * the surface FLASH in (server renders it visible) and then vanish once the client
 * reads sessionStorage. A small post-hydration pop-in for non-dismissed users is the
 * accepted trade-off — the alternative is a visible flash on every refresh. The
 * trade-off is even more favourable for a modal than it was for the banner: a modal
 * that flashes over the dashboard on every refresh is far worse than one that arrives
 * a frame late.
 */
export function useAnchorPromptDismissed(): boolean {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => true, // server snapshot: render nothing, reveal post-hydration
  );
}

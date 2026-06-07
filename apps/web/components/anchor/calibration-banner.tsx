"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  ANCHOR_BANNER_DISMISS_KEY,
  broadcastAnchorBannerDismissed,
} from "@/lib/auth-broadcast";

// Same-tab subscribers (sessionStorage writes don't emit a `storage` event in
// the writing tab). The `storage` listener is what picks up the cross-tab
// dismissal mirror that cross-tab-auth performs (sessionStorage write +
// synthetic StorageEvent), so the banner reacts in sibling tabs even though
// each tab has its own sessionStorage.
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

function dismiss(): void {
  sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
  listeners.forEach((notify) => notify());
  // ST-17 fix 2026-05-28: propagate the dismissal to sibling tabs so the
  // banner hides everywhere this user is signed in (Mohamed: same session,
  // same intent — see auth-broadcast.ts). Same-tab effects are still owned
  // by the sessionStorage write above; this only adds the cross-tab signal.
  broadcastAnchorBannerDismissed();
}

/**
 * Calibration prompt on /app for an employee with no stored anchor (FR-021).
 * Dismissal is session-only (FR-023) — it reappears next session until the
 * anchor is captured (FR-024). Foggy — a "needs your attention, not stress"
 * state (FR-043) — never amber or red; calm voice (Principle V). The render
 * site (/app) already gates this to employees, so this component is unconditional.
 *
 * The server snapshot pretends "dismissed" so SSR + initial hydration render
 * nothing (📌 ST-11 fix 2026-05-28). Without this, a dismissed user refreshing
 * the page sees the banner FLASH in (server renders it visible) and then
 * vanish once the client reads sessionStorage. A small post-hydration pop-in
 * for non-dismissed users is the accepted trade-off — the alternative is a
 * visible flash that users notice on every refresh until they calibrate.
 *
 * Sign-out clears the dismissal (via auth-broadcast.ts → broadcastSignOut +
 * cross-tab-auth's signout branch) so the next sign-in re-shows the banner —
 * sessionStorage by itself would survive sign-out/sign-in within one tab.
 */
export function CalibrationBanner() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => true, // server snapshot: render nothing, reveal post-hydration
  );

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Calibration"
      className="rounded-control border border-foggy/50 bg-foggy/10 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink">
          Stress detection isn&apos;t active yet — it needs about a minute of calibration to
          know what your calm looks like.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* Plain <a> (NOT next/link) — a full document navigation is REQUIRED
              so /app/calibrate loads with its own `camera=(self)` Permissions-
              Policy. Next App Router's client-side <Link> navigation never
              reloads the document, so the active PP stays /app's `camera=()`
              and getUserMedia is rejected with "Permissions policy violation".
              Same idiom as the Router Cache hard-nav fix (DECISIONS 2026-05-27).
              See docs/CHANGELOG.md 2026-05-28. */}
          {/* FOGGY-filled CTA (dark/ink text) — the same `variant="foggy"` shipped
              on the failure-state and camera-access screens (FR-043). This surface
              is "attention, not affirmative-forward", so it is foggy, NOT meadow;
              white/ink-fill would fail AA on the foggy wash. */}
          <Button asChild variant="foggy" className="h-11">
            <a href="/app/calibrate">Set baseline</a>
          </Button>
          <Button variant="ghost" className="h-11" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

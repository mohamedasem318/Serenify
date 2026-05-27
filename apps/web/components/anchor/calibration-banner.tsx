"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "serenify-anchor-banner-dismissed";

// Same-tab subscribers (sessionStorage writes don't emit a `storage` event in
// the writing tab) plus cross-tab `storage` propagation. useSyncExternalStore
// keeps this hydration-safe (server snapshot = not dismissed) and lint-clean.
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
  return sessionStorage.getItem(DISMISS_KEY) === "1";
}

function dismiss(): void {
  sessionStorage.setItem(DISMISS_KEY, "1");
  listeners.forEach((notify) => notify());
}

/**
 * Calibration prompt on /app for an employee with no stored anchor (FR-021).
 * Dismissal is session-only (FR-023) — it reappears next session until the
 * anchor is captured (FR-024). Amber, never red; calm voice (Principle V).
 */
export function CalibrationBanner() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false, // server snapshot: render visible, reconcile on the client
  );

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Calibration"
      className="rounded-control border border-amber/50 bg-amber/10 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink">
          Stress detection isn&apos;t active yet — it needs about a minute of calibration to
          know what your calm looks like.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild className="h-11">
            <Link href="/app/calibrate">Take a minute to calibrate</Link>
          </Button>
          <Button variant="ghost" className="h-11" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

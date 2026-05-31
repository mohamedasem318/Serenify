"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Back-forward cache (bfcache) restore re-sync (authed surfaces).
 *
 * When the browser restores a page from bfcache — `pageshow` with `event.persisted`
 * true, e.g. pressing the browser Back button from the full-document calibration flow
 * into `/app` — the page comes back FROZEN: Server Components don't re-run and the
 * client tree isn't re-evaluated. So `/app` shows a stale tree: most visibly the
 * calibration banner stays hidden (its `useSyncExternalStore` reveal never re-fires;
 * only a manual refresh shows it), and the header/theme toggle can look stale.
 *
 * We re-sync WITHOUT a full reload via `router.refresh()` — the SAME targeted
 * mechanism the cross-tab anchor listener already uses on `/app`
 * (cross-tab-auth.tsx): it re-runs the route's Server Components (re-reading
 * `has_anchor`, so the banner conditional re-evaluates) and re-renders the client
 * tree (the banner store snapshot + the header/theme toggle), preserving scroll and
 * client state. The anti-flash banner behaviour (server snapshot → client reveal) and
 * 004's cross-tab sync are untouched.
 *
 * Strictly guarded on `event.persisted` — a real bfcache restore. Normal/fresh loads
 * (persisted false) are never refreshed.
 */
export function BfcacheRefresh(): null {
  const router = useRouter();

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) router.refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return null;
}

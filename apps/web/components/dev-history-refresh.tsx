"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * DEV-ONLY re-sync of the authed tree after a browser Back / Forward.
 *
 * In `next dev`, Next HARDCODES `Cache-Control: no-cache, must-revalidate` on every
 * page document and discards any computed value (`base-server.js` — "In dev, we should
 * not cache pages for any reason"), so `no-store` cannot be set from the proxy,
 * next.config, or a route segment config. Browsers then serve `/app` from the DISK
 * cache on a Back, frozen at the server-rendered state — most visibly the calibration
 * banner reflects a stale `has_anchor` until a manual refresh revalidates.
 *
 * A disk-cache Back is a FRESH document load (the JS re-executes), so
 * `pageshow.persisted` is `false` — which is exactly why a bfcache (`persisted`)
 * handler never fired here. The reliable signal is the Navigation Timing entry's
 * `type === "back_forward"`: when this document was reached via history navigation, we
 * re-sync the server tree with a targeted `router.refresh()` (re-runs the route's
 * Server Components → re-reads `has_anchor`, preserving scroll + client state — the
 * same mechanism the cross-tab anchor listener uses on `/app`).
 *
 * PRODUCTION IS UNAFFECTED, and this is a TRUE no-op there. The dev branch above never
 * runs in a prod build, where `/app` is `force-dynamic` (revalidate 0) and Next emits
 * `private, no-cache, no-store, max-age=0, must-revalidate` (`lib/cache-control.js`) —
 * so Back revalidates on its own. The `process.env.NODE_ENV !== "development"` guard is
 * a literal Next inlines at build time, so the whole effect body is dead-code-eliminated
 * from the production bundle: no navigation read, no refresh, no redundant refetch on a
 * prod back-navigation. The stale-banner-after-Back is therefore a Next DEV-ONLY
 * artifact, not a production bug — see docs/CHANGELOG.md 2026-05-31.
 */
export function DevHistoryRefresh(): null {
  const router = useRouter();

  useEffect(() => {
    // Compiled out of the production bundle (NODE_ENV is inlined → dead branch).
    if (process.env.NODE_ENV !== "development") return;
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entry?.type === "back_forward") router.refresh();
  }, [router]);

  return null;
}

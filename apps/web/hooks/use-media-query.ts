"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe matchMedia hook.
 *
 *   useMediaQuery("(min-width: 768px)") → boolean
 *
 * Returns `false` during SSR (and on the first client render before
 * the store resolves) — matches the server's "no viewport knowledge"
 * default and prevents hydration mismatch. After mount,
 * useSyncExternalStore queries `matchMedia(query).matches`,
 * subscribes to the `change` event, and re-renders on viewport
 * transitions.
 *
 * Built on useSyncExternalStore (React's recommended pattern for
 * sync-with-external-state) rather than useState + useEffect because
 * the latter trips react-hooks/set-state-in-effect — calling
 * setState synchronously inside an effect to seed initial external
 * state is exactly the cascading-render anti-pattern that rule
 * catches.
 *
 * Used by:
 *   - components/notification.tsx (Step 8 / T051) for desktop /
 *     mobile variant gating.
 *   - any future component that needs runtime viewport awareness
 *     beyond what Tailwind's responsive classes can express.
 *
 * Not used by the header / center nav / chat pill — those gate
 * visibility via Tailwind responsive utilities which are SSR-safe
 * without a hook.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => {
        mql.removeEventListener("change", onChange);
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

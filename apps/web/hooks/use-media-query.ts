"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe matchMedia hook.
 *
 *   useMediaQuery("(min-width: 768px)") → boolean
 *
 * Returns `false` during SSR and on the first client render. After
 * mount, the first effect queries `matchMedia(query).matches` and
 * subscribes to its `change` event, flipping the state to the real
 * value and tracking subsequent viewport changes.
 *
 * The deliberate "false during SSR + first client render" choice
 * prevents hydration mismatch: the server can't know the viewport,
 * so any value other than false would risk diverging from the
 * client. Consumers should design their default-state UI to be
 * correct at `false` — e.g. the notification component renders its
 * desktop slide-in variant when `useMediaQuery("(max-width: 768px)")`
 * is false, which matches what the SSR pass would produce.
 *
 * Used by:
 *   - components/notification.tsx (Step 8 / T051)
 *   - any future component that needs runtime viewport awareness
 *     beyond what Tailwind's responsive classes can express
 *
 * Not used by the header / center nav / chat pill — those gate
 * visibility via Tailwind responsive utilities which are SSR-safe
 * without a hook.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
}

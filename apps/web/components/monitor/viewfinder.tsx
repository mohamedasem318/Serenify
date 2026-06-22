"use client";

import { cn } from "@/lib/utils";

/**
 * The peek/pin self-view (feature 008 — T031 US1 + T040 US2). A small preview in the stage
 * corner that the camera pill peeks (`peek` — pointer-hover or keyboard focus) or pins (click).
 * It shows the live self-view (`children` = the orchestrator's persistent `<video>`, which the
 * face detector also reads) under **framing graphics only** — corner brackets, NEVER any words
 * on the raw video (FR-023; all status copy lives in the cards below).
 *
 * 008-followups: the peek reveal is now driven by an explicit `peek` prop (orchestrator state)
 * instead of CSS `group-hover` / `group-focus-within`. The old `group-focus-within` kept the
 * preview open after a mouse CLICK left the pill focused, so an un-pinned preview wouldn't
 * auto-hide on hover-out; the prop hides the moment the pointer leaves while still revealing
 * for keyboard focus.
 *
 * Out-of-frame (US2): the viewfinder is **force-revealed** (no hover needed) so the user can
 * re-centre, and the brackets turn FOGGY (attention) instead of meadow — the same "lost
 * sight of you" cue the foggy prompt carries. The container is always mounted so the
 * detector keeps reading the feed and can auto-resume the moment a face returns.
 */

export function Viewfinder({
  pinned,
  peek = false,
  outOfFrame = false,
  children,
}: {
  pinned: boolean;
  /** Reveal on pointer-hover / keyboard focus of the pill (auto-hides on leave/blur). */
  peek?: boolean;
  /** US2: force the preview open + foggy brackets while auto-paused out of frame. */
  outOfFrame?: boolean;
  children: React.ReactNode;
}) {
  // Foggy while out of frame (attention), the steady meadow framing otherwise.
  const bracket = outOfFrame ? "border-foggy/90" : "border-meadow/90";
  const revealed = pinned || peek || outOfFrame;
  // Interactive only when pinned or force-revealed out of frame; a hover/focus peek is a
  // glance, not a target (and must not capture the pointer).
  const interactive = pinned || outOfFrame;
  return (
    <div
      data-pinned={pinned || undefined}
      data-oof={outOfFrame || undefined}
      aria-hidden={!pinned && !outOfFrame}
      className={cn(
        "absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-border shadow-soft sm:w-56",
        "transition-opacity duration-200 motion-reduce:transition-none",
        revealed ? "opacity-100" : "opacity-0",
        interactive ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div className="relative aspect-video bg-ink/80">
        {/* the live self-view — graphics only sit on it, never words */}
        {children}
        {/* corner brackets (framing graphics only); foggy when out of frame */}
        <span className={cn("pointer-events-none absolute left-2 top-2 size-5 rounded-tl-md border-l-2 border-t-2 transition-colors", bracket)} />
        <span className={cn("pointer-events-none absolute right-2 top-2 size-5 rounded-tr-md border-r-2 border-t-2 transition-colors", bracket)} />
        <span className={cn("pointer-events-none absolute bottom-2 left-2 size-5 rounded-bl-md border-b-2 border-l-2 transition-colors", bracket)} />
        <span className={cn("pointer-events-none absolute bottom-2 right-2 size-5 rounded-br-md border-b-2 border-r-2 transition-colors", bracket)} />
      </div>
    </div>
  );
}

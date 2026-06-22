"use client";

import { cn } from "@/lib/utils";

/**
 * The peek/pin self-view (feature 008 — T031 US1 + T040 US2). A small preview in the stage
 * corner that the camera pill peeks (group-hover / focus) or pins (click). It shows the live
 * self-view (`children` = the orchestrator's persistent `<video>`, which the face detector
 * also reads) under **framing graphics only** — corner brackets, NEVER any words on the raw
 * video (FR-023; all status copy lives in the cards below).
 *
 * Out-of-frame (US2): the viewfinder is **force-revealed** (no hover needed) so the user can
 * re-centre, and the brackets turn FOGGY (attention) instead of meadow — the same "lost
 * sight of you" cue the foggy prompt carries. The container is always mounted so the
 * detector keeps reading the feed and can auto-resume the moment a face returns.
 */

export function Viewfinder({
  pinned,
  outOfFrame = false,
  children,
}: {
  pinned: boolean;
  /** US2: force the preview open + foggy brackets while auto-paused out of frame. */
  outOfFrame?: boolean;
  children: React.ReactNode;
}) {
  // Foggy while out of frame (attention), the steady meadow framing otherwise.
  const bracket = outOfFrame ? "border-foggy/90" : "border-meadow/90";
  return (
    <div
      data-pinned={pinned || undefined}
      data-oof={outOfFrame || undefined}
      aria-hidden={!pinned && !outOfFrame}
      className={cn(
        "absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-border shadow-soft sm:w-56",
        "opacity-0 transition-opacity duration-200",
        "pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100",
        "data-[pinned]:pointer-events-auto data-[pinned]:opacity-100",
        // Out-of-frame: always visible, the user must see themselves to re-centre.
        "data-[oof]:pointer-events-auto data-[oof]:opacity-100",
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

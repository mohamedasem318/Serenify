"use client";

import { cn } from "@/lib/utils";

/**
 * The peek/pin self-view (feature 008, US1 — T031). A small preview in the stage corner
 * that the camera pill peeks (group-hover / focus) or pins (click). It shows the live
 * self-view (`children` = the orchestrator's persistent `<video>`, which the face
 * detector also reads) under **framing graphics only** — corner brackets, NEVER any
 * words on the raw video (FR-023; all status copy lives in the cards below).
 *
 * The container is always mounted so the detector keeps reading the feed; only its
 * opacity toggles (peek/pin), matching the mock. Drift-reactive brackets and the
 * out-of-frame treatment are US2 — here the brackets are the steady meadow framing.
 */

export function Viewfinder({
  pinned,
  children,
}: {
  pinned: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-pinned={pinned || undefined}
      aria-hidden={!pinned}
      className={cn(
        "absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-border shadow-soft sm:w-56",
        "opacity-0 transition-opacity duration-200",
        "pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100",
        "data-[pinned]:pointer-events-auto data-[pinned]:opacity-100",
      )}
    >
      <div className="relative aspect-video bg-ink/80">
        {/* the live self-view — graphics only sit on it, never words */}
        {children}
        {/* corner brackets (framing graphics only) */}
        <span className="pointer-events-none absolute left-2 top-2 size-5 rounded-tl-md border-l-2 border-t-2 border-meadow/90" />
        <span className="pointer-events-none absolute right-2 top-2 size-5 rounded-tr-md border-r-2 border-t-2 border-meadow/90" />
        <span className="pointer-events-none absolute bottom-2 left-2 size-5 rounded-bl-md border-b-2 border-l-2 border-meadow/90" />
        <span className="pointer-events-none absolute bottom-2 right-2 size-5 rounded-br-md border-b-2 border-r-2 border-meadow/90" />
      </div>
    </div>
  );
}

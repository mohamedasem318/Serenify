"use client";

import { useState } from "react";

import { TeamCards } from "@/components/landing/team-cards";
import { TeamPhoto } from "@/components/landing/team-photo";
import {
  TEAM_CAPTION,
  TEAM_HEADING,
  TEAM_SUB,
  TEAM_SUPERVISORS,
  TEAM_SUPERVISORS_LABEL,
} from "@/lib/landing/copy";
import { type TeamKey } from "@/lib/landing/team-silhouettes";

/**
 * The team section (feature 013, US4 — T124 and T125; FR-024, FR-025, FR-027, FR-052).
 *
 * Variant A: a full-width photograph with four name cards beneath it. Not
 * photo-left/cards-right — at 320 px a side-by-side split gives the photo about 150 px
 * and the outlines stop being legible, which is the interaction the section exists for.
 *
 * FR-052: the photograph sits in a plain bordered container. No device frame, no
 * simulated browser chrome, nothing drawn around it — it is a real photograph and is
 * presented as one.
 *
 * ── THE STATE MODEL ──────────────────────────────────────────────────────────────────
 *
 * Two pieces, deliberately separate:
 *
 *  · `pinned`   — what the visitor CHOSE, by activating a card or an outline. Survives
 *                 the pointer leaving. This is what `aria-pressed` reports, and it is
 *                 what makes the mapping obtainable without hover (FR-028, SC-009).
 *  · `previewed`— what the pointer or focus is passing over. Transient, and never
 *                 written to `aria-pressed`.
 *
 * `active = previewed ?? pinned` drives every visual highlight, which is what makes the
 * relationship BIDIRECTIONAL (FR-025) without any second code path: pointing at an
 * outline previews its card, and activating a card highlights its outline, because both
 * directions read the same value.
 *
 * ── WHY THE CAPTION AND CREDITS ARE SIBLINGS OF THE PHOTO ────────────────────────────
 *
 * ST-14. If the image fails to load, the four names, the eight links, the caption and
 * the supervisor credits are still there and still usable, because none of them is
 * inside the photo's container. The `<figure>` groups the photo with its caption
 * semantically without nesting the caption in the element that can fail.
 */

export function TeamSection() {
  const [pinned, setPinned] = useState<TeamKey | null>(null);
  const [previewed, setPreviewed] = useState<TeamKey | null>(null);

  const active = previewed ?? pinned;

  /** Activating the person who is already pinned clears the pin, so it is escapable. */
  const toggle = (key: TeamKey) => setPinned((current) => (current === key ? null : key));

  return (
    <section id="team" className="border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          {TEAM_HEADING}
        </h2>
        <p className="mt-3 max-w-prose text-base text-muted">{TEAM_SUB}</p>

        <figure className="mt-8">
          <TeamPhoto active={active} onPreview={setPreviewed} onSelect={toggle} />
          <figcaption className="mt-2.5 text-xs text-muted">{TEAM_CAPTION}</figcaption>
        </figure>

        <div className="mt-5">
          <TeamCards
            active={active}
            pinned={pinned}
            onPreview={setPreviewed}
            onToggle={toggle}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-border pt-4">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            {TEAM_SUPERVISORS_LABEL}
          </span>
          <span className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">
            {TEAM_SUPERVISORS.join(" · ")}
          </span>
        </div>
      </div>
    </section>
  );
}

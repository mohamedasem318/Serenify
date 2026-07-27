import Image from "next/image";

import { TEAM_PHOTO_ALT } from "@/lib/landing/copy";
import { TEAM_KEYS, TEAM_SILHOUETTES, type TeamKey } from "@/lib/landing/team-silhouettes";
import { cn } from "@/lib/utils";

/**
 * The team photograph and its silhouette overlay (feature 013, US4 — T121).
 *
 * ── THREE CONSTRAINTS HERE ARE CORRECTNESS, NOT STYLE ────────────────────────────────
 *
 *  1. `next/image` with explicit `width={1600} height={1164}` plus `h-auto w-full`. Per
 *     `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` the
 *     width/height props are the INTRINSIC size and "do not determine the rendered size",
 *     which CSS controls; `width: 100%` + `height: auto` is the documented responsive
 *     recipe (§ "Responsive images with a remote URL"). The rendered element therefore
 *     occupies the full inline width of its container at the source's exact 1600:1164
 *     ratio, at every width. THAT is what makes the box below an exact-aspect box, and
 *     the overlay aligns only because it is.
 *
 *  2. `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`. The `SIL` coordinates
 *     are normalised to the 1600×1164 crop, so the 0–100 square must be stretched onto
 *     the box rather than letterboxed into it. Any other `preserveAspectRatio` value —
 *     including the browser default `xMidYMid meet` — reintroduces letterboxing and
 *     shifts every outline off its person (`contracts/public-surface.md` §9.2). This is
 *     not a preference and must not be "fixed".
 *
 *  3. `vector-effect: non-scaling-stroke` on every stroked path. It follows directly
 *     from (2): the 0–100 square is scaled ×16 horizontally and ×11.64 vertically, so a
 *     scaled stroke would be visibly thicker on vertical edges than on horizontal ones.
 *     Non-scaling-stroke keeps the outline an even weight in CSS pixels.
 *
 * ── WHY THE OVERLAY IS `aria-hidden` ─────────────────────────────────────────────────
 *
 * The name cards are the accessible route to the mapping (FR-028, SC-009). Exposing the
 * four outlines as well would put every person in the tab order twice and read out four
 * more controls that say the same thing the cards already say. The outlines carry
 * pointer handlers only — the photo → card direction of FR-025 — and are unreachable by
 * keyboard on purpose. Nothing here is the only route to any information.
 *
 * ── WHAT NO TEST IN THIS REPO CAN TELL YOU ───────────────────────────────────────────
 *
 * Whether an outline actually lands on a person. jsdom has no layout and no photograph;
 * `toBeInTheDocument()` passes on a completely misaligned overlay. Alignment is verified
 * by eye at 320/375/414/768 px, and IDENTITY — which human is which name — is ST-7.
 */

type TeamPhotoProps = {
  /** The person currently highlighted, pinned or previewed. `null` dims nothing. */
  readonly active: TeamKey | null;
  /** Pointer enters/leaves an outline — a transient preview. */
  readonly onPreview: (key: TeamKey | null) => void;
  /** Pointer activates an outline — the photo → card direction (FR-025). Persists. */
  readonly onSelect: (key: TeamKey) => void;
};

export function TeamPhoto({ active, onPreview, onSelect }: TeamPhotoProps) {
  return (
    // `overflow-hidden` clips the photo to the rounded corner. It is safe here — unlike
    // the P6 panels — because the SVG is `inset-0` on the same box the image fills and
    // every path COORDINATE is inside the 0–100 viewBox.
    //
    // The strokes are not, and the distinction matters: the glow is 7 CSS px wide with
    // `non-scaling-stroke`, so 3.5 px sits either side of the path, and the lowest points
    // (y = 99.91) leave only ~1.2–1.6 px of headroom. About 2 px of the glow's outer edge
    // is therefore flat-clipped along the bottom, at every width, for every person. That
    // is intentional and invisible — but do not reuse "the coordinates are inside the
    // viewBox" as a reason some OTHER overhang is safe. It is not the same claim.
    <div className="relative overflow-hidden rounded-card border border-border bg-surface leading-none">
      <Image
        src="/team/serenify-team-2026.jpg"
        alt={TEAM_PHOTO_ALT}
        width={1600}
        height={1164}
        // Measured, not guessed: the rendered width is the viewport minus the section's
        // `px-4 sm:px-6` below 1024 px, and 974 px inside the `max-w-5xl` container above
        // it — never `100vw`, never a full `64rem`. Declaring either over-fetches a
        // larger `/_next/image` candidate than the layout can ever use.
        sizes="(min-width: 64rem) 61rem, calc(100vw - 2rem)"
        className="h-auto w-full"
      />

      {/*
       * The dim veil. It is the page background at low opacity rather than a scrim, so
       * it reads as "the rest of the photo has stepped back" in both themes, and it
       * needs no colour token that does not already exist. It sits BELOW the outlines so
       * the highlighted person's edge stays at full strength.
       */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-bg transition-opacity duration-300",
          active ? "opacity-[0.28]" : "opacity-0",
        )}
      />

      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {TEAM_KEYS.map((key) => {
          const on = active === key;
          return (
            <g key={key}>
              {/*
               * The glow: a wider, semi-transparent stroke of the same outline sitting
               * under the crisp one. This is a token-only substitute for the mock's
               * `drop-shadow(… color-mix(…))`, which would have needed a raw colour
               * value — no new token is invented anywhere in this section.
               */}
              <path
                d={TEAM_SILHOUETTES[key]}
                fill="none"
                fillRule="evenodd"
                strokeWidth={7}
                strokeLinejoin="round"
                className={cn(
                  "stroke-meadow [vector-effect:non-scaling-stroke] transition-opacity duration-300",
                  on ? "opacity-25" : "opacity-0",
                )}
              />
              <path
                d={TEAM_SILHOUETTES[key]}
                fill="none"
                fillRule="evenodd"
                strokeWidth={2.2}
                strokeLinejoin="round"
                className={cn(
                  "stroke-meadow [vector-effect:non-scaling-stroke] transition-opacity duration-300",
                  on ? "opacity-100" : "opacity-0",
                )}
              />
              {/*
               * The hit area. `fill="transparent"` rather than `fill="none"`, because
               * `none` does not receive pointer events and the whole body — not just its
               * 2 px edge — has to be tappable on a phone.
               *
               * DELIBERATELY `nonzero`, unlike the two stroked paths above. `mohamed` and
               * `fatma` each carry a second subpath for the gap between their legs; under
               * `evenodd` that subpath becomes a HOLE, and taps landing in it — a region
               * roughly a third of `mohamed`'s height — would hit nothing at all. The
               * stroked paths keep `evenodd` because there the gap should be drawn; the
               * hit area wants the silhouette solid. The mock used `evenodd` for both,
               * which is the bug this avoids rather than a fidelity constraint: FR-026
               * freezes the path DATA, and the `d` attribute here is byte-identical.
               */}
              <path
                d={TEAM_SILHOUETTES[key]}
                fill="transparent"
                fillRule="nonzero"
                className="pointer-events-auto cursor-pointer"
                onPointerEnter={() => onPreview(key)}
                onPointerLeave={() => onPreview(null)}
                onClick={() => onSelect(key)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

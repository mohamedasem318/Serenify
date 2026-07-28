import Link from "next/link";

import { StoryCard } from "@/components/landing/story-card";
import { Button } from "@/components/ui/button";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  HERO_DATA_LINE,
  HERO_HEADLINE_ACCENT,
  HERO_HEADLINE_LEAD,
  HERO_LEDE,
} from "@/lib/landing/copy";

/**
 * The landing hero (feature 013, US1 — T100).
 *
 * The lede is the APPROVED §10.3 Position 1 string and the data-handling line beneath it
 * is FR-005's — both from `lib/landing/copy.ts`, with no inline literal anywhere in this
 * file. The two CTA labels are fixed by FR-020 and are not re-worded: "Get started"
 * (meadow-filled) and "See how it works" (outlined). The mock's primary read "Create an
 * account"; FR-020 fixes the label, not the destination.
 *
 * SINGLE COLUMN UNTIL `lg`, DELIBERATELY. The obvious two-column hero would put the story
 * card in a half-width column at 768 px, giving it LESS room than it gets at 414 px in one
 * column — which would make 768 px the binding case for the narration row rather than the
 * comfortable one. The card needs width more than the page needs a diptych.
 *
 * Both CTAs are centred on mobile and neither label wraps at 320 px (FR-053); `size="lg"`
 * is 44 px tall, and the button component already carries the app's focus ring (FR-055).
 *
 * ── SCALE RESTORED TO THE MOCK (2026-07-28) ───────────────────────────────────────────
 *
 * P6 shipped this section a size or two under the signed-off mock at every knob at once —
 * a 1024 px container against the mock's 1120, a 30/38 px headline against its
 * clamp(34, 5.6vw, 56), semibold against its bold, and a 448 px card column against its
 * 520 — and the compounding is why the hero read small rather than merely tight. The
 * headline uses a `clamp()` because the mock does: it is the one place on the page where
 * type should track the viewport rather than step at a breakpoint, and stepping was part
 * of what made the top of the page feel flat. `clamp()` is a CSS function, not a design
 * token, so nothing new is registered (FR-057).
 *
 * The lg breakpoint is KEPT rather than moved to the mock's 980 px: the single-column
 * reasoning above still holds, and 1024 is the token the rest of the page steps at.
 */
export function Hero() {
  return (
    <section className="mx-auto w-full max-w-[70rem] px-4 pt-14 pb-20 sm:px-6">
      <div className="flex flex-col gap-9 lg:flex-row lg:items-center lg:gap-13">
        <div className="lg:flex-1">
          <h1
            className="font-display leading-[1.06] font-bold tracking-tight text-ink"
            style={{ fontSize: "clamp(2.125rem, 5.6vw, 3.5rem)" }}
          >
            {HERO_HEADLINE_LEAD} <span className="text-meadow-text">{HERO_HEADLINE_ACCENT}</span>
          </h1>

          <p className="mt-5 max-w-prose text-base leading-relaxed text-muted">{HERO_LEDE}</p>

          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="meadow" size="lg" className="w-full sm:w-auto">
              <Link href="/signup">{CTA_PRIMARY}</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link href="#how-it-works">{CTA_SECONDARY}</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted">{HERO_DATA_LINE}</p>
        </div>

        <div className="w-full lg:max-w-[32.5rem] lg:flex-1">
          <StoryCard />
        </div>
      </div>
    </section>
  );
}

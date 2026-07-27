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
 */
export function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-10 pb-14 sm:px-6 sm:pt-14">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="lg:flex-1">
          <h1 className="font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
            {HERO_HEADLINE_LEAD} <span className="text-meadow-text">{HERO_HEADLINE_ACCENT}</span>
          </h1>

          <p className="mt-4 max-w-prose text-base leading-relaxed text-muted">{HERO_LEDE}</p>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="meadow" size="lg" className="w-full sm:w-auto">
              <Link href="/signup">{CTA_PRIMARY}</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link href="#how-it-works">{CTA_SECONDARY}</Link>
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted">{HERO_DATA_LINE}</p>
        </div>

        <div className="w-full lg:max-w-md lg:flex-1">
          <StoryCard />
        </div>
      </div>
    </section>
  );
}

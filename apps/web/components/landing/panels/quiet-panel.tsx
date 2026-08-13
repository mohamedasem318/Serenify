import { PANEL_QUIET_SINCE } from "@/lib/landing/copy";
import type { StoryBeat } from "@/lib/landing/story-script";

/**
 * The `quiet` swap panel — an ordinary stretch of a monitoring session, nothing to say
 * (feature 013, US1 — T094).
 *
 * NO FAKE DEVICE CHROME (FR-052): no browser bar, no phone frame, and specifically NO
 * SIMULATED CAMERA PREVIEW. The bars are an abstract rhythm drawn from Graphite tokens,
 * not a picture of a webcam feed — a fake preview would imply the page is showing the
 * visitor's camera, which is precisely the impression this product cannot afford to give.
 *
 * The bars carry no number and encode no reading; they are texture. The reading lives in
 * the card's permanently visible readout, once, where it can be read.
 *
 * THE BARS FOLLOW THE BAND (2026-07-28), which is the one thing texture still has to get
 * right. They were fixed at meadow, so the panel stayed green while the reading beside it
 * said "You're a little uneasy" and the sparkline had already gone amber — three parts of one
 * readout disagreeing about the same moment. Same three tokens and the same mapping the
 * trend uses (`story-trend.tsx`), so a band change moves the whole card at once. Following
 * the band is not the same as encoding a value: the bars still carry no number, and their
 * heights are unchanged and unrelated to the reading.
 */

/** Fixed heights, not random — a random walk would flicker on every render. */
const BAR_HEIGHTS = [38, 52, 30, 64, 44, 58, 34, 48, 40, 56, 32, 46];

/**
 * The band's colour at the mock's bar opacity, over the SAME tokens `story-trend.tsx`
 * uses. `color-mix` over a registered token, so nothing new is registered (FR-057), and an
 * inline style rather than a per-band `bg-…` opacity class because that class name would
 * have to be built by concatenation, and Tailwind's scanner cannot see a name it never
 * reads literally in the source.
 */
const BAR_FILL: Record<StoryBeat["band"], string> = {
  at_ease: "color-mix(in srgb, var(--color-meadow) 25%, transparent)",
  a_little_tense: "color-mix(in srgb, var(--amber-soft-line) 28%, transparent)",
  tense: "color-mix(in srgb, var(--color-amber) 30%, transparent)",
};

export function QuietPanel({ band }: { band: StoryBeat["band"] }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div aria-hidden className="flex h-full items-end gap-1 pb-3">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-sm"
            style={{
              height: `${height}%`,
              background: BAR_FILL[band],
              transition: "background 1.2s ease",
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted">{PANEL_QUIET_SINCE}</p>
    </div>
  );
}

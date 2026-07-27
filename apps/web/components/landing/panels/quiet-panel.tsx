import { PANEL_QUIET_SINCE } from "@/lib/landing/copy";

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
 */

/** Fixed heights, not random — a random walk would flicker on every render. */
const BAR_HEIGHTS = [38, 52, 30, 64, 44, 58, 34, 48, 40, 56, 32, 46];

export function QuietPanel() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div aria-hidden className="flex h-full items-end gap-1 pb-3">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-sm bg-meadow/25"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted">{PANEL_QUIET_SINCE}</p>
    </div>
  );
}

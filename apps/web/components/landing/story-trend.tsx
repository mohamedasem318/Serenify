import type { StoryBeat } from "@/lib/landing/story-script";
import { STORY_BEATS } from "@/lib/landing/story-script";

/**
 * The readout's TREND — the third part of the permanently visible readout, alongside the
 * orb and the reading label (FR-007; `contracts/landing-hero-story.md` §9.1; T093).
 *
 * WHAT IT PLOTS. The bands of the beats up to and including the current one — the story's
 * own reading history, not invented data. That is the same thing the mock's `.trend` SVG
 * did with its per-beat `trendTarget`, expressed from the script instead of from a
 * hand-tuned number per beat, so it cannot drift out of step with the band the readout is
 * simultaneously naming in words.
 *
 * IT CARRIES NO NUMBER AND NO AXIS. The line's shape is the only information, and the
 * reading label directly beside it carries the meaning in words — so nothing here exists
 * only as a graphic (SC-009), and there is no figure to mistake for a score (FR-004).
 *
 * THREE MARKS, NOT ONE — band, line, dot. P6 shipped the line alone in a fixed ~80 px
 * column pinned to the card's right edge; the mock draws a filled band beneath the line
 * and caps it with a dot ringed in the card's own background, across the full width of the
 * reading column. The band is what makes the shape readable at 34 px tall, and the ring is
 * what keeps the dot legible where it sits on top of the band. The data is unchanged.
 *
 * COLOUR COMES FROM EXISTING GRAPHITE TOKENS ONLY. `--amber-soft-line` is the repo's
 * documented "a little tense" graph-line value, so the three states reuse exactly what the
 * live monitor's graph already uses rather than inventing a landing-only palette (FR-057,
 * `plan.md` §0.7 — no new token). The band tints are `color-mix` over those same tokens at
 * the mock's percentages, which introduces no new named colour.
 */

/** Vertical position per band. Higher strain sits higher, as on the monitor's axis. */
const BAND_Y: Record<StoryBeat["band"], number> = {
  at_ease: 26,
  a_little_tense: 17,
  tense: 7,
};

const BAND_STROKE: Record<StoryBeat["band"], string> = {
  at_ease: "var(--color-meadow)",
  a_little_tense: "var(--amber-soft-line)",
  tense: "var(--color-amber)",
};

/** The mock's `.trend-band` fills, at its percentages, over the same three tokens. */
const BAND_FILL: Record<StoryBeat["band"], string> = {
  at_ease: "color-mix(in srgb, var(--color-meadow) 11%, transparent)",
  a_little_tense: "color-mix(in srgb, var(--amber-soft-line) 13%, transparent)",
  tense: "color-mix(in srgb, var(--color-amber) 14%, transparent)",
};

/*
 * 320×34 IS THE MOCK'S VIEWBOX AND THE WIDTH IS LOAD-BEARING, NOT COSMETIC.
 * `preserveAspectRatio="none"` stretches the box to the element, which is what lets the
 * trend be fluid at a fixed 34 px height — and it stretches the DOT with it. At the 120
 * viewBox P6 used, a ~400 px render scaled x by 3.3 and the dot would have drawn as a flat
 * ellipse. At 320 the horizontal scale sits near 1 across every width the card occupies, so
 * the dot stays round, exactly as it does in the mock.
 */
const VIEW_W = 320;
const VIEW_H = 34;

export function StoryTrend({ beatIndex }: { beatIndex: number }) {
  const history = STORY_BEATS.slice(0, beatIndex + 1);
  const current = history[history.length - 1] ?? STORY_BEATS[0]!;

  /*
   * THE STRIP ALWAYS SPANS THE FULL WIDTH, AND THAT IS THE FIDELITY FIX.
   *
   * P6 laid the beats out from x=0 rightward, so early on the line was a stub: at beat 2 it
   * covered 40 of 320 units — about an eighth of the strip — with bare background either
   * side of it, which is nothing like the mock's readout. The mock draws a ROLLING WINDOW
   * that is full from the first frame and scrolls leftward as time passes.
   *
   * The history is therefore left-padded with the band the story OPENS on, and the newest
   * reading always sits at the right edge under the dot. The padding is not invented data —
   * beat 0 is "at ease", so a flat at-ease run before the story starts is the same claim the
   * readout is making in words next to it — and it is what lets the line read as a reading
   * over time rather than as a chart being drawn.
   */
  const step = VIEW_W / Math.max(1, STORY_BEATS.length - 1);
  const padded = [
    ...Array.from({ length: STORY_BEATS.length - history.length }, () => STORY_BEATS[0]!),
    ...history,
  ];
  const points = padded.map((beat, index) => [index * step, BAND_Y[beat.band]] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y}`).join(" ");
  // The band closes the line down to the baseline and back, exactly as the mock does.
  const lastX = points[points.length - 1]![0];
  const band = `${line} L ${lastX.toFixed(2)} ${VIEW_H} L 0 ${VIEW_H} Z`;
  const [dotX, dotY] = points[points.length - 1]!;

  return (
    <svg
      data-testid="story-trend"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden
      className="h-[2.125rem] w-full overflow-visible"
    >
      <path
        d={band}
        fill={BAND_FILL[current.band]}
        stroke="none"
        style={{ transition: "fill 1.2s ease" }}
      />
      <path
        d={line}
        fill="none"
        stroke={BAND_STROKE[current.band]}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ transition: "stroke 1.2s ease" }}
      />
      {/*
       * Ringed in the card's own background so the dot stays legible where it lands on top
       * of the band. `--color-surface` IS the card's background — the mock called the same
       * value `--stage-bg`.
       */}
      <circle
        cx={dotX.toFixed(2)}
        cy={dotY}
        r="3"
        fill={BAND_STROKE[current.band]}
        stroke="var(--color-surface)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        style={{ transition: "fill 1.2s ease" }}
      />
    </svg>
  );
}

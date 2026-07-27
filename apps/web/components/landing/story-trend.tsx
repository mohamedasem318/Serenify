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
 * COLOUR COMES FROM EXISTING GRAPHITE TOKENS ONLY. `--amber-soft-line` is the repo's
 * documented "a little tense" graph-line value, so the three states reuse exactly what the
 * live monitor's graph already uses rather than inventing a landing-only palette (FR-057,
 * `plan.md` §0.7 — no new token).
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

const VIEW_W = 120;
const VIEW_H = 34;

export function StoryTrend({ beatIndex }: { beatIndex: number }) {
  const history = STORY_BEATS.slice(0, beatIndex + 1);
  const current = history[history.length - 1] ?? STORY_BEATS[0]!;

  // Spread the whole script across the width so the line advances left-to-right as the
  // story plays, rather than rescaling under its own feet on every beat.
  const step = VIEW_W / Math.max(1, STORY_BEATS.length - 1);
  const points = history.map((beat, index) => `${(index * step).toFixed(2)},${BAND_Y[beat.band]}`);
  const last = points[points.length - 1]!.split(",");

  return (
    <svg
      data-testid="story-trend"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden
      className="h-6 w-full"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={BAND_STROKE[current.band]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ transition: "stroke 1.3s ease" }}
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={BAND_STROKE[current.band]} />
    </svg>
  );
}

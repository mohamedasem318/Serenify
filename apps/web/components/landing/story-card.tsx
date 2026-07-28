"use client";

import { Bloom } from "@/components/monitor/bloom";
import { ChapterMarkers } from "@/components/landing/chapter-markers";
import { QuietPanel } from "@/components/landing/panels/quiet-panel";
import { PromptPanel } from "@/components/landing/panels/prompt-panel";
import { RenPanel } from "@/components/landing/panels/ren-panel";
import { ResolvedPanel } from "@/components/landing/panels/resolved-panel";
import { StoryTrend } from "@/components/landing/story-trend";
import type { ThreadMessage } from "@/components/landing/ren-thread";
import { useStoryClock } from "@/components/landing/use-story-clock";
import type { BloomTone } from "@/components/monitor/use-monitoring-session";
import { BAND_LABEL } from "@/lib/bands";
import { NARRATION, READOUT_HEADING, READOUT_WINDOW_LABEL, STORY_CARD_LABEL } from "@/lib/landing/copy";
import {
  STORY_BEATS,
  THREAD_CAP,
  type StoryBeat,
  type StoryPanel,
  beatAt,
  firstBeatIndexOfChapter,
  trimThread,
} from "@/lib/landing/story-script";
import { cn } from "@/lib/utils";

/**
 * The hero story card (feature 013, US1 — T093; `contracts/landing-hero-story.md` §9.1).
 *
 * THREE REGIONS INSIDE ONE BOX THAT NEVER CHANGES SIZE:
 *
 *   READOUT    — permanently visible at every beat and under reduced motion (FR-007)
 *   NARRATION  — FIXED height, never a min-height (FR-009)
 *   SWAP AREA  — position:relative + explicit height; four panels on absolute inset-0
 *
 * THE ABSOLUTE POSITIONING IS THE ANTI-CLIPPING MECHANISM AND FLOW LAYOUT IS NOT AN
 * ACCEPTABLE SUBSTITUTE. An absolutely positioned panel is out of flow, so it cannot push
 * the card's box no matter how tall its content grows; the swap area's explicit height is
 * what fixes the box. In flow, the tallest panel would set the height and every panel
 * change would move everything below it — which is the exact drift T107 measures to zero.
 * `overflow-hidden` on BOTH the card and the swap area guarantees no internal scrollbar
 * at any width.
 *
 * THE NARRATION ROW IS TWO LINES BELOW 768 px AND ONE LINE AT AND ABOVE IT — fixed at
 * every width, never content-dependent, so FR-009's guarantee (content changing cannot
 * move anything below it) holds unchanged. This is an amendment to `plan.md` §10.3's
 * "must not wrap at 320px" and to T107's one-line assertion, approved by Mohamed on
 * 2026-07-27 after measurement: the approved closing beat needs 379.8 px at
 * `--text-xs` — the smallest token that exists — against roughly 260 px of card at a
 * 320 px viewport, and still overflows with zero padding. The copy is approved and fixed
 * (FR-032); the layout rule was written without measuring. Single-line strings are
 * vertically centred so the ten shorter beats do not hang off the top of the row.
 * Recorded in `docs/DECISIONS.md`.
 *
 * THE NARRATION IS `--text-xs` AT EVERY WIDTH, AND THE ABSENCE OF A `md:` STEP IS THE FIX,
 * NOT AN OVERSIGHT. P6 stepped it to `--text-base` (17 px) at `md`, which has no
 * counterpart in the mock — the mock's `.vo` is 12.5 px at every width. The step was
 * measured only where the hero is ONE column and the card is therefore full width; at
 * `lg` the card becomes a ~520 px column, the 17 px closing beat needs more room than that,
 * and it wrapped to two lines inside the one-line row and was sliced in half by
 * `overflow-hidden`. Measured 2026-07-28: 51 px of text in a 25.5 px row at 1024, 1280 and
 * 1440. `tests/layout/landing-hero-stability.spec.ts` now measures 1280 and asserts the
 * narration fits its row; both were added red against the old size.
 */

/** Which Bloom tone renders a band. The orb's own vocabulary, mapped once. */
const BAND_TONE: Record<StoryBeat["band"], BloomTone> = {
  at_ease: "ease",
  a_little_tense: "little",
  tense: "tense",
};

const PANELS: readonly StoryPanel[] = ["quiet", "prompt", "resolved", "ren"];

/**
 * WHETHER THIS BEAT IS REN'S — the mock's `talk` mood, and FR-022's blue state.
 *
 * FR-022 makes Ren's blue orb on the landing page a deliberate, approved liberty that
 * "MUST NOT be corrected" to the monitor's band colouring. P6 implemented it only on the
 * small avatar inside the Ren panel; the hero readout's own orb and trend kept rendering
 * the strain band, so through the whole conversation the card still read amber while Ren
 * was speaking. That is the requirement going unmet, not a new decision — and the hook for
 * it already existed: `Bloom`'s `color` prop was added by T082 for exactly this, and its
 * docstring names `var(--color-foggy)` as the value. Nothing about `bloom.tsx` changes.
 */
function isRenBeat(beat: StoryBeat): boolean {
  return beat.panel === "ren";
}

/**
 * The reading label's colour, which is the mock's `.reading-v` mood rule expressed from the
 * script rather than from a `data-mood` attribute the app does not have.
 *
 * The mock had four moods; three of them are recoverable from the beat. `calm` is the
 * at-ease band, `rising`/`tense` are the two strained bands and share `--amber-text`, and
 * `talk` is exactly "the Ren panel is showing" — which is why the panel is checked before
 * the band. Every value is an existing Graphite token (FR-057).
 */
function readingTone(beat: StoryBeat): string {
  if (isRenBeat(beat)) return "text-foggy";
  return beat.band === "at_ease" ? "text-ink" : "text-amber-text";
}

/**
 * The thread as of a beat, replayed from the script rather than accumulated in state.
 *
 * Derivation beats accumulation here: a chapter marker can jump to any beat at any time,
 * and a thread built up by mutation would show whatever happened to be left over from the
 * path taken to get there. Replaying makes every beat's thread a pure function of its
 * index, so the same beat always looks the same however it was reached.
 */
function threadAt(beatIndex: number): readonly ThreadMessage[] {
  let messages: ThreadMessage[] = [];
  for (let i = 0; i <= beatIndex; i++) {
    const op = beatAt(i).threadOp;
    if (!op) continue;
    if (op.kind === "clear") messages = [];
    else if (op.kind === "restart") messages = [{ from: op.from, messageKey: op.messageKey }];
    else messages = [...messages, { from: op.from, messageKey: op.messageKey }];
  }
  return trimThread(messages, THREAD_CAP);
}

export function StoryCard() {
  const { index, goTo, containerRef, reducedMotion } = useStoryClock(STORY_BEATS);
  const beat = beatAt(index);
  const messages = threadAt(index);

  return (
    <div className="flex flex-col gap-3">
      <section
        ref={containerRef}
        data-testid="story-card"
        // The beat index, exposed so the layout spec can step deterministically through
        // all 17 beats. Narration repeats across beats (five share one line), so text
        // changes are not a reliable beat signal and polling would silently skip beats.
        data-beat={index}
        aria-label={STORY_CARD_LABEL}
        className="overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-soft sm:p-5"
      >
        {/* ── READOUT — permanently visible, every beat, reduced motion included ── */}
        <div data-testid="story-readout" className="flex items-center gap-3 sm:gap-4">
          <Bloom
            tone={BAND_TONE[beat.band]}
            // FR-022: Ren's beats are blue, through the prop rather than a landing-only orb.
            color={isRenBeat(beat) ? "var(--color-foggy)" : undefined}
            className="size-12 shrink-0 sm:size-12"
          />
          {/*
           * The trend sits UNDER the reading label inside this column, spanning its full
           * width, which is where the mock puts it — not in a fixed narrow column pinned to
           * the card's right edge. `min-w-0` is what lets the column actually shrink so the
           * trend can be fluid instead of squeezing the label.
           */}
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] uppercase tracking-wide text-muted">
              {READOUT_HEADING}
            </p>
            <p
              data-testid="story-reading"
              className={cn(
                "font-display text-xl leading-tight font-semibold transition-colors duration-1000 sm:text-2xl",
                readingTone(beat),
              )}
            >
              {BAND_LABEL[beat.band]}
            </p>
            <p className="truncate text-[0.6875rem] text-muted">{READOUT_WINDOW_LABEL}</p>
            {/* The third part of the readout (FR-007): orb, reading label, AND trend. */}
            <div className="mt-2.5">
              <StoryTrend beatIndex={index} />
            </div>
          </div>
        </div>

        {/* ── NARRATION — FIXED height (2 lines < md, 1 line ≥ md). Never min-height. ── */}
        <div
          data-testid="story-narration-row"
          className="mt-4 flex h-[2.275rem] items-center overflow-hidden md:h-[1.1375rem]"
        >
          <p data-testid="story-narration" className="text-xs leading-[1.4] text-ink">
            {NARRATION[beat.narrationKey]}
          </p>
        </div>

        {/* ── SWAP AREA — relative + explicit height; four absolute panels ── */}
        <div
          data-testid="story-swap"
          className="relative mt-3 h-[20.5rem] overflow-hidden md:h-[16.5rem]"
        >
          {PANELS.map((panel) => {
            const isActive = panel === beat.panel;
            return (
              <div
                key={panel}
                data-panel={panel}
                data-active={isActive ? "true" : undefined}
                aria-hidden={!isActive}
                inert={!isActive}
                className={cn(
                  "absolute inset-0 overflow-hidden",
                  /*
                   * The neutral ground is the DEFAULT, not a universal. The prompt panel
                   * draws its own tinted box on the same `inset-0` footprint (the mock's
                   * `.panel.prompt`), so giving it this one too would nest a border and a
                   * padding inside its own. Positioning stays on the wrapper for every
                   * panel, which is what the out-of-flow assertion in
                   * `tests/layout/landing-hero-stability.spec.ts` measures.
                   */
                  panel === "prompt" ? "" : "rounded-md border border-border bg-bg p-3",
                  isActive ? "opacity-100" : "pointer-events-none opacity-0",
                  // Opacity only, and only when motion is welcome. Nothing that moves.
                  reducedMotion ? "" : "transition-opacity duration-500",
                )}
              >
                {panel === "quiet" && <QuietPanel band={beat.band} />}
                {panel === "prompt" && <PromptPanel highlight={beat.highlight} />}
                {panel === "resolved" && <ResolvedPanel />}
                {panel === "ren" && <RenPanel messages={messages} reducedMotion={reducedMotion} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Outside the card, so the focus ring is never clipped by its overflow-hidden. */}
      <ChapterMarkers
        activeChapter={beat.chapter}
        onSelect={(chapter) => {
          const target = firstBeatIndexOfChapter(chapter);
          if (target >= 0) goTo(target);
        }}
      />
    </div>
  );
}

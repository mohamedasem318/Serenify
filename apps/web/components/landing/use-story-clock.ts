"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { beatAt, type StoryBeat } from "@/lib/landing/story-script";

/**
 * The story's advance / pause mechanism (feature 013, US1 — T097, T098; FR-012, FR-013).
 *
 * ONE `setTimeout` CHAIN, NOT A `setInterval` AND NOT ONE TIMER PER BEAT. Each beat arms
 * exactly one timer for its own duration and that timer arms the next. An interval cannot
 * express beats of different lengths, and pre-scheduling seventeen timers makes pausing a
 * matter of cancelling seventeen things instead of one.
 *
 * REDUCED MOTION COMES FROM THE REPO HOOK, AND THAT IS LOAD-BEARING.
 * `useMediaQuery("(prefers-reduced-motion: reduce)")` is built on `useSyncExternalStore`
 * and RE-SUBSCRIBES to the media query. framer-motion's `useReducedMotion` snapshots at
 * mount and does not, so a visitor who toggles the OS setting mid-session would keep
 * watching an animation they just asked to stop — ST-5 tests exactly that, on a real
 * device, long after CI went green. `bloom.tsx:5` already models the correct choice.
 * The absence of the framer import is asserted by T099.
 *
 * Under reduced motion NO TIMER IS ARMED at all — not a slower one, not a paused one.
 * The chapter markers stay fully functional so a visitor can step through deliberately,
 * which is what keeps the story readable rather than merely frozen.
 *
 * NO BROWSER STORAGE (FR-051) — the rule is named rather than the APIs, because the guard
 * in `tests/unit/lib/legal/no-web-storage.test.ts` is a plain substring scan that reads
 * comments too, and it caught this comment on its first run. A "remember which beat they
 * were on" convenience is the obvious thing to add to a clock, and it is exactly what
 * that guard exists to stop.
 */

/**
 * Where a reduced-motion visitor starts: the beat where the system stops and asks.
 *
 * Not beat 0. Under reduced motion nothing advances, so the single rendered beat is the
 * whole story for anyone who does not touch the chapter markers — and "a normal morning,
 * nothing to report" would show them a product that does nothing. This beat shows the
 * behaviour the page is about.
 */
export const REPRESENTATIVE_BEAT_INDEX = 2;

export interface StoryClock {
  /** The beat currently on screen. */
  readonly index: number;
  /** Jump to a beat (the chapter markers). Works under reduced motion too. */
  readonly goTo: (index: number) => void;
  /** Attach to the element whose visibility drives pause/resume. */
  readonly containerRef: (node: HTMLElement | null) => void;
  /** True when the OS asks for reduced motion. Callers drop transitions on it. */
  readonly reducedMotion: boolean;
  /** True while a timer is armed. Exposed so tests can assert "no timer armed". */
  readonly running: boolean;
}

export function useStoryClock(beats: readonly StoryBeat[]): StoryClock {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasDeliveredFirstEntry = useRef(false);
  /** Set once the story has ticked or the visitor has used a marker. */
  const hasProgressed = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      hasProgressed.current = true;
      setIndex(((next % beats.length) + beats.length) % beats.length);
    },
    [beats.length],
  );

  /**
   * Pause off-screen — ONE IntersectionObserver, with the repo's known gotcha handled.
   *
   * The observer delivers an initial SYNCHRONOUS entry on `observe()` reflecting current
   * visibility. Acting on it would pause a story that had never started, or resume one
   * that was already running, purely as an artefact of mounting. The first callback is
   * therefore discarded and only real scroll transitions drive pause/resume.
   *
   * IT FAILS SAFE. A missing node, no IntersectionObserver at all, or an entry whose
   * measured height is 0 — a collapsed or not-yet-laid-out box — is treated as VISIBLE
   * and the story keeps playing. A story frozen forever because a ref was null is worse
   * than one that runs off-screen.
   */
  const containerRef = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    hasDeliveredFirstEntry.current = false;

    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!hasDeliveredFirstEntry.current) {
        hasDeliveredFirstEntry.current = true;
        return;
      }
      const entry = entries[entries.length - 1];
      if (!entry || entry.boundingClientRect.height === 0) {
        setInView(true);
        return;
      }
      setInView(entry.isIntersecting);
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  /**
   * Under reduced motion, land on the representative beat — but ONLY before anything has
   * happened. `useMediaQuery` returns false during SSR and on the first client render,
   * so this runs once as the real value resolves. Guarding on `hasProgressed` is what
   * stops a MID-SESSION toggle from yanking a visitor who is already watching back to
   * beat 2: ST-5 expects the story to stop where it is, not to jump.
   */
  useEffect(() => {
    if (reducedMotion && !hasProgressed.current) {
      setIndex(REPRESENTATIVE_BEAT_INDEX);
    }
  }, [reducedMotion]);

  /**
   * The chain. One timer, re-armed per beat.
   *
   * Resuming after a scroll-away re-arms the CURRENT beat for its full duration rather
   * than advancing — so coming back does not jump, and does not double-advance by firing
   * a stale timer alongside the new one (ST-6). The cleanup guarantees at most one live
   * timer at any moment.
   */
  const running = !reducedMotion && inView;

  useEffect(() => {
    if (!running || beats.length === 0) return;

    const timer = setTimeout(() => {
      hasProgressed.current = true;
      setIndex((current) => (current + 1) % beats.length);
    }, beatAt(index, beats).durationMs);

    return () => clearTimeout(timer);
  }, [running, index, beats]);

  return { index, goTo, containerRef, reducedMotion, running };
}

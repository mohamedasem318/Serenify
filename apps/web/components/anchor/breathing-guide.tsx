"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The breathing guide (feature 005, FR-015/016) — the focal graphic ON the softened
 * preview. The stepped "Breathe in" / "Breathe out" pacer lives ON the orb so
 * attention stays in one place; the controls card below keeps the timer, drift
 * nudge, reassurance, and Stop. It is not a progress indicator — the 60-second timer
 * is the sole progress.
 *
 * The readable backing is kept SEPARATE from the breath so the heavy/opaque part
 * stays small and calm (the earlier single opaque core read as a large, bright,
 * hard disc). Layers, back to front:
 *  - FROST — a localized "light frost" SEAT for the pool, so the dim pool never
 *    depends on what the camera sees (bright face, dark room, busy background). A
 *    stronger LOCAL backdrop blur (on top of the preview's 2px) flattens the feed
 *    into a smooth, low-detail surface; a gentle desaturate + slight lift keep it a
 *    calm NEUTRAL light — deliberately NOT a dark vignette (the earlier dark seating
 *    read heavy/clinical). A faint flat white veil is a guaranteed light floor over a
 *    dark feed (and the light-scrim fallback if backdrop-filter is unavailable). A
 *    radial MASK feathers the whole thing to nothing at the rim — no disc edge — and
 *    keeps it LOCAL to the orb; the rest of the preview stays at 2px. Static (only
 *    the pool breathes).
 *  - ORB_GLOW — a soft, dim, translucent, feathered pool of light (no hard edge, no
 *    "coin"): the ONLY animated layer, gently expanding on the 4s inhale and
 *    contracting on the 6s exhale. Kept small so it leaves clear space to the framing
 *    brackets (no crowding).
 *  - TEXT_BACKING — a SMALL, FIXED, feathered backing (opaque only through a small
 *    centre, dim pale-meadow, feathered to nothing — no hard circle) sized to back
 *    the longest label ("Breathe out") with padding. It does NOT scale, so the words
 *    always sit fully on it, never on raw camera content.
 *  - the label — fixed size, centred, never scales while the glow breathes behind it.
 *
 * Text-vs-backing contrast (ink/bg over the opaque backing centre, a known fixed
 * surface): ≈ 7.0:1 light, ≈ 10.0:1 dark — past the AA floor. The dim pale sage reads
 * calm, not glaring. Orb appearance over a real feed is a manual smoke check.
 */

const PHASE_LABEL = { in: "Breathe in", out: "Breathe out" } as const;

// FROST — the pool's light seat. A stronger LOCAL blur flattens the live feed into a
// smooth, low-detail surface so the dim pool reads on ANY feed (bright/dark/busy);
// saturate↓ mutes a colourful background so it doesn't fight the meadow; brightness↑
// is a gentle neutral lift (a frost lightens — never a dark vignette). The flat white
// VEIL is a guaranteed light floor over a dark feed AND the graceful fallback if
// backdrop-filter is unavailable. The MASK feathers blur + veil together to nothing
// at the rim (no disc edge) and keeps it local to the orb.
const FROST_FILTER = "blur(8px) saturate(0.85) brightness(1.04)";
const FROST_VEIL = "rgba(255, 255, 255, 0.1)"; // flat; the mask shapes & feathers it
const FROST_MASK = "radial-gradient(circle, #000 0%, #000 42%, transparent 84%)";

// Soft, dim, translucent pool — feathered fully to transparent at the rim (no edge).
const ORB_GLOW =
  "radial-gradient(circle, " +
  "color-mix(in srgb, var(--color-meadow) 26%, transparent) 0%, " +
  "color-mix(in srgb, var(--color-meadow) 14%, transparent) 55%, " +
  "transparent 100%)";
// Small fixed backing — dim pale-meadow, opaque only through a small centre (backs
// the words) then feathered to nothing. text-ink / dark:text-bg reads dark on it.
const TEXT_BACKING =
  "radial-gradient(circle, " +
  "color-mix(in srgb, var(--color-meadow) 70%, white) 0%, " +
  "color-mix(in srgb, var(--color-meadow) 70%, white) 80%, " +
  "color-mix(in srgb, var(--color-meadow) 48%, transparent) 92%, " +
  "transparent 100%)";

export function BreathingOrb() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<"in" | "out">("in");

  // The breath pacer (BOTH the animated and reduced-motion paths): swap the label on
  // the 4s-in / 6s-out cadence with an instant content swap (FR-048). On the animated
  // path the glow scales on the same cadence; under reduced motion the glow is held
  // at a fixed mid-size and the label cadence alone carries the pace.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (current: "in" | "out") => {
      // hold the inhale for 4s, the exhale for 6s, then swap (instant, no tween)
      timer = setTimeout(
        () => {
          if (cancelled) return;
          const next = current === "in" ? "out" : "in";
          setPhase(next);
          schedule(next);
        },
        current === "in" ? 4000 : 6000,
      );
    };
    // initial render already shows the inhale (useState "in"); just start the loop
    schedule("in");
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative grid size-36 place-items-center sm:size-44">
      {/* frost seat — a localized, fully-feathered light frost (stronger LOCAL blur +
          gentle neutral lift) so the dim pool has a consistent low-detail surface to
          read against on ANY feed. Static (only the pool breathes); no hard edge; the
          rest of the preview stays at 2px. */}
      <div
        aria-hidden
        className="absolute size-32 rounded-full sm:size-40"
        style={{
          background: FROST_VEIL,
          backdropFilter: FROST_FILTER,
          WebkitBackdropFilter: FROST_FILTER,
          maskImage: FROST_MASK,
          WebkitMaskImage: FROST_MASK,
        }}
      />

      {/* the breath — a soft, dim pool that gently expands (inhale) / contracts
          (exhale); the only animated layer. Held at a fixed mid-size under reduced
          motion. Kept small so it leaves clear space to the framing brackets. */}
      {reducedMotion ? (
        <div
          aria-hidden
          className="absolute size-32 rounded-full sm:size-40"
          style={{ background: ORB_GLOW, transform: "scale(0.85)" }}
        />
      ) : (
        <motion.div
          aria-hidden
          className="absolute size-32 rounded-full sm:size-40"
          style={{ background: ORB_GLOW }}
          initial={{ scale: 0.7 }}
          animate={{ scale: [0.7, 1, 0.7] }}
          // 10s cycle: 0→40% = 4s inhale, 40→100% = 6s exhale (FR-016)
          transition={{ duration: 10, times: [0, 0.4, 1], repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* small fixed feathered backing — the words always sit fully on it */}
      <div aria-hidden className="absolute size-28 rounded-full" style={{ background: TEXT_BACKING }} />

      {/* the pacer label — fixed size, centred, NEVER scales. Dark text in both modes
          (the backing is pale-meadow in both): text-ink / dark:text-bg. */}
      <p
        aria-live="polite"
        className="absolute text-center text-sm font-semibold tracking-wide text-ink dark:text-bg"
      >
        {PHASE_LABEL[phase]}
      </p>
    </div>
  );
}

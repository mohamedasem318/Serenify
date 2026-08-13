import type { Band } from "@/lib/api/monitoring-client";

/**
 * The ONE human-readable label per band (feature 013, US1 — T080; FR-015).
 *
 * Two consumers, one literal set: the live monitor's trend axis
 * (`lib/session-trend-geometry.ts`, `axisFor()`) and the landing page's story-card
 * readout. That is precisely "sourced from the app's existing band definitions rather
 * than restated as new literals" — before this module the axis inlined the three
 * strings and the landing page would have had to re-type them.
 *
 * The `Band` import is TYPE-ONLY and deliberately so. `monitoring-client.ts` eagerly
 * reads `clientEnv` at import time; a value import would drag that into every Vitest
 * run that touches a label. A type import is erased at compile time, so this module
 * has no runtime dependency at all — nothing from `server-only`, no env, no client.
 *
 * The strings are fixed by `contracts/landing-hero-story.md` §9.1. Changing one changes
 * the monitor's axis and the landing readout together, which is the point.
 */
export const BAND_LABEL: Record<Band, string> = {
  tense: "Tense",
  a_little_tense: "Uneasy",
  at_ease: "Calm",
};

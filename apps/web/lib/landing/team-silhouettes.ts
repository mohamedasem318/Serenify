/**
 * The four team-photo silhouette outlines (feature 013, US4 — T118; FR-026).
 *
 * COPIED CHARACTER-FOR-CHARACTER from `docs/mockups/serenify-landing-mock.html`
 * (~line 671, the `const SIL={…}` literal). FR-026 forbids re-deriving, re-tracing,
 * reformatting, or regenerating these strings by any means — they are already derived
 * and verified, and a "harmless" reformat is a silent geometry change. The mock is
 * gitignored, so reading it needs `rg --no-ignore` or an explicit `*.html` scope; a
 * default `rg` sees nothing (`plan.md` §10.1).
 *
 * The coordinates are normalised to the 1600×1164 crop and are consumed under
 * `viewBox="0 0 100 100"` with `preserveAspectRatio="none"` over an exact-aspect box
 * (`contracts/public-surface.md` §9.2). That combination is a CORRECTNESS constraint,
 * not a style choice: any other `preserveAspectRatio` value reintroduces letterboxing
 * and shifts every path off its person.
 *
 * ── THE MAPPING, AND HOW IT WAS VERIFIED ─────────────────────────────────────────────
 *
 * Left to right in the photograph: `mohamed`, `fatma`, then the project poster, then
 * `hebatullah` and `gehad`. Three independent checks agree:
 *
 *  1. The x-ranges are strictly ascending in exactly that order —
 *       mohamed     0.34 → 21.84   (leftmost)
 *       fatma      22.16 → 40.59   (second)
 *       hebatullah 64.91 → 81.47   (INNER right, the person wearing glasses)
 *       gehad      79.47 → 97.78   (OUTER right, rightmost)
 *     The gap between 40.59 and 64.91 is the poster standing between the two pairs.
 *  2. That order matches FR-024's required left-to-right card order.
 *  3. It matches the mock's own `TEAM` array (`:807–812`), which pairs the same keys
 *     with the same positions.
 *
 * **It is NOT reversed** (`plan.md` §0.2): `hebatullah` is the inner-right outline and
 * `gehad` is the outer-right one, not the other way round.
 *
 * ── THE ST-7 RESIDUAL ────────────────────────────────────────────────────────────────
 *
 * Points 1–3 prove the data is **internally consistent and geometrically correct**. They
 * **cannot** catch a mis-labelling made at tracing time that would be wrong in both the
 * `SIL` keys and FR-024 together — the two would simply agree with each other and with
 * the x-ordering while both pointing at the wrong human.
 *
 * **No artefact in this repository establishes which human being is which name.** That
 * single fact is a **human check, not an automatable one** — smoke test **ST-7**, where
 * Mohamed confirms the inner-right outline highlights **Hebatullah** and the outer-right
 * highlights **Gehad**.
 *
 * The frozen-path test (T119) guards the strings and their ordering. It proves nothing
 * about whether an outline lands on the right person; only ST-7 can.
 */

/** The four people, in FR-024's fixed left-to-right order. */
export const TEAM_KEYS = ["mohamed", "fatma", "hebatullah", "gehad"] as const;

export type TeamKey = (typeof TEAM_KEYS)[number];

/**
 * SVG path data, one closed outline per person, in the `viewBox="0 0 100 100"` space.
 * Pure `M`/`L`/`Z` polylines. `mohamed` and `fatma` carry a second subpath (the gap
 * between the legs), which is why the rendered paths need `fill-rule="evenodd"`.
 */
export const TEAM_SILHOUETTES: Readonly<Record<TeamKey, string>> = {
  mohamed:
    "M 1.84 99.91 L 1.84 92.44 L 2.47 85.91 L 3.09 82.73 L 3.09 80.67 L 3.34 79.04 L 3.34 78.09 L 2.72 76.46 L 2.84 74.31 L 2.78 69.67 L 2.53 68.47 L 2.53 66.92 L 2.03 66.24 L 2.47 60.4 L 2.78 58.93 L 2.91 57.3 L 1.59 53.95 L 1.16 52.15 L 0.34 45.88 L 0.59 42.1 L 1.53 36.68 L 2.78 32.65 L 3.62 31.83 L 5.44 31.49 L 7.81 30.54 L 8.75 29.85 L 9.59 28.69 L 9.59 26.29 L 8.97 25.43 L 8.78 24.66 L 8.78 23.02 L 9.03 22.08 L 8.72 20.79 L 8.66 18.81 L 9.03 17.53 L 9.44 16.97 L 10.44 16.28 L 11.44 15.94 L 12.44 15.94 L 13.88 16.45 L 15.19 17.74 L 15.59 18.56 L 16.16 20.36 L 16.22 21.39 L 15.78 23.2 L 15.84 24.31 L 15.53 26.29 L 15.03 26.89 L 14.78 27.84 L 14.72 29.64 L 15.03 30.41 L 15.69 31.06 L 18.25 32.77 L 19.5 33.12 L 19.91 33.59 L 20.03 34.54 L 20.59 35.82 L 21.16 37.97 L 21.78 42.27 L 21.84 46.13 L 21.53 47.77 L 21.16 52.66 L 20.28 54.81 L 19.03 56.7 L 18.78 57.39 L 19.59 63.06 L 19.72 65.29 L 18.72 66.49 L 18.34 69.67 L 18.09 76.8 L 17.78 77.58 L 18.09 79.47 L 18.03 81.62 L 18.28 83.08 L 18.47 93.81 L 18.28 95.19 L 17.41 97.42 L 17.41 97.77 L 18.22 98.63 L 18.34 99.91 Z M 14.34 99.91 L 13.78 95.88 L 13.78 93.56 L 13.41 90.64 L 13.28 85.05 L 13.09 83.08 L 12.53 79.9 L 12.16 75.86 L 11.59 73.45 L 11.47 71.56 L 11.03 68.9 L 10.88 68.69 L 10.59 69.16 L 9.66 73.63 L 9.66 74.31 L 9.34 75.09 L 8.72 80.24 L 7.78 84.45 L 7.09 91.84 L 6.66 94.33 L 6.84 96.22 L 6.78 98.02 L 6.34 99.91 Z",
  fatma:
    "M 25.41 99.91 L 25.72 96.99 L 24.97 95.79 L 24.78 95.1 L 25.28 90.72 L 25.28 89.35 L 24.78 85.82 L 24.66 83.76 L 24.34 82.82 L 24.41 76.8 L 23.97 69.5 L 23.72 68.21 L 22.16 66.75 L 22.16 65.64 L 23.47 60.74 L 24.59 57.99 L 24.78 55.67 L 24.03 51.98 L 24.09 49.74 L 24.97 43.47 L 26.09 39.52 L 26.34 37.8 L 26.59 37.11 L 27.25 36.55 L 28.31 36.21 L 29.56 36.21 L 30.25 35.87 L 30.47 35.31 L 31.16 34.45 L 30.66 33.59 L 30.34 32.39 L 30.28 27.84 L 29.97 26.98 L 29.84 25.34 L 30.19 24.7 L 30.75 24.44 L 32.25 24.36 L 33.56 23.75 L 34.38 23.75 L 34.97 24.48 L 35.84 26.98 L 37.09 33.42 L 37.28 35.14 L 38.59 37.63 L 40.59 39.86 L 40.59 47.42 L 40.47 49.05 L 39.59 54.21 L 38.78 57.22 L 39.03 59.62 L 39.28 60.57 L 39.72 64.09 L 40.22 66.15 L 40.47 68.47 L 39.88 68.94 L 39.0 69.12 L 38.53 69.76 L 38.03 74.05 L 36.84 78.78 L 36.53 81.1 L 36.28 83.85 L 36.09 92.35 L 35.47 96.05 L 35.22 96.82 L 34.66 97.51 L 33.97 99.91 Z M 29.97 96.05 L 30.78 92.01 L 30.97 84.97 L 31.16 83.33 L 30.91 79.9 L 30.91 76.63 L 30.75 75.99 L 30.59 76.03 L 30.47 76.72 L 30.53 82.04 L 29.97 86.17 L 30.22 89.78 L 30.22 93.9 L 29.72 95.36 L 29.78 96.05 L 29.97 96.05 Z",
  hebatullah:
    "M 67.47 99.91 L 66.72 95.36 L 66.53 90.29 L 66.22 87.97 L 65.72 78.87 L 65.34 76.2 L 65.47 67.18 L 65.41 66.75 L 64.91 66.07 L 64.91 64.86 L 65.59 60.82 L 65.59 58.42 L 65.28 57.3 L 65.34 54.55 L 65.03 52.58 L 65.03 51.46 L 65.34 50.43 L 65.84 49.57 L 66.09 47.08 L 66.66 45.36 L 66.53 40.89 L 66.94 40.25 L 68.38 39.05 L 70.31 37.93 L 71.72 36.43 L 71.34 35.74 L 70.91 34.19 L 70.84 31.27 L 70.53 29.81 L 71.16 28.95 L 71.53 27.66 L 72.25 26.59 L 73.31 25.64 L 74.31 25.39 L 75.25 25.39 L 76.81 26.25 L 77.66 27.49 L 78.03 28.78 L 78.22 30.84 L 78.09 34.28 L 77.09 36.6 L 77.69 37.07 L 79.44 37.5 L 81.47 38.49 L 81.34 39.43 L 80.78 40.98 L 77.53 68.64 L 77.84 71.91 L 77.22 73.54 L 76.91 74.91 L 76.28 79.73 L 76.28 82.04 L 76.59 83.85 L 76.84 86.86 L 76.84 91.75 L 77.16 92.7 L 77.66 96.65 L 78.66 98.28 L 79.09 99.91 Z",
  gehad:
    "M 82.47 99.91 L 82.16 97.16 L 81.47 83.68 L 80.66 75.6 L 80.53 71.82 L 80.19 71.26 L 79.66 70.88 L 79.47 68.64 L 82.72 40.98 L 83.38 39.05 L 84.75 38.7 L 86.84 37.03 L 85.66 35.31 L 85.03 33.68 L 84.66 31.53 L 84.59 28.95 L 85.03 27.92 L 85.94 26.85 L 86.88 26.25 L 88.06 26.07 L 89.25 26.25 L 90.25 26.93 L 90.91 27.92 L 91.47 29.38 L 92.09 31.7 L 92.41 34.02 L 92.41 36.0 L 92.22 37.63 L 94.88 39.13 L 95.88 40.25 L 97.5 41.19 L 97.78 41.67 L 97.78 50.43 L 97.47 58.08 L 96.22 63.57 L 97.16 74.83 L 96.75 75.21 L 95.0 75.21 L 94.59 75.43 L 94.34 76.03 L 93.78 80.33 L 93.59 87.11 L 93.72 92.01 L 94.28 96.65 L 94.09 99.91 Z",
} as const;

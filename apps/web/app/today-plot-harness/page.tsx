"use client";

import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { TodayTrendPlot } from "@/components/home/today-trend-plot";
import type { SessionSeq } from "@/lib/trend-geometry";

/**
 * NON-PRODUCTION e2e LAYOUT HARNESS (feature 009) — not a user surface.
 *
 * Renders the REAL expanded `TodayTrendPlot` with NO `availableWidth` prop, inside a faithful
 * copy of the dashboard's expanded-recap wrapper chain (`main px-4 sm:px-6` → `max-w-6xl` →
 * `Card` → `p-6` → today-view expanded detail). That makes the plot's measured `flex-1` lane
 * area match the real surface at every viewport, so a real browser exercises the live fixed-px
 * measurement path (ResizeObserver → `laneWidthFor`, DC-001) that happy-dom cannot.
 *
 * Drives `tests/layout/today-plot-tightening.spec.ts` (the 360px-tightening regression guard).
 * The plot lives in the AUTHED dashboard, so this mock-data route is the auth-free way to drive
 * its layout under Playwright — see the unauth-dev-route measurement pattern. 404s in production
 * (`process.env.NODE_ENV` is statically inlined into the client bundle, so a prod build compiles
 * this to an unconditional `notFound()` and the route never ships).
 */

// A 4-lane day: clamps to LANE_MIN (→ scrolls) on a phone, fills the width on desktop — the
// minimum that demonstrates both ends of the fixed-px contrast (one lane per tenor).
const FIXTURE: SessionSeq[] = [
  { sessionId: "s0", tenor: "at_ease", bands: ["at_ease", "a_little_tense"] },
  { sessionId: "s1", tenor: "a_little_tense", bands: ["at_ease", "a_little_tense"] },
  { sessionId: "s2", tenor: "tense", bands: ["a_little_tense", "tense"] },
  { sessionId: "s3", tenor: "no_read", bands: [null, null] },
];

export default function TodayPlotHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="flex-1 px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-6xl space-y-10 pb-12">
        <Card className="h-full">
          <div className="p-6">
            <div className="flex flex-col">
              <div className="mt-5 border-t border-border pt-5">
                <TodayTrendPlot seqs={FIXTURE} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

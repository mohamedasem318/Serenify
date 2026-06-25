"use client";

import { Suspense } from "react";
import { notFound, useSearchParams } from "next/navigation";

import { SessionTrend } from "@/components/monitor/session-trend";
import type { SessionTrendPoint } from "@/lib/api/monitoring-reads";

/**
 * NON-PRODUCTION layout harness (feature 010 / 009b) — NOT a user surface; 404s in prod.
 * Renders the REAL `SessionTrend` inside a faithful copy of the monitor wrapper chain
 * (`main px-4 sm:px-6` → `mx-auto w-full max-w-3xl` → the component's own `p-5 sm:p-6`), so a
 * real browser exercises the live fixed-px width measurement (ResizeObserver, DC-001) that
 * happy-dom cannot — the only way to verify the 360px no-read label fit. `?foggy` flips the
 * FR-015 gate on. To be deleted after the visual check.
 */

const NOW = Date.UTC(2026, 5, 25, 12, 0, 0);
const at = (secsAgo: number) => new Date(NOW - secsAgo * 1000).toISOString();
const pt = (
  id: string,
  band: SessionTrendPoint["band"],
  secsAgo: number,
  skipCause: SessionTrendPoint["skipCause"] = null,
): SessionTrendPoint => ({ id, band, scored: band !== null, skipCause, capturedAt: at(secsAgo) });

// warming → confident run → no-clear-read gap → out-of-frame run → live tense. Wide shows the
// whole arc; at 360px only the most-recent ~4 windows survive (the out-of-frame gap + live tense).
const FIXTURE: SessionTrendPoint[] = [
  pt("w1", null, 115),
  pt("w2", null, 105),
  pt("a", "at_ease", 95),
  pt("b", "at_ease", 85),
  pt("c", "a_little_tense", 75),
  pt("d", null, 65, "low-light"),
  pt("e", "a_little_tense", 55),
  pt("f", "tense", 45),
  pt("g", null, 35, "out-of-frame"),
  pt("h", null, 25, "out-of-frame"),
  pt("i", "tense", 15),
  pt("j", "tense", 5),
];

function Harness() {
  const foggy = useSearchParams().get("foggy") !== null;
  return (
    <main className="flex-1 px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-3xl">
        <SessionTrend
          sessionId="preview"
          active={false}
          load={async () => FIXTURE}
          now={() => NOW}
          showOutOfFrameFoggy={foggy}
        />
      </div>
    </main>
  );
}

export default function SessionTrendHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}

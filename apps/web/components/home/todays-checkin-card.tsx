"use client";

import { useEffect, useState } from "react";

import { TodayView } from "@/components/home/today-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getTodayRecap,
  getTodayTrend,
  type TodayRecap,
  type TodayTrendRow,
} from "@/lib/api/monitoring-reads";

/**
 * The primary card on the employee /app body. Claims the left ~60% of the desktop grid;
 * stacks first at ≤768px.
 *
 * Feature 008:
 *   • US1 (T034): the idle state gained the **Start check-in** action → `/app/monitor`.
 *   • US4 (T048): the card now recaps **today** and **expands in place** (FR-028) to the
 *     full day view (`TodayView`). It chooses its surface from `has_anchor` + today's
 *     sessions (data-model E4 / FR-019):
 *       - no userId (server hasn't wired it / SSR) → the static Start check-in entry;
 *       - `hasAnchor === false` → calibrate-first (never an empty recap, FR-011);
 *       - calibrated, no check-ins today → the empty state;
 *       - calibrated, check-ins today → the recap + in-place expand.
 *     The recap reads run **browser-side as the user** (RLS); no probability is read
 *     (FR-015). `deps` is injectable so the branches are unit-testable without Supabase.
 *
 * Camera-route nav note (unchanged from T034): the Start check-in CTA is a plain `<a href>`
 * (FULL document navigation), NOT a next/link `<Link>` — `/app/monitor` is a capture route
 * whose `camera=(self)` Permissions-Policy is set by a per-route response header, and a
 * client-side soft-nav would keep `/app`'s `camera=()` policy and break getUserMedia. Same
 * idiom — and reason — as the calibration banner / calibrate-first CTAs.
 *
 * Copy rubric (constitution-V calm voice): no exclamation marks, no alarmist/clinical
 * phrasing; the recap copy traces to the approved v5 mock.
 */

export interface CheckinCardDeps {
  loadRecap: (userId: string) => Promise<TodayRecap>;
  loadTrend: (userId: string) => Promise<TodayTrendRow[]>;
}

const defaultDeps: CheckinCardDeps = {
  loadRecap: (userId) => getTodayRecap(userId),
  loadTrend: (userId) => getTodayTrend(userId),
};

export interface TodaysCheckinCardProps {
  /** The signed-in employee (from the server page); when absent the static entry shows. */
  userId?: string;
  /** Whether the user has a calibration anchor (from the page's `has_anchor` RPC). */
  hasAnchor?: boolean;
  deps?: CheckinCardDeps;
}

export function TodaysCheckinCard({ userId, hasAnchor, deps = defaultDeps }: TodaysCheckinCardProps) {
  const [recap, setRecap] = useState<TodayRecap | null>(null);
  const [trendRows, setTrendRows] = useState<TodayTrendRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Load today's recap + trend only for a calibrated user (a no-anchor user goes straight
  // to calibrate-first; no userId means the server hasn't wired props yet → static entry).
  useEffect(() => {
    if (!userId || hasAnchor === false) return;
    let alive = true;
    void Promise.all([deps.loadRecap(userId), deps.loadTrend(userId)])
      .then(([r, rows]) => {
        if (!alive) return;
        setRecap(r);
        setTrendRows(rows);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true); // a read failure degrades to the empty state, never a crash
      });
    return () => {
      alive = false;
    };
  }, [userId, hasAnchor, deps]);

  // ── calibrate-first (no anchor) — foggy attention, a meadow forward action ──────────
  if (userId && hasAnchor === false) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-ink">Today&apos;s check-in</CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted">
            Set your baseline first so a check-in can be about you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-5">
          <p className="text-sm leading-relaxed text-muted">
            A one-minute calibration teaches Serenify your everyday normal — then check-ins
            read the change from there, not a stranger&apos;s baseline.
          </p>
          <Button asChild variant="meadow">
            {/* Full-document nav for the /app/calibrate camera Permissions-Policy. */}
            <a href="/app/calibrate">Start calibration</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── recap (calibrated, with check-ins today) — expands in place ─────────────────────
  if (userId && hasAnchor !== false && loaded && recap && recap.sessions.length > 0) {
    return (
      <Card className="h-full">
        <div className="p-6">
          <TodayView
            recap={recap}
            trendRows={trendRows}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
          />
        </div>
      </Card>
    );
  }

  // ── empty (calibrated, no check-ins today) — invite a check-in ──────────────────────
  if (userId && hasAnchor !== false && loaded) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-ink">Today&apos;s check-in</CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted">
            No check-ins yet today.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-5">
          <p className="text-sm leading-relaxed text-muted">
            Watches for signs of stress while you work and checks in if something comes up.
          </p>
          <Button asChild variant="meadow">
            <a href="/app/monitor">Start check-in</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── static default (no userId, or still loading) ────────────────────────────────────
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-2xl text-ink">Today&apos;s check-in</CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted">
          A quiet space for a quick read on how today is going.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-5">
        <p className="text-sm leading-relaxed text-muted">
          Watches for signs of stress while you work and checks in if something comes up.
        </p>
        <Button asChild variant="meadow">
          {/* Full-document navigation (plain <a>, not <Link>) — see the camera-route note above. */}
          <a href="/app/monitor">Start check-in</a>
        </Button>
      </CardContent>
    </Card>
  );
}

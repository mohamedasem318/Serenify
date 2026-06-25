"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { getSessionTrend, type SessionTrendPoint } from "@/lib/api/monitoring-reads";
import {
  FADE_OPACITY,
  HALO_R_MAX,
  NOW_R,
  STROKE,
  WARM_DASH,
  WARM_OPACITY,
  WARM_STROKE,
  buildSessionTrend,
} from "@/lib/session-trend-geometry";

/**
 * The monitor-page **this-session** live trend (feature 010 / 009b redesign). Visual source
 * of truth: `serenify-live-session-graph-mock.html` ("match this"). All honesty-critical
 * geometry + state derivation lives in the pure `lib/session-trend-geometry.ts`; this
 * component only measures its container width and renders the derived view-model.
 *
 * FIXED-PX (DC-001 / FR-001): the SVG `width` AND its `viewBox` width are both the measured
 * container width — NO `preserveAspectRatio` stretch — so the now marker is a TRUE circle at
 * any width (replacing the old `viewBox="0 0 100 40"` + `preserveAspectRatio="none"` that
 * ovalled every marker). It carries NO number (FR-017) and reuses `getSessionTrend` unchanged.
 *
 * Build order: US1 (step-line + live now-marker + band legend) + US2 (the three honest no-read
 * treatments + foggy gate + legend gating + empty-vs-warming) are in. US3 (popup + parked
 * refinements + keyboard/reduced-motion + ≥44px touch target) layers on top.
 *
 * `load` / `active` / `pollMs` / `showOutOfFrameFoggy` / `now` are injectable so the rules are
 * unit-testable without a Supabase round-trip, real timers, real layout, or a real clock.
 */

const DOT_R = 4; // isolated-confident dot (smaller than the now marker)
const STATIC_HALO_R = 8; // reduced-motion now-marker halo (mock)

// No-read gap-label pill sizing (11px text). Char width tuned to the mock pill widths
// ("getting a read"≈86, "no clear read"≈88, "step back into frame"≈116).
const LABEL_CHAR_W = 5.3;
const LABEL_PAD = 12;
const LABEL_H = 18;
const estLabelW = (s: string) => Math.round(s.length * LABEL_CHAR_W) + LABEL_PAD;
const ptsStr = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

export interface SessionTrendProps {
  sessionId: string;
  /** Keep polling while the session is live (default true). */
  active?: boolean;
  /** Injectable reader (defaults to the shared RLS reader). */
  load?: (sessionId: string) => Promise<SessionTrendPoint[]>;
  /** Poll cadence in ms (default ≈ one stride). */
  pollMs?: number;
  /** FR-015 foggy gate — default OFF at launch (out-of-frame → muted no-clear-read). */
  showOutOfFrameFoggy?: boolean;
  /** Injectable clock for deterministic tests (defaults to Date.now). */
  now?: () => number;
}

export function SessionTrend({
  sessionId,
  active = true,
  load = getSessionTrend,
  pollMs = 12_000,
  showOutOfFrameFoggy = false,
  now = Date.now,
}: SessionTrendProps) {
  const [points, setPoints] = useState<SessionTrendPoint[]>([]);
  const [width, setWidth] = useState(0);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const next = await loadRef.current(sessionId);
        if (alive) setPoints(next);
      } catch {
        /* a transient read failure just leaves the last trend in place */
      }
    };
    void tick();
    if (!active) return () => void (alive = false);
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [sessionId, active, pollMs]);

  // ── T009a: measure the rendered container width ──
  // A callback ref measures the instant the node mounts (handles mount-before-observer and
  // 0-width-on-mount), and a ResizeObserver keeps it in sync on resize. setState lives in the
  // ref/observer callback (not an effect body), so it never trips react-hooks/set-state-in-effect.
  const roRef = useRef<ResizeObserver | null>(null);
  const setNode = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width || el.clientWidth || 0);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      roRef.current = ro;
    }
  }, []);

  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const view = buildSessionTrend(points, { width, nowMs: now(), showOutOfFrameFoggy });
  const marker = view.nowMarker;
  const pulsing = marker.state === "live" && marker.pulse && !reducedMotion;

  return (
    <section
      data-testid="session-trend"
      className="mt-5 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6"
      aria-label="This session's trend"
    >
      <h3 className="font-display text-base font-semibold text-ink">This session</h3>

      {view.isEmpty ? (
        <p data-testid="session-trend-empty" className="mt-1.5 text-sm text-muted">
          Your trend builds as readings come in.
        </p>
      ) : (
        <>
          <p data-testid="session-trend-subtitle" className="mt-1.5 text-sm text-muted">
            {view.subtitle.text}
          </p>

          {/* the measured container — the SVG fills it 1:1 (matched pair with the camera card) */}
          <div ref={setNode} className="mt-3.5 w-full">
            {width > 0 && (
              <svg
                data-testid="session-trend-svg"
                width={view.width}
                height={view.height}
                viewBox={`0 0 ${view.width} ${view.height}`}
                role="img"
                aria-label="Your live stress trend for this session: colour and height show how tense each reading is; gaps are windows without a clear read. No numbers are shown."
                className="block"
              >
                {/* subtle band gridlines + axis labels */}
                {view.axis.gridlines.map((g, idx) => (
                  <line
                    key={`grid-${idx}`}
                    x1={g.x1}
                    y1={g.y}
                    x2={g.x2}
                    y2={g.y}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                  />
                ))}
                {view.axis.labels.map((l, idx) => (
                  <text key={`axis-${idx}`} x={l.x} y={l.y} textAnchor={l.anchor} fill="var(--color-muted)" fontSize={11}>
                    {l.text}
                  </text>
                ))}

                {/* no-read treatments (US2): warming dashed muted line · muted/foggy gap with
                    STATIC-opacity fade flanks (no motion — FR-013/SC-006) + a gated label pill.
                    The geometry already routed out-of-frame to foggy vs no_clear_read per the
                    FR-015 gate, so this just renders whatever kind it produced. */}
                {view.treatments.map((t, idx) => {
                  const w = estLabelW(t.label);
                  const labelX = Math.min(Math.max(t.labelX - w / 2, view.plot.left), view.plot.right - w);
                  const labelY = Math.max(15, t.level - 31);
                  const pillOpacity = t.kind === "foggy" ? 0.16 : 0.12;
                  return (
                    <g key={`treat-${idx}`} data-testid={`treatment-${t.kind}`}>
                      {t.warmLine && (
                        <polyline
                          data-testid="trend-warming"
                          points={ptsStr(t.warmLine)}
                          fill="none"
                          stroke={t.color}
                          strokeWidth={WARM_STROKE}
                          strokeDasharray={WARM_DASH}
                          opacity={WARM_OPACITY}
                          strokeLinecap="round"
                        />
                      )}
                      {t.fadeOut && (
                        <polyline
                          data-testid="trend-fade"
                          points={ptsStr(t.fadeOut)}
                          fill="none"
                          stroke={t.color}
                          strokeWidth={STROKE}
                          opacity={FADE_OPACITY}
                          strokeLinecap="round"
                        />
                      )}
                      {t.fadeIn && (
                        <polyline
                          data-testid="trend-fade"
                          points={ptsStr(t.fadeIn)}
                          fill="none"
                          stroke={t.color}
                          strokeWidth={STROKE}
                          opacity={FADE_OPACITY}
                          strokeLinecap="round"
                        />
                      )}
                      <rect x={labelX} y={labelY} width={w} height={LABEL_H} rx={9} fill={t.color} opacity={pillOpacity} />
                      <text
                        data-testid="treatment-label"
                        x={labelX + w / 2}
                        y={labelY + 13}
                        textAnchor="middle"
                        fill={t.color}
                        fontSize={11}
                      >
                        {t.label}
                      </text>
                    </g>
                  );
                })}

                {/* confident step-line (colour = band, height = band) */}
                {view.steps.map((s, idx) => (
                  <polyline
                    key={`seg-${idx}`}
                    data-testid="trend-seg"
                    points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
                {/* isolated confident reading → a dot, not a line */}
                {view.dots.map((d, idx) => (
                  <circle key={`dot-${idx}`} data-testid="trend-dot" cx={d.x} cy={d.y} r={DOT_R} fill={d.color} />
                ))}

                {/* the live "now" marker (popup / keyboard / ≥44px hit-area land in US3) */}
                {marker.state !== "none" && (
                  <g data-testid="now-marker">
                    {marker.state === "live" &&
                      (pulsing ? (
                        // gentle pulse via inline SMIL (digits stay in attributes, never in
                        // rendered text — FR-017); only rendered when motion is allowed (FR-006)
                        <circle cx={marker.x} cy={marker.y} r={NOW_R} fill="none" stroke={marker.fill} strokeWidth={2}>
                          <animate
                            attributeName="r"
                            values={`${NOW_R};${HALO_R_MAX}`}
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0.5;0;0"
                            keyTimes="0;0.7;1"
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      ) : (
                        <circle
                          data-testid="now-halo-static"
                          cx={marker.x}
                          cy={marker.y}
                          r={STATIC_HALO_R}
                          fill="none"
                          stroke={marker.fill}
                          strokeWidth={2}
                          opacity={0.22}
                        />
                      ))}
                    <circle data-testid="now-dot" cx={marker.x} cy={marker.y} r={NOW_R} fill={marker.fill} />
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* legend — band keys + FR-021-gated no-read keys (two at launch; the foggy
              "stepped out of frame" key appears only when the gate is on) */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-hidden>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: "var(--color-meadow)" }} /> at ease
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: "var(--amber-soft-line)" }} /> a little tense
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: "var(--color-amber)" }} /> tense
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="inline-block h-0 w-4 border-t-2 border-dashed"
                style={{ borderColor: "var(--color-muted)", opacity: 0.6 }}
              />{" "}
              warming up
            </li>
            {showOutOfFrameFoggy && (
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: "var(--color-foggy)", opacity: 0.55 }} />{" "}
                stepped out of frame
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: "var(--color-muted)", opacity: 0.5 }} /> no
              clear read
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

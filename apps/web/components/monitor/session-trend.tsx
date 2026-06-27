"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { getSessionTrend, type SessionTrendPoint } from "@/lib/api/monitoring-reads";
import {
  FADE_OPACITY,
  HALO_R_MAX,
  HIT_R,
  NOW_R,
  STROKE,
  WARM_DASH,
  WARM_OPACITY,
  WARM_STROKE,
  buildSessionTrend,
  type NowMarker as NowMarkerView,
} from "@/lib/session-trend-geometry";

// [ST7-DEBUG] Temporary instrumentation — flip to false (or delete block) to remove all logging.
const __ST7 = true;

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

/**
 * The live "now" marker (US3 — T020–T023): a focusable group with a hover / focus / tap popup,
 * the gentle pulse (or reduced-motion static halo), and a ≥44×44 touch hit-area.
 *
 * HONESTY (FR-007 / US3 scenario 8): the popup copy AND the marker fill/halo are read LIVE from
 * the geometry `marker` every render, so when the live edge flips confident ⇄ no-read the marker
 * reparks (band colour + pulse ⇄ muted + static) and an already-open popup's copy flips
 * "you are here" ⇄ "last clear read" without re-opening. The `pinned` state controls only
 * VISIBILITY, never the text.
 *
 * Reveal/dismiss (CHK014 / FR-007): hover shows / mouse-out hides; focus shows / blur hides; a
 * tap TOGGLES (second tap on the marker closes), a tap OUTSIDE dismisses, and Esc closes. Pure
 * `:focus-within` (the mock's mechanism) can't express the toggle/outside-dismiss, hence the
 * explicit `pinned` state. The marker only mounts while there's a reading to anchor to
 * (`state !== "none"`); if it scrolls off and later returns it remounts fresh (no stale pin).
 */
function NowMarker({
  marker,
  reducedMotion,
  plot,
}: {
  marker: NowMarkerView;
  reducedMotion: boolean;
  plot: { left: number; right: number };
}) {
  const gRef = useRef<SVGGElement | null>(null);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focused || pinned;

  // Outside-tap dismiss for a pinned popup. A tap on the marker itself is handled by the
  // group's onClick toggle, so it is excluded here via `contains`.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: Event) => {
      const t = e.target as Node | null;
      if (gRef.current && t && !gRef.current.contains(t)) setPinned(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned]);

  const x = marker.x ?? plot.right;
  const y = marker.y ?? 0;
  const fill = marker.fill ?? "var(--color-muted)";
  const isLive = marker.state === "live";
  const pulsing = isLive && marker.pulse && !reducedMotion;
  const text = marker.popup ?? "";

  // Popup bubble geometry — clamped inside the plot so it never clips off-plot at the right-edge
  // "now" position (opens up + left there). The pointer still aims at the dot. (FR-007 placement.)
  const tipW = Math.round(text.length * 6) + 20;
  const tipH = 21;
  const rectLeft = Math.min(Math.max(x - tipW / 2, plot.left), Math.max(plot.left, plot.right - tipW));
  const rectTop = Math.max(2, y - 13 - tipH);
  const rectBottom = rectTop + tipH;
  const pointerX = Math.min(Math.max(x, rectLeft + 8), rectLeft + tipW - 8);

  return (
    <g
      ref={gRef}
      data-testid="now-marker"
      data-state={marker.state}
      tabIndex={0}
      role="img"
      aria-label={marker.ariaLabel}
      style={{ cursor: "pointer", outline: "none" }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => setPinned((p) => !p)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setPinned(false);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPinned((p) => !p);
        }
      }}
    >
      {/* halo: live pulse (motion) → live static halo (reduced-motion) → none when parked */}
      {isLive &&
        (pulsing ? (
          // gentle pulse via inline SMIL (digits stay in attributes, never rendered text —
          // FR-017); rendered only when motion is allowed (FR-006/SC-006)
          <circle cx={x} cy={y} r={NOW_R} fill="none" stroke={fill} strokeWidth={2}>
            <animate attributeName="r" values={`${NOW_R};${HALO_R_MAX}`} dur="2.4s" repeatCount="indefinite" />
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
            cx={x}
            cy={y}
            r={STATIC_HALO_R}
            fill="none"
            stroke={fill}
            strokeWidth={2}
            opacity={0.22}
          />
        ))}

      <circle data-testid="now-dot" cx={x} cy={y} r={NOW_R} fill={fill} />

      {/* the popup — copy tracks the live marker state (FR-007). Decorative for AT users (the
          group's aria-label is the accessible name) → aria-hidden + never receives pointer events.
          Reduced-motion drops the fade so SC-006 holds. */}
      <g
        data-testid="now-tip"
        data-open={open}
        aria-hidden
        opacity={open ? 1 : 0}
        pointerEvents="none"
        style={{ transition: reducedMotion ? "none" : "opacity .15s" }}
      >
        <rect x={rectLeft} y={rectTop} width={tipW} height={tipH} rx={6} fill="var(--color-ink)" />
        <path
          d={`M${pointerX - 6},${rectBottom} L${pointerX},${rectBottom + 8} L${pointerX + 6},${rectBottom} Z`}
          fill="var(--color-ink)"
        />
        <text
          data-testid="now-tip-text"
          x={rectLeft + tipW / 2}
          y={rectTop + 14}
          textAnchor="middle"
          fill="var(--color-surface)"
          fontSize={11}
        >
          {text}
        </text>
      </g>

      {/* ≥44×44 touch hit-area (T023) — an intended divergence from the mock's r=15. */}
      <circle data-testid="now-hit" cx={x} cy={y} r={HIT_R} fill="transparent" pointerEvents="all" />
    </g>
  );
}

export interface SessionTrendProps {
  sessionId: string;
  /** Keep polling while the session is live (default true). */
  active?: boolean;
  /** Injectable reader (defaults to the shared RLS reader). */
  load?: (sessionId: string) => Promise<SessionTrendPoint[]>;
  /** Poll cadence in ms (default ≈ one stride) — the steady-state BACKSTOP, not the freshness path. */
  pollMs?: number;
  /**
   * FR-004 freshness: a monotonically increasing counter the parent bumps the instant a new
   * reading is persisted (the same WINDOW_OUTCOME that updates the live bloom/orb). Each change
   * triggers an immediate re-fetch so the now-marker tracks the orb instead of trailing the poll.
   */
  refreshSignal?: number;
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
  refreshSignal = 0,
  showOutOfFrameFoggy = false,
  now = Date.now,
}: SessionTrendProps) {
  const [points, setPoints] = useState<SessionTrendPoint[]>([]);
  const [width, setWidth] = useState(0);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // A single shared re-fetch of the persisted rows, used by BOTH the background poll and the
  // event-driven refresh. setState lives inside this async callback (never the synchronous
  // effect body), so it doesn't trip react-hooks/set-state-in-effect; a mounted-guard drops a
  // late resolve after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const refetch = useCallback(async () => {
    if (__ST7) console.log("[ST7] refetch start — sessionId:", sessionId);
    try {
      const next = await loadRef.current(sessionId);
      if (__ST7) console.log("[ST7] refetch result — next.length:", next.length);
      if (mountedRef.current) {
        // getSessionTrend returns [] (not throws) on error; treat a silent empty the same
        // as an exception — keep existing rows so the parked marker isn't wiped mid-session.
        setPoints((prev) => {
          const keep = next.length === 0 && prev.length > 0;
          if (__ST7)
            console.log(
              "[ST7] setPoints — prev.length:", prev.length,
              "next.length:", next.length,
              "→", keep ? "KEPT prev (guard)" : "REPLACED with next",
            );
          return keep ? prev : next;
        });
      }
    } catch (err) {
      if (__ST7) console.log("[ST7] refetch CAUGHT error — keeping prev:", err);
      /* a transient read failure just leaves the last trend in place */
    }
  }, [sessionId]);

  // Background poll — the steady-state BACKSTOP (default ≈ one stride). It does the first load
  // on mount and keeps the trend correct across windows that produce no new reading (e.g. a long
  // no-read stretch) and after a transient read failure. Deliberately NOT lowered to chase
  // freshness: a blunt low interval adds steady DB load that bites on the cheap deploy VM — the
  // event-driven refresh below carries the freshness for ~one fetch per real reading instead.
  useEffect(() => {
    if (__ST7) console.log("[ST7] poll effect — active:", active, "— firing immediate refetch");
    void refetch();
    if (!active) return;
    const id = setInterval(() => {
      if (__ST7) console.log("[ST7] poll interval tick");
      void refetch();
    }, pollMs);
    return () => clearInterval(id);
  }, [refetch, active, pollMs]);

  // Event-driven refresh (FR-004 freshness): the parent bumps `refreshSignal` the instant a new
  // reading is persisted (the SAME WINDOW_OUTCOME that updates the live bloom/orb), so the
  // now-marker tracks the orb instead of trailing by up to one poll interval (the ~2 s lag). The
  // marker still comes from the PERSISTED row — the row is committed before the window POST
  // response returns, so a re-fetch on that event always sees it; there is no optimistic
  // in-memory value and therefore no marker-vs-step-line mismatch. The initial value is skipped
  // (the poll effect already loads once on mount).
  const seenSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === seenSignalRef.current) return;
    if (__ST7)
      console.log("[ST7] signal refetch — refreshSignal:", refreshSignal, "(was:", seenSignalRef.current, ")");
    seenSignalRef.current = refreshSignal;
    void refetch();
  }, [refreshSignal, refetch]);

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
  if (__ST7)
    console.log(
      "[ST7] render — isEmpty:", view.isEmpty,
      "| pts in:", points.length,
      "| slots:", view.slots.length,
      "| marker.state:", marker.state,
      "| subtitle:", view.subtitle.kind,
      "| active:", active,
    );

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

                {/* the live "now" marker — popup (hover/focus/tap), parked muted/static state,
                    keyboard + reduced-motion a11y, and the ≥44px hit-area (US3, in NowMarker) */}
                {marker.state !== "none" && (
                  <NowMarker marker={marker} reducedMotion={reducedMotion} plot={view.plot} />
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

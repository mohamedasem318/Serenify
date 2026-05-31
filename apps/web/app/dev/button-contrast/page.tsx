"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * DEV-ONLY preview — button contrast (feature 004 polish, §4 + §5).
 *
 * TEMPORARY: this route is not linked from anywhere and MUST be deleted once the
 * meadow-foreground decision is made. It renders, at real button size:
 *   §5 — the meadow CTA with the current ink text vs proposed white text (a LIGHT
 *        mode decision), plus every meadow button in the capture flow so the blast
 *        radius of a global flip is visible.
 *   §4 — the dark-mode cases from the contrast investigation (foggy variant resting,
 *        and the outline "Start over" whose HOVER is the reported symptom).
 *
 * Each button prints its measured WCAG contrast, read live from getComputedStyle.
 * Switch mode with the Light/Dark buttons, then press "Recompute".
 */

function srgbToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function parseRgb(input: string): [number, number, number] {
  const parts = input.match(/[\d.]+/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
function contrastRatio(fg: string, bg: string): number {
  const a = luminance(parseRgb(fg));
  const b = luminance(parseRgb(bg));
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
function verdict(ratio: number): string {
  if (ratio >= 4.5) return "AA pass (normal text)";
  if (ratio >= 3) return "AA large-text only";
  return "fails AA";
}

function Measured({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState("measuring…");

  const measure = useCallback(() => {
    const button = ref.current?.querySelector("button");
    if (!button) return;
    const cs = getComputedStyle(button);
    const ratio = contrastRatio(cs.color, cs.backgroundColor);
    setLine(`${cs.color} on ${cs.backgroundColor} → ${ratio.toFixed(2)}:1 — ${verdict(ratio)}`);
  }, []);

  useEffect(() => {
    measure();
  }, [measure]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5">
      {children}
      <p className="max-w-[16rem] text-center text-xs leading-snug text-muted">
        {label}: {line}
      </p>
    </div>
  );
}

export default function ButtonContrastPreview() {
  const [dark, setDark] = useState(false);

  const setMode = (next: boolean) => {
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    setDark(next);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-10 bg-bg p-6 text-ink">
      <header className="space-y-3 rounded-card border border-amber/60 bg-amber/10 p-4">
        <h1 className="font-display text-2xl text-ink">DEV-ONLY — button contrast preview</h1>
        <p className="text-sm text-muted">
          Temporary route for the §4 / §5 contrast investigation. Delete after the
          meadow decision is made. Ratios are read live from{" "}
          <code className="rounded bg-surface px-1">getComputedStyle</code>; switch
          mode then press Recompute (or just reload).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant={dark ? "outline" : "default"} onClick={() => setMode(false)} className="h-9">
            Light
          </Button>
          <Button variant={dark ? "default" : "outline"} onClick={() => setMode(true)} className="h-9">
            Dark
          </Button>
          <Button variant="outline" onClick={() => location.reload()} className="h-9">
            Recompute (reload)
          </Button>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-ink">§5 — meadow foreground: ink vs white (decide in Light mode)</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Measured label="meadow + ink (current)">
            <Button variant="meadow" className="h-12 w-full max-w-xs text-base">
              I&rsquo;m ready
            </Button>
          </Measured>
          <Measured label="meadow + white (proposed)">
            <Button variant="meadow" className="h-12 w-full max-w-xs text-base text-white">
              I&rsquo;m ready
            </Button>
          </Measured>
        </div>
        <h3 className="text-sm font-medium text-muted">Blast radius — every meadow button in the flow (current ink text):</h3>
        <div className="flex flex-wrap items-start gap-4">
          <Measured label="Turn on camera">
            <Button variant="meadow" className="h-12 px-5 text-base">
              Turn on camera
            </Button>
          </Measured>
          <Measured label="I&rsquo;m ready">
            <Button variant="meadow" className="h-12 px-5 text-base">
              I&rsquo;m ready
            </Button>
          </Measured>
          <Measured label="Back to home">
            <Button variant="meadow" className="h-12 px-5 text-base">
              Back to home
            </Button>
          </Measured>
          <Measured label="Keep going">
            <Button variant="meadow" className="h-11 px-5">
              Keep going
            </Button>
          </Measured>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-ink">§4 — dark-mode contrast (switch to Dark, then hover)</h2>
        <div className="flex flex-wrap items-start gap-4">
          <Measured label="foggy variant — resting">
            <Button variant="foggy" className="h-11 px-5">
              Try again
            </Button>
          </Measured>
          <Measured label="outline &lsquo;Start over&rsquo; — resting">
            <Button variant="outline" className="h-11 px-5">
              Start over
            </Button>
          </Measured>
        </div>
        <p className="text-sm text-muted">
          Hover each in Dark mode to see the hover state (the reported symptom). The
          resting measurements above don&rsquo;t capture <code className="rounded bg-surface px-1">:hover</code> —
          watch the outline button&rsquo;s text as you hover it.
        </p>
      </section>
    </main>
  );
}

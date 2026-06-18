"use client";

import { Armchair, Camera, Clock, ShieldCheck, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Pre-camera intro for the calibration capture flow (feature 005, FR-001–004).
 * Calm heading + a short reassuring explanation, three icon-led what-to-expect
 * lines, a privacy reassurance, and a single primary action that requests camera
 * permission. Copy nudges "set" → "update" in the recalibrate path (FR-038/040).
 */

const EXPECT = [
  { Icon: Armchair, text: "A quiet moment to yourself" },
  { Icon: Sun, text: "Good lighting on your face" },
  { Icon: Clock, text: "About a minute, sitting still" },
] as const;

export function Intro({
  mode = "first-time",
  onTurnOnCamera,
}: {
  mode?: "first-time" | "recalibrate";
  onTurnOnCamera: () => void;
}) {
  const heading = mode === "recalibrate" ? "Update your calm baseline" : "Set your calm baseline";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-2 py-4 text-center">
      <header className="space-y-3">
        <h1 className="text-balance font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
        <p className="text-pretty text-base leading-relaxed text-muted">
          We’ll record a short, calm minute so the app can learn what calm looks like for
          you. Nothing tense, nothing to get right — just settle in.
        </p>
      </header>

      <ul className="mx-auto flex w-full max-w-sm flex-col gap-4 text-left">
        {EXPECT.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-control bg-meadow/10 text-meadow-text">
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-base text-ink">{text}</span>
          </li>
        ))}
      </ul>

      <p className="mx-auto flex max-w-md items-start justify-center gap-2 text-pretty text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-meadow" strokeWidth={1.75} aria-hidden />
        <span>Your video isn’t stored — only the calm reading it produces.</span>
      </p>

      <div className="space-y-2">
        <Button onClick={onTurnOnCamera} variant="meadow" className="h-12 w-full gap-2 text-base">
          <Camera className="size-5" strokeWidth={1.75} aria-hidden />
          Turn on camera
        </Button>
        <p className="text-sm text-muted">Your browser will ask for permission next.</p>
      </div>
    </div>
  );
}

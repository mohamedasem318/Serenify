"use client";

import { CameraOff, CircleHelp, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The three calm, specific camera-access states (feature 005, FR-031–035) that
 * replace the single generic "camera access denied". Each names the problem AND
 * the fix, all FOGGY — never red or amber. The primary "Try again" matches the
 * screen's foggy treatment (a FOGGY-filled CTA, per the colour rule); "Not now"
 * stays a quiet text link. The orchestrator routes "Not now" by mode. No alarm.
 *
 * Icons map to the cause: blocked → a lock (it's a permission, not a fault), busy →
 * camera-off (something else holds it), no-camera → a question (we're unsure one is
 * there). lucide has no camera-question, so the plain question reads "which camera?"
 */

export type CameraAccessKind = "blocked" | "busy" | "no-device";

const CONTENT: Record<CameraAccessKind, { Icon: LucideIcon; title: string; body: string }> = {
  blocked: {
    Icon: Lock,
    title: "Camera’s blocked",
    body: "Your browser is blocking the camera. Re-enable it from the camera icon in your address bar, then try again.",
  },
  busy: {
    Icon: CameraOff,
    title: "Camera’s in use",
    body: "Another app — often a video call or screen recorder — has the camera. Closing it frees it up, then try again.",
  },
  "no-device": {
    Icon: CircleHelp,
    title: "No camera found",
    body: "We couldn’t find a camera. Connect or enable one, then pick it from the selector and try again.",
  },
};

export function CameraAccessState({
  kind,
  onRetry,
  onNotNow,
}: {
  kind: CameraAccessKind;
  onRetry: () => void;
  onNotNow: () => void;
}) {
  const { Icon, title, body } = CONTENT[kind];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-2 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-foggy/15 text-foggy">
        <Icon className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="space-y-2">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        <p className="text-pretty text-base leading-relaxed text-muted">{body}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button onClick={onRetry} variant="foggy" className="h-12 w-full text-base">
          Try again
        </Button>
        <Button variant="ghost" onClick={onNotNow} className="h-11 w-full text-muted">
          Not now
        </Button>
      </div>
    </div>
  );
}

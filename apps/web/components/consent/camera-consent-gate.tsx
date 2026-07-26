"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  CAMERA_GATE_ACCEPT_LABEL,
  CAMERA_GATE_DECLINE_LABEL,
  CAMERA_GATE_LEDE,
  CAMERA_GATE_REGION_LABEL,
  CAMERA_GATE_SCOPE,
  CAMERA_GATE_SCOPE_HEADING,
  CAMERA_GATE_TITLE,
  CAMERA_GATE_WHAT_HAPPENS,
  CAMERA_GATE_WHAT_HAPPENS_HEADING,
  CAMERA_GATE_WRITE_ERROR,
} from "@/lib/consent/copy";
import { grantConsent } from "./actions";

/**
 * The camera-and-inference consent gate (T048, FR-038, §7.2).
 *
 * IT RENDERS INSTEAD OF THE CAPTURING CHILD, NEVER ALONGSIDE IT. The three capture
 * routes each return this component in place of their recorder, so the recorder is not
 * in the mounted tree at all — not hidden, not lazy, not behind a flag. That is the
 * difference between "the camera does not turn on" and "no code that could turn the
 * camera on is running". This component imports nothing that calls `getUserMedia`, and
 * the one camera-shaped thing on the surface is an SVG icon.
 *
 * DECLINING WRITES NOTHING AT ALL. `onDecline` navigates and returns; it calls no
 * action, and there is no action for it to call (see `./actions.ts` — there is no
 * decline path anywhere in this feature). Nothing is stored to remember a decline,
 * because the ABSENCE of a satisfying record IS the state (§6.4). Every later arrival at
 * a capture route therefore re-evaluates and presents this again — which is what makes
 * the decision revisitable without a "withdraw" concept existing.
 *
 * The decline control is a full `outline` Button, deliberately NOT the `ghost` text link
 * the house camera-access states use for their secondary action. A recoverable error
 * state may quietly de-emphasise "Not now"; a consent choice carrying legal weight may
 * not. See the P4 PR body for the reasoning.
 *
 * Every string comes from `lib/consent/copy.ts`. No browser storage (FR-051). No claim
 * about manager visibility appears anywhere on this surface.
 */

/** Where declining returns to. A capture route is the one place this must not stay. */
const DECLINE_HREF = "/app";

export function CameraConsentGate({
  onGrant = grantConsent,
}: {
  /**
   * The write action. Defaults to the real one; injectable so T055 can exercise the
   * decline path against a recording fake and assert ZERO calls — a stronger claim than
   * "no row appeared", because it holds with no database present at all.
   */
  onGrant?: (key: "camera_inference") => Promise<{ status: "ok" } | { status: "error" }>;
} = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function accept() {
    startTransition(async () => {
      setFailed(false);
      const result = await onGrant("camera_inference");
      if (result.status === "ok") {
        // Re-run the server component that gated this route. It re-reads the consent,
        // now satisfied, and renders the capturing child — which is the first moment any
        // capture code enters the tree.
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  }

  function decline() {
    // No action call. No state write. Just a navigation away from the capture route.
    router.push(DECLINE_HREF);
  }

  return (
    <section
      aria-label={CAMERA_GATE_REGION_LABEL}
      className="mx-auto flex w-full max-w-xl flex-col gap-6 px-1 py-6"
    >
      <header className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-foggy/15 text-foggy"
        >
          <Camera className="size-7" strokeWidth={1.75} />
        </span>
        <div className="space-y-2">
          <h2 className="text-balance font-display text-2xl leading-tight text-ink sm:text-3xl">
            {CAMERA_GATE_TITLE}
          </h2>
          <p className="text-pretty text-base leading-relaxed text-muted">{CAMERA_GATE_LEDE}</p>
        </div>
      </header>

      <Facts heading={CAMERA_GATE_WHAT_HAPPENS_HEADING} items={CAMERA_GATE_WHAT_HAPPENS} />
      <Facts heading={CAMERA_GATE_SCOPE_HEADING} items={CAMERA_GATE_SCOPE} />

      {failed && (
        <p
          role="alert"
          className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
        >
          {CAMERA_GATE_WRITE_ERROR}
        </p>
      )}

      {/* Stacked at every width, matching the house dialog idiom. Full-width controls are
          the largest possible tap targets and guarantee neither label wraps at 320px. */}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="meadow"
          onClick={accept}
          disabled={pending}
          className="h-12 w-full text-base"
        >
          {CAMERA_GATE_ACCEPT_LABEL}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={decline}
          disabled={pending}
          className="h-12 w-full text-base"
        >
          {CAMERA_GATE_DECLINE_LABEL}
        </Button>
      </div>
    </section>
  );
}

/** A titled block of plain statements. Both blocks on this surface share the shape. */
function Facts({ heading, items }: { heading: string; items: readonly string[] }) {
  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-5 sm:p-6">
      <h3 className="font-display text-lg leading-tight text-ink">{heading}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="text-pretty text-sm leading-relaxed text-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

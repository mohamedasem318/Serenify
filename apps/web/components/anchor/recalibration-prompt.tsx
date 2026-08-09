"use client";

import {
  dismissAnchorPrompt,
  useAnchorPromptDismissed,
} from "@/components/anchor/use-anchor-prompt-dismissal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasCompletedRecalibrationPrompt } from "@/lib/auth-broadcast";

/**
 * The recalibration recommendation (Mohamed, 2026-08-10).
 *
 * WHY IT EXISTS. Capture has changed materially since most anchors were recorded —
 * resolution, container/codec and bitrate all moved. Scoring is window minus anchor,
 * so an anchor captured under the old capture settings is being compared against
 * windows captured under the new ones. Nothing in the API detects this; there is no
 * anchor-to-window guard. It is a silent scoring error, not a visible bug, which is
 * exactly why it needs a surface: the user has no other way to find out.
 *
 * NO COHORT TARGETING, NO CUTOFF TIMESTAMP. Everyone who has an anchor is prompted.
 * The user base is small enough that the simplest version is the right one, and the
 * alternative — selecting by `anchor_captured_at` against a deploy date — would need
 * a new RPC exposing anchor recency, cutting against DECISION-23 / FR-041 (calibration
 * state is whether-set, never a date).
 *
 * IT IS A RECOMMENDATION, NOT AN ERROR, and the visual grammar has to say so:
 *
 *   - MEADOW, NOT FOGGY. Foggy is this codebase's "needs your attention" colour and
 *     is what the calibration banner correctly uses. This surface is calm and forward
 *     — the same act as "Set a new baseline" in the account section, which is already
 *     meadow. Foggy here would read as "something is wrong", which is the one thing
 *     this must not do.
 *   - EVERY DISMISS PATH IS LIVE. Escape, outside-press and the corner control all
 *     close it, in deliberate contrast to `backend-down-modal.tsx`, which suppresses
 *     all three because it is a true gate. This is advice; holding someone in it would
 *     misrepresent how urgent it is.
 *
 * VISIBILITY. Three conditions, all required: the caller has established the user has
 * an anchor (the `hasAnchor === true` branch in `app/(authed)/app/page.tsx`), this auth
 * session has not dismissed it, and this browser has not recorded a capture since the
 * prompt shipped. The last two are read through the shared dismissal hook and the
 * localStorage latch respectively — see `use-anchor-prompt-dismissal.ts` and the
 * `RECALIBRATION_PROMPT_DONE_KEY` block in `lib/auth-broadcast.ts`, which also records
 * why the permanent latch is browser-scoped rather than a new database column.
 *
 * Users with no anchor at all never reach this — they get the calibrate-first flow.
 */

/**
 * The account section this prompt hands off to. The fragment targets the `id` already
 * carried by the section's `h2` in `components/anchor/baseline-section.tsx`, so the
 * page opens scrolled to the baseline controls rather than at the top of Account.
 *
 * A plain `<a href>` — a FULL-DOCUMENT navigation — not `next/link`. Two reasons, and
 * the weaker one is the habit: every forward control in `components/anchor/` is a full
 * nav because a soft-nav into a capture route keeps the previous route's `camera=()`
 * Permissions-Policy (FR-055 / DECISION-16). `/app/account` is not a capture route, so
 * that invariant does not bind here; what does bind is that a full document load
 * applies the fragment scroll unconditionally, whereas hash handling on a client-side
 * transition is the App Router's business and not something this surface should depend
 * on to land in the right place.
 */
const BASELINE_SECTION_HREF = "/app/account#account-baseline-heading";

export function RecalibrationPrompt() {
  const dismissed = useAnchorPromptDismissed();

  // Read on every render rather than cached in state: a capture in THIS tab writes the
  // latch synchronously (see `broadcastAnchorCaptured`), so re-reading means the prompt
  // retires itself with no invalidation step and no effect to keep in sync. Cheap — one
  // localStorage hit on a component that renders once per dashboard load.
  //
  // Ordered AFTER the hook because hooks cannot sit behind a conditional return.
  if (dismissed || hasCompletedRecalibrationPrompt()) return null;

  return (
    <Dialog
      open
      // The single close path for ALL of Escape, outside-press and the corner
      // control — Radix routes every one of them through `onOpenChange(false)`.
      // Wiring the dismissal here rather than onto the "Not now" button is what
      // guarantees the three cannot diverge: a user who presses Escape has
      // dismissed just as deliberately as one who pressed the button, and both
      // must be remembered for the session or the prompt reappears on the next
      // client render and reads as a bug.
      onOpenChange={(next) => {
        if (!next) dismissAnchorPrompt();
      }}
    >
      <DialogContent
        className="max-w-sm"
        tabIndex={-1}
        // Focus the dialog itself, not a control inside it.
        //
        // Radix's default lands on the first tabbable child, and measurement showed
        // that resolving to "Not now" rather than the primary link — so an
        // unprompted modal opened with a focus ring drawn around its DISMISS action,
        // which reads as "this is the button we expect you to press". Focusing a
        // control is the wrong default here anyway: this dialog is unrequested and
        // informational, so nothing the user did implies an intent to activate
        // anything. Moving focus to the container keeps the keyboard trap and
        // announces the title + description to a screen reader, while leaving both
        // controls equally unhighlighted until the user chooses one.
        //
        // NOT a dismiss-path suppression — Escape, outside-press and the corner
        // control are all still live (see the tests that pin this).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
        }}
      >
        <DialogHeader>
          {/* leading-snug, not the DialogTitle default `leading-none`: this title wraps
              to two lines at 320px and set solid it collides with itself. */}
          <DialogTitle className="font-display text-xl leading-snug text-ink">
            Time for a fresh calibration
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Serenify records video a little differently now. A fresh calm baseline keeps
            your monitoring sessions on the same footing — about a quiet minute.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {/* The label names what the control actually does. It opens the account
              section; it does not start a capture — "Set a new baseline" is the button
              waiting at the other end, and using that wording here would promise a
              camera that is still two steps away. */}
          <Button asChild variant="meadow" className="h-11 w-full">
            <a href={BASELINE_SECTION_HREF}>Open baseline settings</a>
          </Button>
          {/* Quiet tier. Same label and treatment as the backend-down modal's calm
              exit, so "Not now" means the same thing wherever it appears. */}
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-muted"
            onClick={dismissAnchorPrompt}
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

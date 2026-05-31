"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The backend-unavailable gate (feature 005, FR-056, clarification #2). When the
 * `/healthz` probe fails, this is a TRUE blocking modal on the shared themed dialog
 * (Section 2): backdrop + focus-trap, controls beneath inert, and NO dismiss path —
 * it holds the user in the green room so they can never advance into recording
 * while the backend is down (the previous notice painted over the preview but left
 * the controls live, which was the bug).
 *
 * "Try again" re-probes `/healthz`; on success the orchestrator dismisses this and
 * returns to the normal gate. "Not now" exits via the same mode-based routing as
 * the other capture surfaces. The primary CTA is FOGGY per the colour rule. No
 * dismiss path leaves "I'm ready" enabled while still unavailable.
 */
export function BackendDownModal({
  open,
  heading,
  body,
  checking = false,
  onRetry,
  onNotNow,
}: {
  open: boolean;
  heading: string;
  body: string;
  /** the re-probe is in flight — keep the modal up, show a pending CTA */
  checking?: boolean;
  onRetry: () => void;
  onNotNow: () => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent
        hideClose
        className="max-w-sm"
        // No dismiss path: Escape, outside-press, and the X are all suppressed, so
        // the only way forward is a successful re-probe or the calm "Not now" exit.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-ink">{heading}</DialogTitle>
          <DialogDescription className="text-muted">{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={onRetry} variant="foggy" disabled={checking} className="h-11 w-full">
            {checking ? "Checking…" : "Try again"}
          </Button>
          <Button variant="ghost" onClick={onNotNow} className="h-11 w-full text-muted">
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

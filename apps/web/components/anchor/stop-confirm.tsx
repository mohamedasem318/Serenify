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
 * The honest stop confirmation (feature 005, FR-021–024). Stopping means starting
 * the minute over, and nothing is saved yet so nothing is lost. "Keep going" is the
 * easy default; confirming returns the user to the green room to re-situate. This
 * is NOT a destructive action — it does not use the destructive (crimson) colour.
 */
export function StopConfirm({
  onKeepGoing,
  onConfirmStop,
}: {
  onKeepGoing: () => void;
  onConfirmStop: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // closing via the scrim or Escape is the easy, calm default.
        if (!open) onKeepGoing();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Start the minute over?</DialogTitle>
          <DialogDescription>
            Stopping starts the calm minute again — nothing’s saved yet, so nothing’s lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={onKeepGoing} variant="meadow" className="h-11 w-full">
            Keep going
          </Button>
          {/* non-destructive: outline, never the crimson destructive variant */}
          <Button variant="outline" onClick={onConfirmStop} className="h-11 w-full">
            Start over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

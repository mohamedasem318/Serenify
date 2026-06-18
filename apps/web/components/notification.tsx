"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { CHAT_PILL_HEIGHT } from "@/components/chat-pill";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Re-export of the canonical chat-pill height so notification consumers
 * can document the stacking convention (Decision H / 📌 DECISION-11)
 * without importing two modules. Runtime contract is still the CSS
 * variable `--chat-pill-offset` on <html>; the constant exists for
 * authoring clarity, not as a runtime read.
 */
export { CHAT_PILL_HEIGHT };

export type NotificationProps = {
  /** Controlled open state. */
  open: boolean;
  /** Called with `false` when the user dismisses, or with `true` on programmatic show. */
  onOpenChange: (open: boolean) => void;
  /** Display heading — short, calm-voice. */
  title: string;
  /** Optional descriptive body. */
  body?: string;
  /** Optional action area below the body — buttons, links, questionnaire snippet. */
  children?: ReactNode;
  /** Dismiss-button label. Defaults to "Dismiss". */
  dismissLabel?: string;
};

/**
 * Calm notification surface — desktop slide-in card / mobile bottom sheet.
 *
 * Composition (📌 DECISION-5):
 *   - Radix Dialog primitives (Root / Portal / Overlay / Content /
 *     Title / Description / Close) for focus management, escape-to-
 *     dismiss, and a11y semantics.
 *   - framer-motion for entrance/exit transitions; `forceMount` +
 *     `AnimatePresence` so the exit transition runs before unmount.
 *   - reduced-motion is read through our own useMediaQuery, NOT
 *     framer-motion's useReducedMotion. framer's hook snapshots the
 *     preference once at mount via `useState(prefersReducedMotion.current)`
 *     and never re-subscribes (see its source — it carries a literal
 *     "TODO See if people miss automatically updating" note), so a
 *     preference change after mount (DevTools emulation, or an OS
 *     toggle while the tab is open) leaves the animation stale: the
 *     slide variant keeps running when it should be fade-only. Our
 *     useMediaQuery is a useSyncExternalStore subscription to the
 *     matchMedia `change` event, so it re-renders live. When it flips,
 *     opacity-only variants are selected below.
 *   - useMediaQuery to branch desktop vs mobile variant — SSR returns
 *     false (= desktop variant), which matches the server's "no
 *     viewport knowledge" default and prevents hydration mismatch. The
 *     reduced-motion read defaults to false under SSR for the same
 *     reason (full motion until the client confirms the preference).
 *
 * Layout:
 *   - Desktop (≥768px): fixed bottom-right card, max-width ≈ 320px.
 *     Positioned via inline style
 *       bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem);
 *       right: 1rem;
 *     On employee surfaces the chat pill writes 48px to the variable
 *     (81cdb39); on manager surfaces the variable is unset and the
 *     var() fallback collapses the math to bottom: 2rem (=32px) —
 *     16px above the viewport edge with no pill to stack over.
 *   - Mobile (≤767px): full-width bottom sheet pinned to inset-x-0
 *     bottom-0. The chat pill sits below the sheet's backdrop, which
 *     is intentional — modal context implies its affordances are
 *     temporarily blocked.
 *
 * Overlay (Phase 9 polish — Decision G; 007 scrim re-token — FR-021):
 *   shadcn's default DialogContent always renders a bg-black/80
 *   overlay, which is too harsh against the Graphite palette AND
 *   wrong for the desktop "non-modal slide-in" feel. Resolution:
 *     - Desktop: overlay carries `md:hidden`, so the slide-in card
 *       appears over the live page without a dimming layer.
 *     - Mobile: overlay renders with `bg-scrim` — the shared
 *       --color-scrim token (Graphite ink @ 60%, fixed in both
 *       modes) — softer than the shadcn default and unified with the
 *       dialog/sheet scrims under FR-021.
 *
 * Dismiss (📌 DECISION-6):
 *   Explicit-dismiss-only. No auto-dismiss timer. A consuming feature
 *   that wants auto-dismiss layers a setTimeout on top of
 *   onOpenChange; this base component does NOT decide that policy.
 *
 * FR-033: no production code in feature 003 mounts this component.
 * Vitest in T052 is the only consumer. Features 007 / 008 / 010 wire
 * it into their flows when they ship.
 */
export function Notification({
  open,
  onOpenChange,
  title,
  body,
  children,
  dismissLabel = "Dismiss",
}: NotificationProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const motionVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : isMobile
      ? {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 24 },
        }
      : {
          initial: { opacity: 0, x: 24 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 24 },
        };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div
                data-testid="notification-overlay"
                className="fixed inset-0 z-50 bg-scrim md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content forceMount asChild>
              <motion.div
                data-testid="notification"
                data-variant={isMobile ? "mobile" : "desktop"}
                className={cn(
                  "fixed z-50 border border-border bg-surface p-6 text-ink shadow-soft",
                  isMobile
                    ? "inset-x-0 bottom-0 rounded-t-card"
                    : // bottom expression lives in a Tailwind arbitrary-
                      // value class instead of an inline style because
                      // framer-motion's animate engine overwrites
                      // element.style each frame (opacity, transform,
                      // pointer-events); the class rule survives that
                      // overwrite. The var() chain still resolves at
                      // runtime — `--chat-pill-offset` is set on <html>
                      // by ChatPill (81cdb39) when employees mount;
                      // manager pages get the 0px fallback automatically.
                      "right-4 w-80 max-w-[calc(100vw-2rem)] rounded-card bottom-[calc(1rem+var(--chat-pill-offset,0px)+1rem)]",
                )}
                initial={motionVariants.initial}
                animate={motionVariants.animate}
                exit={motionVariants.exit}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <DialogPrimitive.Title className="font-display text-lg leading-tight text-ink">
                  {title}
                </DialogPrimitive.Title>
                {body && (
                  <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted">
                    {body}
                  </DialogPrimitive.Description>
                )}
                {children && <div className="mt-4">{children}</div>}
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="secondary"
                    className="mt-6 w-full"
                    aria-label={dismissLabel}
                  >
                    {dismissLabel}
                  </Button>
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

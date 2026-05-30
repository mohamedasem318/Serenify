"use client";

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The success moment (feature 005, FR-025/026): a calm, small earned beat — a
 * drawn check mark with a soft meadow bloom ripple — then readable supporting copy
 * (sized properly, fixing 004's under-sized text) and a single way home. Copy and
 * destination follow the mode (set → home / update → account). Reduced motion
 * (FR-048): a static check, no bloom, no path-draw.
 */
export function SuccessState({
  mode = "first-time",
  onDone,
}: {
  mode?: "first-time" | "recalibrate";
  onDone: () => void;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const heading = mode === "recalibrate" ? "Your baseline is updated" : "Your baseline is set";
  const cta = mode === "recalibrate" ? "Back to account" : "Back to home";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-2 py-6 text-center">
      <div className="relative grid size-24 place-items-center">
        {!reducedMotion ? (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-meadow/30"
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        ) : null}
        <span className="grid size-24 place-items-center rounded-full bg-meadow/15 ring-1 ring-meadow/40">
          <svg viewBox="0 0 48 48" className="size-12 text-meadow" fill="none" aria-hidden>
            <motion.path
              d="M14 25 L21 32 L35 17"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={reducedMotion ? undefined : { pathLength: 1 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            />
          </svg>
        </span>
      </div>

      <div className="space-y-2">
        <h1 className="text-balance font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
        <p className="text-pretty text-base leading-relaxed text-muted">
          We’ve learned what calm looks like for you. You can update it anytime from your account.
        </p>
      </div>

      <Button onClick={onDone} className="h-12 w-full max-w-xs text-base">
        {cta}
      </Button>
    </div>
  );
}

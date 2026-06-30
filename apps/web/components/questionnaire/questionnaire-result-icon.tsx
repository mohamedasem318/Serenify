"use client";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Feature 012 — the shared questionnaire end-state icon + message.
 *
 * Three kinds, calm-first (Principle V): `smiley` and `check` use a meadow success ring with
 * a drawn-in stroke; `muted` uses a foggy/muted ring with a static Wind glyph for a neutral
 * skip. Motion is gated by `useMediaQuery("(prefers-reduced-motion: reduce)")` (R-6 — NOT
 * Framer Motion's hook): under reduced motion the animation classes are OMITTED, so the
 * smile/check path renders fully drawn and the ring/message appear without pop/fade movement.
 *
 * The SVGs are hand-rolled from the mock's lucide path data (Smile / Check / Wind) so the
 * draw animation can target the single expressive stroke.
 */

export type QuestionnaireResultKind = "smiley" | "check" | "muted";

export function QuestionnaireResultIcon({
  kind,
  message,
}: {
  kind: QuestionnaireResultKind;
  message: string;
}) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const muted = kind === "muted";

  const ringBg = muted
    ? "bg-[color-mix(in_srgb,var(--color-muted)_12%,var(--color-surface))]"
    : "bg-[color-mix(in_srgb,var(--color-meadow)_14%,var(--color-surface))]";
  const iconColor = muted ? "text-muted" : "text-meadow";
  const pop = reduce ? "" : "qri-pop";
  const fadeup = reduce ? "" : "qri-fadeup";
  const draw = reduce ? "" : "qri-draw";

  return (
    <div
      data-testid="questionnaire-result"
      data-kind={kind}
      data-motion={reduce ? "reduced" : "full"}
      className="flex flex-col items-center py-5 text-center"
    >
      <div className={cn("grid size-14 place-items-center rounded-full", ringBg, pop)}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={kind === "check" ? 2.5 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn("size-[30px]", iconColor)}
        >
          {kind === "smiley" && (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="9" x2="9.01" y1="9" y2="9" />
              <line x1="15" x2="15.01" y1="9" y2="9" />
              <path data-testid="qri-draw-path" className={draw} pathLength={100} d="M8 14s1.5 2 4 2 4-2 4-2" />
            </>
          )}
          {kind === "check" && (
            <path data-testid="qri-draw-path" className={draw} pathLength={100} d="M20 6 9 17l-5-5" />
          )}
          {kind === "muted" && (
            <>
              <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
              <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
              <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
            </>
          )}
        </svg>
      </div>
      <p
        data-testid="questionnaire-result-message"
        className={cn("mt-3 text-[15px]", muted ? "text-muted" : "text-ink", fadeup)}
      >
        {message}
      </p>
    </div>
  );
}

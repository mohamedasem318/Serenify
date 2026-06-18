"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The six-box OTP entry + its success/failure choreography (FR-023…FR-027).
 * Source of truth for the look-and-feel: `serenify-007-otp-mock.html`. The
 * boxes are controlled by the panel (`digits` / `onDigitsChange`); the panel
 * owns the verification logic and drives this component's two animations
 * imperatively so navigation can wait for the merge to finish:
 *
 *  - playSuccess() — a meadow halo sweeps box 1→6, then the boxes slide
 *    edge-to-edge while their separators (borders + gaps) melt and they fill
 *    meadow with rounded ends, so the row *becomes* one "Verified" pill, which
 *    then lifts toward the next step. Calm ~3s, weighted so the merge reads.
 *  - playError() — a gentle low-amplitude **foggy** sway (~0.9s, ease-in-out;
 *    never a sharp red shake). The panel shows the foggy notice, then clears
 *    the digits and refocuses box 1.
 *
 * Reduced motion is decided by the PANEL (the repo's `useMediaQuery`, not
 * framer's `useReducedMotion`) and passed in as `reducedMotion`: on success the
 * sweep/merge/lift are skipped and the verified pill is shown directly before
 * navigating; on a wrong code the sway is skipped but the notice + clear still
 * happen. Never red in either path.
 */

export type OtpBoxesHandle = {
  playSuccess: () => Promise<void>;
  playError: () => Promise<void>;
};

type Props = {
  /** Six positional slots, each "" or a single digit. */
  digits: string[];
  onDigitsChange: (next: string[]) => void;
  disabled?: boolean;
  reducedMotion: boolean;
  invalid?: boolean;
};

const COUNT = 6;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Visual = {
  lit: number; // boxes lit during the halo sweep (0..6)
  merged: boolean; // separators melt, boxes fill meadow + round into one bar
  pill: boolean; // the "Verified" label resolves on the bar
  faded: boolean; // the pill fades out before the handoff (no vertical movement)
  sway: boolean; // gentle foggy sway on a wrong code
  instant: boolean; // reduced motion → state applied directly, no transitions
};

const IDLE: Visual = {
  lit: 0,
  merged: false,
  pill: false,
  faded: false,
  sway: false,
  instant: false,
};

export const OtpBoxes = forwardRef<OtpBoxesHandle, Props>(function OtpBoxes(
  { digits, onDigitsChange, disabled, reducedMotion, invalid },
  ref,
) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [visual, setVisual] = useState<Visual>(IDLE);

  // Read the latest reduced-motion preference inside the async timelines
  // without capturing a stale value from the render that created the handle.
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const focusBox = (i: number) => inputs.current[i]?.focus();

  // Return focus to box 1 the moment the boxes re-enable empty after a wrong
  // code (FR-025). Done here, not from the panel, because the panel clears +
  // re-enables in the same tick — calling .focus() before that commit lands on
  // a still-`disabled` input (a no-op). The transition-guard means this never
  // steals focus on mount or while the user is typing.
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (wasDisabled.current && !disabled && digits.every((d) => d === "")) {
      focusBox(0);
    }
    wasDisabled.current = disabled;
  }, [disabled, digits]);

  // Slide the six boxes edge-to-edge, centred, so the row reads as one bar.
  // Measured from layout; a no-op where layout is unavailable (jsdom/SSR),
  // where the pill overlay alone carries the verified state.
  function meltTogether() {
    const first = inputs.current[0];
    const row = rowRef.current;
    if (!first || !row) return;
    const w = first.getBoundingClientRect().width;
    if (w <= 0) return;
    const r = row.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    inputs.current.forEach((box, i) => {
      if (!box) return;
      const cur = box.getBoundingClientRect();
      const target = mid - (COUNT / 2) * w + i * w;
      box.style.transform = `translateX(${target - cur.left}px)`;
    });
  }

  useImperativeHandle(ref, () => ({
    async playError() {
      if (reducedRef.current) {
        await wait(450);
      } else {
        setVisual({ ...IDLE, sway: true });
        await wait(950);
        setVisual(IDLE);
      }
      await wait(150);
    },
    async playSuccess() {
      if (reducedRef.current) {
        meltTogether();
        setVisual({ lit: COUNT, merged: true, pill: true, faded: false, sway: false, instant: true });
        await wait(650);
        return;
      }
      // 1 · meadow halo sweeps box 1 → 6
      for (let i = 1; i <= COUNT; i++) {
        setVisual((v) => ({ ...v, lit: i }));
        await wait(130);
      }
      await wait(360);
      // 2 · boxes slide together, separators melt, fill meadow, round into a bar
      meltTogether();
      setVisual((v) => ({ ...v, merged: true }));
      await wait(540);
      // 3 · the bar resolves into the "Verified" pill
      setVisual((v) => ({ ...v, pill: true }));
      await wait(560);
      // 4 · the pill fades out (no vertical lift — avoids overlapping the next view)
      setVisual((v) => ({ ...v, faded: true }));
      await wait(700);
    },
  }));

  function handleChange(i: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    const next = [...digits];
    if (cleaned === "") {
      next[i] = "";
      onDigitsChange(next);
      return;
    }
    next[i] = cleaned.slice(-1);
    onDigitsChange(next);
    if (i < COUNT - 1) focusBox(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight" && i < COUNT - 1) {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, COUNT);
    if (!pasted) return;
    const next = Array.from({ length: COUNT }, (_, k) => pasted[k] ?? "");
    onDigitsChange(next);
    focusBox(Math.min(pasted.length, COUNT - 1));
  }

  return (
    <div
      className={cn(
        "relative flex min-h-[56px] justify-center",
        !visual.instant && "transition-opacity duration-700 ease-out",
        visual.faded && "opacity-0",
      )}
    >
      <motion.div
        ref={rowRef}
        className="flex w-full flex-nowrap justify-center gap-2"
        animate={visual.sway ? { x: [0, -4, 4, -2, 1, 0] } : { x: 0 }}
        transition={visual.sway ? { duration: 0.95, ease: "easeInOut" } : { duration: 0 }}
      >
        {Array.from({ length: COUNT }, (_, i) => {
          const radius = visual.merged
            ? i === 0
              ? "rounded-l-[28px] rounded-r-none"
              : i === COUNT - 1
                ? "rounded-r-[28px] rounded-l-none"
                : "rounded-none"
            : "rounded-card";
          return (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              value={digits[i] ?? ""}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={cn(
                "h-[52px] min-w-0 max-w-[52px] flex-1 border bg-bg text-center font-display text-[clamp(20px,5vw,26px)] font-medium text-ink outline-none",
                radius,
                !visual.instant &&
                  "transition-[transform,background-color,color,border-color,border-radius,box-shadow] duration-500 ease-[cubic-bezier(.4,0,.2,1)]",
                "border-border focus:border-meadow focus:ring-[3px] focus:ring-meadow/30",
                visual.sway && "border-foggy",
                i < visual.lit && !visual.merged && "border-meadow ring-[3px] ring-meadow/40",
                visual.merged && "border-transparent bg-meadow text-transparent shadow-none ring-0",
                disabled && "disabled:opacity-100",
              )}
            />
          );
        })}
      </motion.div>

      {/* The merged bar resolves into this pill. aria-live announces success to
          assistive tech; the check glyph keeps it from relying on colour. */}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 font-display text-lg font-semibold text-on-accent dark:text-bg",
          !visual.instant && "transition-opacity duration-500 ease-out",
          visual.pill ? "opacity-100" : "opacity-0",
        )}
      >
        {visual.pill && (
          <>
            <Check aria-hidden className="size-5" strokeWidth={2.5} />
            Verified
          </>
        )}
      </div>
    </div>
  );
});

"use client";

import { Info } from "lucide-react";

/**
 * OTP wrong-state notice (FR-015) — a calm **foggy soft-tint**: never amber,
 * never a sharp red. This replaces the old amber error box that lived inline in
 * `otp-panel.tsx` (`border-amber/50 bg-amber/10`). Foggy at ~10% over the panel
 * surface with a foggy hairline border; `text-ink` clears AA on the tint. The
 * info glyph carries the meaning alongside the words so it never relies on
 * colour alone, and `role="alert"` announces it to assistive tech without
 * stealing focus from the boxes.
 */
export function OtpNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2.5 text-sm leading-relaxed text-ink"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-foggy" />
      <span>{children}</span>
    </p>
  );
}

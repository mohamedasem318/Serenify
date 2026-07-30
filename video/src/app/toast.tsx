import React from "react";

import { TOAST as COPY } from "../greybox/copy";
import { TOAST as T, OS_FONT } from "./furniture";
import { TOAST as BOX } from "./geometry";
import { MailMark } from "./shell";
import { useToastIn } from "./motion";

/**
 * ══ THE MAIL NOTIFICATION — AUTHORED FURNITURE, IN DARK ═════════════════════════════
 *
 * Not a Serenify component and never will be, so it has no shipped dark variant to inherit and
 * had to be designed. It takes its values from `furniture.ts`, which is deliberately decoupled
 * from the app's palette — a browser and a mail client are not part of this product, and if
 * Serenify's tokens are ever revised the operating system around it must not move with them.
 *
 * ── THE MATERIAL ────────────────────────────────────────────────────────────────────
 *
 * macOS dark notifications are a vibrancy panel: translucent, blurred, with a catch-light along
 * the top and left where the material picks up the desktop behind it. A real `backdrop-filter`
 * buys nothing here — what sits behind this toast is the app's near-black page, so blurring it
 * produces the same flat dark at twice the render cost. So the material is faked the honest
 * way: a solid panel a few points above the page plus the hairline edge, which is what reads as
 * vibrancy at the size this is actually seen.
 *
 * ── THE ICON IS A DISAMBIGUATOR, NOT A DECORATION ───────────────────────────────────
 *
 * Beat 8's one real hazard is that a generic toast beside the Serenify viewfinder reads as
 * *Serenify* notifying him, which inverts the entire scene. The sheet's answer is the mail mark
 * established in beat 2e, ~25 seconds earlier — and its instruction is explicit: fix any
 * ambiguity by making the icon **larger and more prominent, never by moving the toast**, because
 * the adjacency is liberty L2 and is load-bearing.
 *
 * In dark, shape alone is a weaker signal than it was in the grey pass, because everything is
 * low-contrast. So the mark also carries a hue — steel-indigo, chosen by elimination against
 * every colour that already means something in this product (see `furniture.ts` § MAIL). The
 * result is that the toast differs from Serenify in shape AND hue, which is a stronger
 * disambiguation than the grey pass could offer at all.
 */
export const MailToast: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const { x, opacity } = useToastIn(startFrame);

  return (
    <div
      style={{
        position: "absolute",
        left: BOX.x,
        top: BOX.y,
        width: BOX.w,
        height: BOX.h,
        translate: `${x}px 0`,
        opacity,
        zIndex: 40,
        borderRadius: 14,
        backgroundColor: T.panel,
        // The catch-light. One hairline on the top and left only — a full border reads as a
        // drawn box, an edge on the light side reads as a material.
        boxShadow: `inset 1px 1px 0 ${T.edge}, 0 10px 28px rgba(0,0,0,0.55)`,
        fontFamily: OS_FONT,
        boxSizing: "border-box",
        padding: "12px 14px",
        display: "flex",
        gap: 12,
      }}
    >
      <MailMark size={30} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.meta,
            letterSpacing: 0.2,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{COPY.app}</span>
          <span>{COPY.when}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.title, marginTop: 2 }}>
          {COPY.sender}
        </div>
        {/* The subject is the line beat 8 exists to make readable. 14px, and it lands at
            12.8px on a phone in the beat's clock framing — well over the ~10px floor. */}
        <div style={{ fontSize: 14, color: T.body, marginTop: 2, lineHeight: 1.25 }}>
          {COPY.subject}
        </div>
      </div>
    </div>
  );
};

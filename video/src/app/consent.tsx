import React from "react";

import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { Header } from "@/components/header/header";

import { PROTAGONIST } from "../greybox/copy";
import { AppShell } from "./shell";

/**
 * ══ THE CAMERA GATE, AS THE REAL COMPONENT ══════════════════════════════════════════
 *
 * Beat 4 is the only beat in the film whose subject is a *sentence*, and it was drawn as bars.
 * That was defensible while the words were unread — the sheet says not to try to read the ~230
 * words at any speed — but the one line the beat exists to deliver, "Nothing is kept. There is
 * no bucket, no table, and no file path where a clip lands", was a hand-typed copy of a string
 * that lives in `lib/consent/copy.ts`. It is now that string, in that component, at that size.
 *
 * `<CameraConsentGate/>` needs nothing the video cannot give it: `onGrant` is an injectable prop
 * (it exists so T055 can assert zero writes on the decline path), and `useRouter` is shimmed. It
 * reads every string from `lib/consent/copy.ts` and renders two `<Facts/>` blocks, so the two
 * bordered cards the beat scrolls between are the product's own.
 *
 * ── AND THE PAGE GENUINELY DOES NOT FIT, WHICH IS THE BEAT ──────────────────────────
 *
 * Measured at 576 × 1169.9 in a 583px viewport — very nearly exactly two screens. That is why
 * the beat scrolls, and why the scroll is honest behaviour rather than a device: the copy is
 * saying "this is long because it matters" and the page is agreeing with it.
 */
export const ConsentGatePage: React.FC<{
  clock: string;
  /** How far the page has scrolled. The gate is ~two viewports tall. */
  scroll?: number;
  overlay?: React.ReactNode;
}> = ({ clock, scroll = 0, overlay }) => (
  <AppShell
    clock={clock}
    url="serenify.tech/app/consent/camera"
    overlay={overlay}
    header={<Header fullName={PROTAGONIST.fullName} email={PROTAGONIST.email} role="employee" />}
  >
    <div style={{ marginTop: -scroll }} data-probe="gate">
      {/* `onGrant` is stubbed rather than defaulted: the real one is a Server Action, and the
          default would be reached the moment anything simulated a click. Nothing in a render
          can click, but a component that could write is not something to leave loaded. */}
      <CameraConsentGate onGrant={async () => ({ status: "ok" as const })} />
    </div>
  </AppShell>
);

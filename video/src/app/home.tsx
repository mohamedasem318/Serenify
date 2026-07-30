import React from "react";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";
import { Header } from "@/components/header/header";
import { WelcomeBanner } from "@/components/home/welcome-banner";

import { PROTAGONIST } from "../greybox/copy";
import { STANDIN } from "./furniture";
import { AppShell, type TabSpec } from "./shell";

/**
 * ══ THE DASHBOARD, AS THE REAL COMPONENTS ═══════════════════════════════════════════
 *
 * Beats 3 and 6 are the same screen a quarter of an hour apart, and the difference between them
 * — the calibration banner being there and then not — is the entire content of beat 6. So both
 * render from one component and the banner is a flag.
 *
 * What is real: `<Header/>`, `<WelcomeBanner/>`, `<CalibrationBanner/>`. That is exactly what the
 * deferred register lists these two beats as owing, and it is also everything the beats read:
 * the greeting, the sentence under it, the calibration sentence and its button.
 *
 * ── WHAT STAYS A STAND-IN, AND WHY THAT IS NOT A SHORTCUT ───────────────────────────
 *
 * The real `/app` also renders `<TodaysCheckinCard/>`, `<ThingsThatMightHelpCard/>` and
 * `<RecentChatsCard/>`. All three read the database from the browser as the signed-in user —
 * `TodaysCheckinCard` takes a `userId` and runs RLS reads for the day's windows. There is no
 * session in a render and no network the video is allowed to reach, so they would render their
 * empty states: three cards saying nothing has happened today, on the beat that is supposed to
 * say the product is live. A dark stand-in is more honest than a real component lying.
 *
 * They are never read in either beat — beat 3's whole camera move is the calibration banner's
 * lift and beat 6 is a two-second hold on a click — so what they owe is bulk and a dark tone,
 * which is what they get.
 *
 * ── THE BANNER REALLY DOES POP IN, AND IT IS SESSION-SCOPED ─────────────────────────
 *
 * `<CalibrationBanner/>` gates on `useSyncExternalStore` with a server snapshot of "dismissed",
 * so it renders nothing on the first paint and appears once the client reads `sessionStorage`
 * (the ST-11 flash fix). In the product that is a post-hydration pop-in; on video at 30fps an
 * instant appearance reads as a dropped frame, which is why beat 3 fades it over six frames.
 * The component is not modified — the fade is on a wrapper.
 */

/** `app/(authed)/app/page.tsx:44` — the dashboard column. */
export const HOME_COL = "mx-auto w-full max-w-6xl space-y-10 pb-12";

/** A dark stand-in card, at the real grid's proportions. */
const Card: React.FC<{ h: number; label: string; lines?: number }> = ({ h, label, lines = 3 }) => (
  <div
    className="rounded-card border border-border"
    style={{ height: h, backgroundColor: STANDIN.surface, padding: 24 }}
  >
    <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: STANDIN.label }}>
      {label}
    </div>
    <div style={{ marginTop: 18 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{
            height: 9,
            marginBottom: 13,
            borderRadius: 4.5,
            backgroundColor: STANDIN.fill,
            width: i === lines - 1 ? "55%" : "100%",
          }}
        />
      ))}
    </div>
  </div>
);

export const HomePage: React.FC<{
  clock: string;
  /** Beat 3 shows it; beat 6's whole content is its absence. */
  calibrationBanner?: boolean;
  /** 0–1, so beat 3 can fade the post-hydration pop-in over six frames. */
  bannerOpacity?: number;
  tabs?: TabSpec[];
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ clock, calibrationBanner = false, bannerOpacity = 1, tabs, overlay, children }) => (
  <AppShell
    clock={clock}
    url="serenify.tech/app"
    tabs={tabs}
    overlay={overlay}
    header={<Header fullName={PROTAGONIST.fullName} email={PROTAGONIST.email} role="employee" />}
  >
    <div className={HOME_COL}>
      {calibrationBanner ? (
        <div data-probe="calib" style={{ opacity: bannerOpacity }}>
          <CalibrationBanner />
        </div>
      ) : null}

      <div data-probe="welcome">
        <WelcomeBanner fullName={PROTAGONIST.fullName} now={new Date(2026, 6, 30, 10, 23)} />
      </div>

      <Card h={196} label="today" lines={3} />
      <div className="grid grid-cols-1 items-start gap-6 min-[880px]:grid-cols-2">
        <Card h={168} label="things that might help" lines={3} />
        <Card h={168} label="recent chats" lines={3} />
      </div>
    </div>
    {children}
  </AppShell>
);

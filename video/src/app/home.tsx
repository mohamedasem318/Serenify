import React from "react";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";
import { Header } from "@/components/header/header";
import { ThingsThatMightHelpCard } from "@/components/home/things-that-might-help-card";
import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";
import { WelcomeBanner } from "@/components/home/welcome-banner";
import { Card } from "@/components/ui/card";
import { BOT_NAME } from "@/lib/chat/constants";
import { ChevronDown, Plus } from "lucide-react";

import { PROTAGONIST } from "../greybox/copy";
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
 * ══ THE THREE CARDS ARE REAL EMPTY STATES, AND THE SKELETONS WERE A BUG ═════════════
 *
 * They used to be dark rectangles with a small uppercase label and three grey bars each — which
 * is a **loading skeleton**, and loading skeletons that never resolve is not something the
 * product does. Software stuck mid-load is the single most legible way for a screen to say "this
 * is a mock-up", and it was saying it for four seconds on the beat whose whole job is *he is in,
 * and it is real*.
 *
 * The previous reasoning for the stand-ins was that the real cards "would render their empty
 * states: three cards saying nothing has happened today, on the beat that is supposed to say the
 * product is live". That got the trade backwards. **At beat 3 he signed up ninety seconds ago, so
 * an empty account is not a compromise — it is the truth**, and the product ships written empty
 * states precisely because a new account is a normal thing to be. The card that says "Suggestions
 * land here when they're useful" is a product with a point of view. Three grey bars are a
 * product that is broken.
 *
 * ── WHICH ONES ARE IMPORTED, AND WHY THE THIRD IS NOT ───────────────────────────────
 *
 * Two of the three are the shipped components, mounted so they take their **no-data branch with
 * no network at all**:
 *
 *  · `<ThingsThatMightHelpCard/>` takes no props and reads nothing. It is a single state.
 *  · `<TodaysCheckinCard/>` with **no `userId`** returns its static default — and its effect
 *    early-returns on the missing id, so nothing is fetched, nothing is awaited, and nothing can
 *    fail. That branch is not a degradation: it is what the page renders before the server has
 *    wired props, and it is the state that carries the **"Start check-in"** CTA — which is the
 *    control beat 6 clicks. The beat had been clicking a grey rectangle.
 *
 * `<RecentChatsCard/>` cannot be imported, and the reason is structural rather than a matter of
 * taste. It calls `loadConversations()` from `app/(authed)/app/chat/actions` — a `"use server"`
 * module that pulls in `next/cache` and `@/lib/supabase/server` — so importing it drags a
 * server-only dependency graph into a Remotion bundle. So its empty branch is **reproduced**,
 * with its class strings and copy quoted character-for-character from
 * `components/home/recent-chats-card.tsx:95-128`, exactly as `shell.tsx` reproduces the layout
 * contract of the `(authed)` server layout for the same class of reason. Every string and every
 * class carries its source; if the component's empty state is ever reworded, this is the one
 * place in the film that will disagree with it, and a disagreement here is a bug rather than a
 * liberty.
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

/**
 * `<RecentChatsCard/>`'s empty branch, reproduced.
 *
 * **Not a redraw — a transcription.** Every class string and both strings of copy are quoted from
 * `components/home/recent-chats-card.tsx`, with line citations, because the component itself
 * cannot be imported into a Remotion bundle (see the header: it reaches a `"use server"` module).
 * What is dropped is only what has no visual presence in an empty card and could not work in a
 * render anyway: the rename/delete dialogs, the router push, the `localStorage` collapse read and
 * the conversation list that has nothing in it.
 *
 * `BOT_NAME` is imported rather than typed, so "Ren" here cannot drift from "Ren" in the chat
 * beat — that is the one string in this card that appears twice in the film.
 */
export const RecentChatsEmpty: React.FC = () => (
  // `:95` — `<Card className="overflow-hidden" data-testid="recent-chats-card">`
  <Card className="overflow-hidden" data-testid="recent-chats-card">
    {/* `:96` */}
    <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:py-4">
      {/* `:97` */}
      <h3 className="shrink-0 font-display text-xl text-ink">Recent chats</h3>
      {/* `:100` */}
      <span className="hidden truncate text-[13px] text-muted sm:inline">with {BOT_NAME}</span>
      {/* `:106` — the "+ New chat" chip. A `<span>` here rather than a `<button>`: nothing in a
          render can be clicked, and a real button would carry a focus ring the film never asks
          for. Every visual class is the component's. */}
      <span className="relative ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-meadow px-2.5 py-1 text-[12.5px] font-semibold text-meadow-text">
        <Plus aria-hidden className="h-3.5 w-3.5" /> New chat
      </span>
      {/* `:114` — the collapse toggle, expanded (the film never collapses it). */}
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted">
        <ChevronDown aria-hidden className="h-4 w-4" />
      </span>
    </div>

    {/* `:124-128` — the `conversations.length === 0` branch, verbatim. */}
    <p className="px-4 py-5 text-sm leading-relaxed text-muted">
      You haven&apos;t started a chat yet. When you do, threads stay here so you can pick them
      back up.
    </p>
  </Card>
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

      {/*
       * The real cards, in their real no-data states. `TodaysCheckinCard` takes no `userId`, so
       * its effect early-returns and it renders the static default — which is also the state that
       * carries the "Start check-in" CTA beat 6 clicks. The `min-[880px]:grid-cols-2` is the
       * dashboard's own breakpoint (`app/(authed)/app/page.tsx`) and resolves to two columns at
       * the 1200px world.
       */}
      <div data-probe="today">
        <TodaysCheckinCard />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 min-[880px]:grid-cols-2">
        <div data-probe="help">
          <ThingsThatMightHelpCard />
        </div>
        <div data-probe="chats">
          <RecentChatsEmpty />
        </div>
      </div>
    </div>
    {children}
  </AppShell>
);

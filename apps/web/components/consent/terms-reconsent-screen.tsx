"use client";

/* Hallmark · component: re-consent screen · genre: editorial · theme: Graphite (existing — theme selection skipped)
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass · tokens: zero added · pre-emit critique: P5 H5 E4 S5 R5 V4
 */

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

import { grantConsent } from "./actions";

/**
 * The Terms/Privacy re-consent screen (T065, FR-043d, §7.3).
 *
 * THE ENTIRE EXPERIENCE OF A BLOCKED USER. `(authed)/layout.tsx` returns this INSTEAD of
 * the Header + main + ChatPill shell, so nothing else is on screen: no navigation, no
 * theme control, no way out of it but through it. That is what makes the three controls
 * below non-negotiable rather than courteous — two documents to read and one way to sign
 * out are the whole surface (FR-043d).
 *
 * THERE IS NO DECLINE CONTROL, and its absence is the design. Declining is the absence of
 * accepting: it writes nothing, deletes nothing, and records no withdrawal state (§7.5,
 * FR-042). A "Decline" button would have to do something, and the only honest something
 * is "navigate away", which every browser already offers. Feature 018 owns withdrawal.
 *
 * BOTH DOCUMENT LINKS OPEN IN A NEW TAB. Not a preference — this screen is the only place
 * the accept control exists, and a same-tab navigation to /terms would replace it. A new
 * tab means the user reads in full and comes back to a surface that is still there
 * (§7.3, FR-043d). `/terms` and `/privacy` live in the `(public)` group, outside
 * `(authed)`, so the gate cannot run for them at all — the guarantee is structural.
 *
 * SIGNING OUT IS NOT GATED BY THIS RENDER. `<SignOutButton>` posts to the `signOut`
 * server action at `app/(authed)/actions.ts:6`; a server action is invoked by POST, not
 * by a layout render, so it works from inside a blocked shell exactly as it does outside
 * one.
 *
 * The `versionId` prop is resolved on the SERVER, from the registry, by the layout —
 * §7.3 fixes that call shape. It is displayed, not submitted: `grantConsent()` takes one
 * argument (the consent key) and resolves the version itself, so no caller can name the
 * revision a record is written against (`./actions.ts:24-48`).
 *
 * VOICE (constitution Principle V): calm, plainspoken, no exclamation marks, never
 * alarmist. A user meeting this screen has done nothing wrong — the wording changed, and
 * they are being asked to read it. The copy says that and stops.
 *
 * No browser storage of any kind (FR-051).
 */

/** Every string on this surface, together, so the wording is read as a whole. */
const COPY = {
  regionLabel: "Revised Terms of Service and Privacy Policy",
  title: "The Terms and Privacy Policy have been revised",
  lede:
    "Serenify has published a revised Terms of Service and Privacy Policy. Please read " +
    "the current wording and acknowledge it to continue.",
  note: "Both documents open in a new tab, so this screen stays where it is.",
  documentsHeading: "The revised documents",
  termsText: "Terms of Service",
  termsLabel: "Read the Terms of Service (opens in a new tab)",
  privacyText: "Privacy Policy",
  privacyLabel: "Read the Privacy Policy (opens in a new tab)",
  accept: "Agree and continue",
  writeError: "Your acknowledgement was not saved. Please try again.",
  revisionLead: "Acknowledging records revision",
  revisionTail: "against your account.",
} as const;

const DOCUMENTS = [
  { href: "/terms", text: COPY.termsText, label: COPY.termsLabel },
  { href: "/privacy", text: COPY.privacyText, label: COPY.privacyLabel },
] as const;

export function TermsReconsentScreen({
  versionId,
  onGrant = grantConsent,
}: {
  /** The current `terms_privacy` revision id, resolved on the server by the layout. */
  versionId: string;
  /**
   * The write action. Defaults to the real one; injectable so T069 can assert the call
   * shape against a recording fake — including that no version argument is passed —
   * with no database present at all.
   */
  onGrant?: (key: "terms_privacy") => Promise<{ status: "ok" } | { status: "error" }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function accept() {
    startTransition(async () => {
      setFailed(false);
      const result = await onGrant("terms_privacy");
      if (result.status === "ok") {
        // Silent success. Re-running the layout re-reads the consent, now satisfied, and
        // renders the normal shell — the app itself is the confirmation, so nothing has
        // to announce it.
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  }

  return (
    // Mirrors `(auth)/layout.tsx`: no card chrome, the surface IS the page, centred in a
    // narrow measure. `flex-1` fills the `min-h-dvh` column the layout wraps this in.
    // px-4 keeps a 288px content column at 320px — the width that matters most here,
    // because this screen is all a blocked user has (FR-053, SC-008).
    <main
      aria-label={COPY.regionLabel}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6 sm:py-16"
    >
      <header className="space-y-5">
        <Wordmark className="text-3xl leading-none sm:text-4xl" />
        <div className="space-y-3">
          <h1 className="text-balance font-display text-2xl leading-tight text-ink sm:text-3xl">
            {COPY.title}
          </h1>
          <p className="text-pretty text-base leading-relaxed text-muted">{COPY.lede}</p>
        </div>
      </header>

      <section className="space-y-3 rounded-card border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-display text-lg leading-tight text-ink">
          {COPY.documentsHeading}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{COPY.note}</p>
        {/* One row per document. Each is a full-width 44px target (FR-053) whose label is
            two words, so it cannot wrap to a second line at 320px. */}
        <ul className="-mx-2 flex flex-col">
          {DOCUMENTS.map((document) => (
            <li key={document.href}>
              <a
                href={document.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={document.label}
                className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2
                  text-base text-meadow-text underline underline-offset-4 hover:no-underline
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {document.text}
                <ExternalLink aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        {failed && (
          // The house inline-note idiom: a foggy tint, never crimson. A write that did
          // not land is an unfinished step, not a fault of the person reading this.
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {COPY.writeError}
          </p>
        )}

        <Button
          type="button"
          variant="meadow"
          onClick={accept}
          disabled={pending}
          className="h-12 w-full text-base"
        >
          {COPY.accept}
        </Button>

        {/* Quiet tier, deliberately. Signing out is always available (FR-043d) and is
            never the encouraged path — but it is a real control, so it keeps a full 44px
            target rather than shrinking into a footnote. */}
        <SignOutButton variant="ghost" className="h-11 w-full text-base" />

        <p className="break-words text-center text-xs leading-relaxed text-muted">
          {COPY.revisionLead} {versionId} {COPY.revisionTail}
        </p>
      </div>
    </main>
  );
}

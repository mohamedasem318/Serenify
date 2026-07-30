import React from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { TermsAcknowledgementField } from "@/components/consent/terms-acknowledgement-field";
import { Field } from "@/components/ui/auth/field";
import { PasswordRequirements } from "@/components/ui/auth/password-requirements";

import { PROTAGONIST } from "../greybox/copy";
import { OTP_TIMELINE, OtpChoreography } from "./otp";
import { Desktop, type TabSpec } from "./shell";

/**
 * ══ SIGNUP, AS THE REAL COMPONENTS ══════════════════════════════════════════════════
 *
 * Beat 2 is the credibility spend — fifteen seconds chosen deliberately over a four-second
 * montage — and it was the last long stretch of the film still made of drawn rectangles. Every
 * surface in it is now the shipped component: `<Field/>`, `<PasswordRequirements/>`,
 * `<TermsAcknowledgementField/>`, `<Wordmark/>`, and `<OtpBoxes/>` through `<OtpChoreography/>`.
 *
 * ── THE FORM'S ORCHESTRATOR IS NOT USED, AND THE LAYOUT IS RESTATED ─────────────────
 *
 * `<SignupForm/>` is react-hook-form + `zodResolver` + three Server Actions. None of that can
 * run in a Remotion bundle and none of it is visual; what IS visual is its sub-components and
 * its class strings, both of which are here verbatim with a citation each. Same contract as
 * `shell.tsx` — anything with visual substance is the real component, anything that is only a
 * layout decision is quoted.
 *
 * ── THREE THINGS THE REAL SURFACE TURNED OUT NOT TO BE ──────────────────────────────
 *
 * The greybox drew a 512px bordered card, centred, under the public navbar. All three are wrong:
 *
 *  · **There is no card.** `app/(auth)/layout.tsx` is explicit — "no card chrome — the page IS
 *    the surface". The form sits on the page background.
 *  · **There is no public navbar.** The `(auth)` group has its own shell: a `max-w-md` (448)
 *    column with the **wordmark** at `text-4xl sm:text-5xl` and the theme toggle, and nothing
 *    else. Beat 2 was showing a bar that does not exist on `/signup`.
 *  · **The column is 448, not 512**, and the fields are 48px tall with `text-xs uppercase`
 *    labels rather than the greybox's mono ones.
 *
 * ── AND THE CONSENT ROW IS A REAL GATE, NOT A DRAWN TICK ────────────────────────────
 *
 * `<TermsAcknowledgementField/>` is the feature-013 acknowledgement, and it renders the real
 * links to `/terms` and `/privacy`. It is deliberately impossible to pre-check from a call site
 * — there is no `checked` prop, because the acknowledgement has to be an act — so the video
 * drives it the way a person does: by putting `checked` on the DOM node per frame through a
 * scoped attribute selector, at the frame the cursor clicks it. Nothing about the component is
 * modified, and the tick that appears is the browser's own `accent-meadow` checkbox.
 */

/** `app/(auth)/layout.tsx:37` — the auth column. `max-w-md` = 448. */
export const AUTH_COL =
  "mx-auto flex w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16";
/** `app/(auth)/layout.tsx:38` — the wordmark row. */
const AUTH_HEADER = "mb-10 flex items-baseline justify-between sm:mb-12";

/**
 * `min-h-dvh` is NOT reproduced, and that is not an oversight.
 *
 * `dvh` resolves against the real browser window, which in a render is 1080px tall — not the
 * film's 583px page viewport. Left in, the column would centre itself against a viewport twice
 * the height of the one on screen and the form would sit off the bottom of the frame. Same
 * reason `shell.tsx` restates the authed layout rather than importing it.
 */
const PAGE_H = 583;

/** The theme toggle's slot. `ThemeToggle` reads `next-themes`, which this bundle has no provider
 *  for; its own `mounted` guard renders the moon at first paint either way, so it is drawn as the
 *  component would render it rather than pulled in for a 16px glyph. */
const ThemeSlot: React.FC = () => (
  <span
    aria-hidden
    className="inline-flex h-11 w-11 items-center justify-center rounded-control text-muted"
  >
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  </span>
);

export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight: PAGE_H }} className={AUTH_COL}>
    <header className={AUTH_HEADER}>
      <span className="inline-flex items-baseline gap-2">
        <Wordmark className="text-4xl leading-none sm:text-5xl" />
      </span>
      <ThemeSlot />
    </header>
    {children}
  </div>
);

/**
 * The signup form, at its real layout.
 *
 * `<Field/>` is uncontrolled in the app (react-hook-form spreads `register()` onto it), so it is
 * given a `value` and a no-op `onChange` here and driven from the frame — the same way the video
 * drives every other real input. The password field renders `<PasswordInput/>` through the same
 * component, so the reveal toggle and the 48px height are the product's.
 */
export const SignupSurface: React.FC<{
  fullName: string;
  email: string;
  password: string;
  /** Which field carries the focus ring. The real one is `focus-visible`, which a render has no
   *  way to trigger, so it is applied through a scoped stylesheet using the component's own
   *  focus classes. */
  focus?: "full_name" | "email" | "password" | null;
  consent?: boolean;
  submitting?: boolean;
}> = ({ fullName, email, password, focus = null, consent = false, submitting = false }) => (
  <section className="space-y-8" data-signup>
    {/* `focus-visible:` cannot be provoked in a headless render — there is no keyboard and no
        heuristic to satisfy — so the ring is applied by the same selector the component's own
        class would match. Values quoted from `field.tsx:49`. */}
    <style>{`
      [data-signup] input { transition: none !important; }
      ${
        focus
          ? `[data-signup] #${focus} {
               border-color: var(--color-meadow) !important;
               outline: 2px solid var(--color-meadow) !important;
               outline-offset: 0 !important;
             }`
          : ""
      }
      ${consent ? `[data-signup] #accept_terms { accent-color: var(--color-meadow); }` : ""}
    `}</style>

    {/* `signup-form.tsx:160-167` */}
    <header className="space-y-2">
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
        Create your account
      </h1>
      <p className="text-sm leading-relaxed text-muted">A calm way to notice workplace stress.</p>
    </header>

    <div className="space-y-6">
      <Field id="full_name" label="Full name" value={fullName} onChange={() => {}} />
      <Field id="email" label="Email" type="email" value={email} onChange={() => {}} />
      <div className="space-y-2">
        <Field id="password" label="Password" type="password" value={password} onChange={() => {}} />
        <PasswordRequirements id="password-requirements" value={password} />
      </div>

      {/* The real acknowledgement. `checked` is driven through the DOM rather than a prop,
          because the component deliberately has no way to be pre-checked. */}
      <div ref={(node) => {
        const box = node?.querySelector<HTMLInputElement>("#accept_terms");
        if (box) box.checked = consent;
      }}>
        <TermsAcknowledgementField versionId="terms-2026-07-24" />
      </div>

      {/* `signup-form.tsx:252-258` */}
      <button
        type="button"
        className="inline-flex h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-sm font-medium text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <span className="text-meadow-text underline-offset-4">Sign in</span>
      </p>
    </div>
  </section>
);

/**
 * The "Check your email" state, and the OTP panel inside it.
 *
 * Both are the real markup: `signup-form.tsx:101-144` for the heading and body,
 * `otp-panel.tsx:194-276` for the panel's shell, the helper text, the `Code for …` line and the
 * success note's reserved slot. The boxes and their whole 2.94s choreography are
 * `<OtpChoreography/>`, which drives the shipped `<OtpBoxes/>`.
 *
 * The note's slot is mounted for the entire success sequence rather than appearing with the
 * note, which is the component's own reasoning (`otp-panel.tsx:244-247`): reserving it means the
 * note's entrance two seconds later costs no layout shift, and in a film a layout shift under a
 * held camera reads as a mistake.
 */
export const CheckEmailSurface: React.FC<{
  /** Frame `playSuccess()` would have been called on. Omit to leave the boxes empty. */
  otpFrom?: number;
  digits?: string[];
  /** 0–1, the muted note's fade. Driven by the beat from `OTP_TIMELINE.noteAt`. */
  note?: number;
}> = ({ otpFrom, digits = ["4", "1", "8", "3", "0", "2"], note = 0 }) => (
  <section className="space-y-6">
    <header className="space-y-2">
      <h1 className="font-display text-2xl text-ink sm:text-3xl">Check your email</h1>
      <p className="text-sm leading-relaxed text-muted">
        We sent a confirmation link to <span className="text-ink">{PROTAGONIST.email}</span>. Open
        it on this device to finish setting up your account.
      </p>
    </header>

    <section
      aria-labelledby="otp-heading"
      className="space-y-4 rounded-card border border-border bg-surface px-3 py-5 sm:px-4"
    >
      <div className="space-y-1.5">
        <h2 id="otp-heading" className="text-xs font-medium uppercase tracking-wide text-muted">
          Enter the code instead
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          The email also includes a 6-digit code. Enter it here if the link doesn&apos;t work.
        </p>
      </div>

      <p className="text-xs text-muted">
        Code for <span className="text-ink">{PROTAGONIST.email}</span>
      </p>

      {otpFrom === undefined ? null : (
        <OtpChoreography digits={digits} startFrame={otpFrom} />
      )}

      <div className="flex min-h-5 items-center justify-center">
        <p className="text-xs text-muted" style={{ opacity: note }}>
          Taking you in…
        </p>
      </div>
    </section>

    <p className="pt-2 text-sm text-muted">
      Wrong email? <span className="text-meadow-text underline-offset-4">Start over</span>
    </p>
  </section>
);

export const AuthPage: React.FC<{
  clock: string;
  url: string;
  tabs?: TabSpec[];
  active?: number;
  caret?: boolean;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}> = ({ clock, url, tabs, active, caret, overlay, children }) => (
  <Desktop clock={clock} url={url} tabs={tabs} active={active} caret={caret} overlay={overlay}>
    <AuthShell>{children}</AuthShell>
  </Desktop>
);

export { OTP_TIMELINE };

import { Check } from "lucide-react";

import {
  TERMS_ACK_LABEL_JOIN,
  TERMS_ACK_LABEL_LEAD,
  TERMS_ACK_LABEL_TAIL,
  TERMS_ACK_PRIVACY_LINK_LABEL,
  TERMS_ACK_PRIVACY_LINK_TEXT,
  TERMS_ACK_TERMS_LINK_LABEL,
  TERMS_ACK_TERMS_LINK_TEXT,
} from "@/lib/consent/copy";

/**
 * The signup acknowledgement field (T044, FR-033/FR-034, §7.1).
 *
 * UNCHECKED BY DEFAULT, ALWAYS. There is no `defaultChecked`, no `checked` prop, and no
 * way for a caller to pre-check it — the acknowledgement has to be an act. The server
 * agrees independently: signUpSchema requires the literal "on", which an unchecked box
 * never submits (lib/auth/schemas.ts).
 *
 * The version id arrives as a PROP, resolved by the /signup server component from the
 * registry. This component does not import the registry: it renders in the client
 * bundle, and pulling the registry in here would ship the whole published history to
 * every visitor's browser to display one string.
 *
 * The hidden input carries what the page RENDERED, so the server can detect that the
 * documents were revised while this form sat open. It is never the value that gets
 * stored (§7.1 step 3).
 *
 * Both links open in a NEW TAB. That is not a preference — the signup form must not be
 * unmounted, because a half-filled form has a password in it, web storage is forbidden
 * (FR-051), and a URL round-trip would put that password in a query string. A new tab is
 * the only route that loses nothing (§7.1, FR-034).
 *
 * Links nested inside a <label> are safe here and not an accident: the HTML spec gives
 * label activation no effect when the event target is interactive content, so clicking
 * "Privacy Policy" follows the link and does NOT toggle the checkbox.
 *
 * No browser storage of any kind (FR-051).
 */

/** Shared by both document links — the repo's inline text-link idiom, plus a focus ring. */
const DOCUMENT_LINK_CLASS =
  "rounded-sm text-meadow-text underline underline-offset-4 hover:no-underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/**
 * The subset of react-hook-form's `register()` return this component spreads. Typed
 * structurally rather than imported, so the component stays usable (and testable) with
 * no form library present — the no-JS path renders it with `registration` omitted and
 * the plain `name="accept_terms"` below carries the submission.
 */
type CheckboxRegistration = {
  name: string;
  // The parameter shape mirrors react-hook-form's `ChangeHandler` rather than widening
  // to `unknown`: under strictFunctionTypes a handler is only assignable to one whose
  // parameter it can itself accept, so `(event: unknown)` would reject the real thing.
  onChange: (event: { target: unknown; type?: unknown }) => unknown;
  onBlur: (event: { target: unknown; type?: unknown }) => unknown;
  ref: (instance: HTMLInputElement | null) => void;
};

export function TermsAcknowledgementField({
  versionId,
  error,
  registration,
}: {
  /** The current `terms_privacy` revision id, resolved on the server. */
  versionId: string;
  /** Field-scoped rejection message, rendered beneath the row when present. */
  error?: string;
  /** `register("accept_terms")`, when a form library is driving the JS path. */
  registration?: CheckboxRegistration;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {/* The 44px tap target (FR-053) is the padding, and the negative margin hangs it
            outside the flow so the 20px box still aligns optically with the first line of
            the label. Sizing the checkbox itself to 44px would read as a crate.

            This wrapper is a <label>, not a <span>. As a span the padded ring swallowed
            clicks and toggled nothing, so the real hit area was the bare 20px box and
            the 44px claim was decoration. Two labels for one control is valid HTML — the
            second one below carries the text — and it is what makes the padding
            genuinely clickable. */}
        <label
          htmlFor="accept_terms"
          className="-m-3 grid shrink-0 cursor-pointer p-3"
        >
          {/* `appearance-none` — WE draw this box, not the browser (Mohamed,
              2026-08-05). The UA-rendered checkbox ignored author borders entirely
              (computed width 0 in Chromium) and painted its own browser-chosen rim,
              outside the token system. Custom rendering puts it on
              `border-control-strong` (Amendment 21): the EMPTY-AFFORDANCE boundary,
              3:1 in BOTH modes — this box has no label-per-element, no content and no
              fill, so its border is the whole affordance and stays visible even in
              dark, where the labeled inputs beside it deliberately rest on the quiet
              `--color-control` (Amendment 20). Checked state is a meadow fill with
              the filled-accent foreground pair (Principle V), drawn as an inline
              lucide glyph in the same grid cell — NOT a CSS background-image, which
              the CSP's `img-src 'self'` would block as a data: URI. The glyph follows
              peer-checked, so the no-JS path renders it identically. */}
          <input
            id="accept_terms"
            name="accept_terms"
            type="checkbox"
            // `value="on"` is what an HTML checkbox submits by default, and it is what
            // signUpSchema's z.literal("on") expects. Stating it explicitly also makes
            // react-hook-form report the string "on" rather than a boolean, so one
            // schema covers the JS and no-JS submissions identically.
            value="on"
            {...registration}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "accept_terms-error" : undefined}
            className="peer col-start-1 row-start-1 size-5 cursor-pointer appearance-none
              rounded-sm border border-control-strong bg-transparent
              checked:border-meadow checked:bg-meadow
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-bg
              disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none col-start-1 row-start-1 size-3.5 place-self-center
              text-on-accent opacity-0 peer-checked:opacity-100 dark:text-bg"
          />
        </label>

        <label
          htmlFor="accept_terms"
          className="cursor-pointer text-sm leading-relaxed text-muted"
        >
          {TERMS_ACK_LABEL_LEAD}{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={TERMS_ACK_TERMS_LINK_LABEL}
            className={DOCUMENT_LINK_CLASS}
          >
            {TERMS_ACK_TERMS_LINK_TEXT}
          </a>{" "}
          {TERMS_ACK_LABEL_JOIN}{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={TERMS_ACK_PRIVACY_LINK_LABEL}
            className={DOCUMENT_LINK_CLASS}
          >
            {TERMS_ACK_PRIVACY_LINK_TEXT}
          </a>
          {TERMS_ACK_LABEL_TAIL}
        </label>
      </div>

      {/* Matches the repo's existing inline-error idiom (signup-form.tsx's exists/error
          notes): a foggy-tinted note, never crimson — a missing acknowledgement is an
          unfinished step, not a fault. */}
      {error && (
        <p
          id="accept_terms-error"
          role="alert"
          className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
        >
          {error}
        </p>
      )}

      <input type="hidden" name="terms_privacy_version" value={versionId} />
    </div>
  );
}

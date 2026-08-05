import { TERMS_ACK_REQUIRED_MESSAGE } from "@/lib/consent/copy";

import type { SignUpResult } from "@/app/(auth)/signup/actions";

/**
 * The no-JS refusal marker (#184). `signUpFromForm` runs when JavaScript hasn't
 * loaded, and until this module existed every refused submission fell through to a
 * silent full-page reload — cleared fields, no message (smoke-tests.md ST-9, failed
 * and knowingly accepted for feature 013).
 *
 * The contract, in one place so both ends stay honest:
 *
 * - The POST redirects to `/signup?state=refused&reason=<marker>` — a FIXED enum
 *   marker only. Never a field value, never the email, never message text: message
 *   text in a URL is attacker-craftable page content, and credentials in a URL is
 *   precisely what the void-return path was protecting against.
 * - The signup page maps the marker back to the same `SignUpResult` the JS path
 *   produces, and the form renders it through its EXISTING branches — the copy is
 *   written once, in the branches (and in the constants below, which `signUp()`
 *   itself returns). No second validation path, no second copy source (T043).
 *
 * One honest loss: a non-terms field refusal ("fields") re-renders as the generic
 * check-the-fields line rather than the per-field zod message — carrying per-field
 * text would mean message text in the URL. The acknowledgement gate, which is the
 * refusal ST-9 exercised, keeps its exact copy.
 */

/** `?state=` value marking a refused no-JS submission. `check_email` remains the ok marker. */
export const SIGNUP_REFUSED_STATE = "refused";

export type SignupRefusalReason = "terms" | "stale_terms" | "exists" | "fields" | "error";

/** Also the fallback `signUp()` uses when zod reports no first issue. */
export const SIGNUP_CHECK_FIELDS_MESSAGE = "Please check the fields and try again.";
/** The fixed generic returned for a vendor-side failure (Slice 2 Finding 8). */
export const SIGNUP_GENERIC_ERROR_MESSAGE = "Something went wrong — please try again.";

/** The redirect target for a refused no-JS submission. Marker only — nothing user-supplied. */
export function refusalRedirectPath(result: Exclude<SignUpResult, { status: "ok" }>): string {
  const reason: SignupRefusalReason =
    result.status === "validation"
      ? result.field === "accept_terms"
        ? "terms"
        : "fields"
      : result.status;
  return `/signup?state=${SIGNUP_REFUSED_STATE}&reason=${reason}`;
}

/**
 * Rebuilds the `SignUpResult` a marker stands for, for seeding the form's submit
 * state on a no-JS re-render. Unknown or absent markers rebuild nothing — the URL is
 * input, so anything outside the enum is ignored rather than rendered.
 */
export function refusalFromParam(reason: string | null | undefined): SignUpResult | null {
  switch (reason) {
    case "terms":
      return { status: "validation", field: "accept_terms", message: TERMS_ACK_REQUIRED_MESSAGE };
    case "stale_terms":
      return { status: "stale_terms" };
    case "exists":
      return { status: "exists" };
    case "fields":
      return { status: "validation", field: "", message: SIGNUP_CHECK_FIELDS_MESSAGE };
    case "error":
      return { status: "error", message: SIGNUP_GENERIC_ERROR_MESSAGE };
    default:
      return null;
  }
}

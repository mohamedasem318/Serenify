/**
 * Feature 013 — the consent wording (T039).
 *
 * Every string the two P4 gates render, as named exported constants. The components
 * hold NO string literals: `research.md` §6.3 names this module and `lib/legal/copy.ts`
 * as the home of consented text, and a gate that inlines its own prose puts the wording
 * outside the review surface a reviewer actually reads.
 *
 * PUBLISHING RULE (`research.md` §6.1). This wording and its registry entry
 * (`camera_inference@2026-07-26.1` in `./registry.ts`) landed in the SAME pull request.
 * Editing the camera wording below is therefore not a copy tweak: it requires appending
 * a NEW registry revision with an explicit materiality judgment, in that same PR. The
 * frozen snapshot in `tests/unit/lib/consent/published-revisions.snapshot.json` is what
 * makes that non-optional.
 *
 * WHAT THIS TEXT MUST BE TRUE ABOUT (FR-001, cross-checked against `lib/legal/copy.ts`
 * §"Your camera, and what happens to the video"): video IS transmitted for inference, IS
 * deleted on every outcome including errors, is NEVER persisted, and no human — including
 * an administrator — can view or replay it. The tempting lie for a surface asking camera
 * permission is that the video never leaves the machine. It does leave. This says so
 * first, before it says anything reassuring.
 *
 * MANAGER VISIBILITY IS NOT MENTIONED AT ALL, deliberately. The camera gate asks one
 * question — may Serenify capture and infer on webcam video — and a visibility claim
 * bolted onto that ask would be either a blanket promise this system breaks (FR-002) or a
 * qualified digression from the decision at hand. The Privacy Policy states visibility
 * plainly and in full; this surface links to it rather than paraphrasing it.
 *
 * TERMINOLOGY IS BINDING (`plan.md` §11): **calibration** = baseline capture ·
 * **monitoring session** = live camera inference · **weekly work-environment check-in** =
 * the text questionnaire. Bare "check-in" is never used.
 *
 * VOICE (constitution Principle V): calm, plainspoken, no exclamation marks, never
 * alarmist. This is a permission ask, not a warning. Zero numeric quality metrics
 * (FR-004) — no model performance figure appears in any string below.
 */

// ── The signup acknowledgement field (T044) ──────────────────────────────────
//
// The checkbox is unchecked by default and cannot be satisfied by a default value
// (FR-033). The two documents open in a NEW TAB so the half-filled signup form is never
// unmounted — no field value is lost, and nothing has to be stashed anywhere, which
// matters because web storage is forbidden by FR-051 and a URL round-trip would put a
// password in a query string (§7.1).

export const TERMS_ACK_LABEL_LEAD = "I have read and agree to the";
export const TERMS_ACK_LABEL_JOIN = "and the";
export const TERMS_ACK_LABEL_TAIL = ".";

export const TERMS_ACK_TERMS_LINK_TEXT = "Terms of Service";
export const TERMS_ACK_PRIVACY_LINK_TEXT = "Privacy Policy";

/** Accessible names say the destination AND that it opens in a new tab (§7.1, FR-034). */
export const TERMS_ACK_TERMS_LINK_LABEL = "Read the Terms of Service (opens in a new tab)";
export const TERMS_ACK_PRIVACY_LINK_LABEL = "Read the Privacy Policy (opens in a new tab)";

/**
 * The field-scoped rejection message, fixed verbatim by `contracts/consent-gates.md`
 * §7.1. It is declared here and referenced by `lib/auth/schemas.ts` so the schema and the
 * surface cannot drift apart.
 */
export const TERMS_ACK_REQUIRED_MESSAGE =
  "Please accept the Terms and Privacy Policy to continue.";

/**
 * Shown when the page was rendered against a revision that is no longer current — the
 * documents were revised while this form sat open. The submission is refused rather than
 * recorded against the wrong wording (§7.1 step 2).
 */
export const TERMS_ACK_STALE_MESSAGE =
  "The Terms and Privacy Policy were updated while this page was open. The current " +
  "wording is linked above — please read it and accept again.";

// ── The camera-and-inference gate (T048) ─────────────────────────────────────

export const CAMERA_GATE_TITLE = "Before the camera turns on";

export const CAMERA_GATE_LEDE =
  "Calibration and monitoring sessions use your webcam. This is the one thing Serenify " +
  "asks permission for separately, because it is the one thing worth reading about first.";

export const CAMERA_GATE_WHAT_HAPPENS_HEADING = "What happens to the video";

/**
 * Ordered so the least comfortable fact comes first. A reader who stops after one line
 * should have read the transmission, not the reassurance.
 */
export const CAMERA_GATE_WHAT_HAPPENS: readonly string[] = [
  "Video is transmitted. Your browser records short clips and uploads them to Serenify's " +
    "inference service, which runs on Microsoft Azure. The reading is produced there.",
  "The clip is then deleted. The service writes each upload to a temporary file, reads " +
    "it, and deletes that file before the request ends — on every outcome, including when " +
    "the read fails, when the model errors, and when the request is abandoned partway.",
  "Nothing is kept. There is no bucket, no table, and no file path where a clip lands. " +
    "No human being can view or replay it — not an administrator, and not the person who " +
    "built this. The storage and the retrieval path were never written.",
  "Only the reading is stored: a stress signal and the time it was taken. Serenify never " +
    "captures audio.",
];

export const CAMERA_GATE_SCOPE_HEADING = "What declining changes";

/**
 * FR-043c, stated as a pair. Naming only the cost would read as pressure; naming only the
 * exemption would understate it. Both, plainly, is the honest shape.
 */
export const CAMERA_GATE_SCOPE: readonly string[] = [
  "Calibration and monitoring sessions become unavailable. Serenify has no other way to " +
    "read a stress signal, so without this it does not read one.",
  "The weekly work-environment check-in keeps working. It is a text questionnaire about " +
    "your working conditions and it has never involved the camera.",
  "The companion conversation keeps working, exactly as it does now.",
  "Declining records nothing and deletes nothing. You are not asked again in this " +
    "session, and the choice is open whenever you want it — the account page carries the " +
    "way back.",
];

export const CAMERA_GATE_ACCEPT_LABEL = "Allow camera and inference";
export const CAMERA_GATE_DECLINE_LABEL = "Not now";

/**
 * Shown if the consent write itself fails. Calm and actionable: nothing was recorded, so
 * trying again is safe and costs nothing (the insert is ON CONFLICT DO NOTHING, so even a
 * partially-succeeded retry is a no-op rather than a duplicate).
 */
export const CAMERA_GATE_WRITE_ERROR =
  "That did not save. Nothing was recorded — please try again.";

/** Accessible name for the region, so the gate announces itself as the reason for the pause. */
export const CAMERA_GATE_REGION_LABEL = "Camera and inference consent";

// ── The route back (T052) ────────────────────────────────────────────────────
//
// `research.md` §6.4 pins the surface: the existing Account → Baseline section gains ONE
// line when the consent is absent. Not a banner, not a second gate — a line and a control.

export const BASELINE_CONSENT_ABSENT_LINE =
  "Setting a baseline needs the camera-and-inference permission, which is not on your " +
  "account yet. You can read what it covers and decide when you are ready.";

export const BASELINE_CONSENT_ABSENT_CTA = "Review camera permission";

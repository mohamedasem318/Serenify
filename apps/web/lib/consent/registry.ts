/**
 * Feature 013 — the consent version registry (T011).
 *
 * The published history of each consented text, as an in-repo constants module rather
 * than a database table (`research.md` §6.3). Publishing a revision is a pull request
 * and zero migrations: the wording edit and the entry appended here land in the SAME
 * PR (`research.md` §6.1), so a reviewer reads the text diff next to its classification
 * and the stated reason. That is what makes materiality a human judgment rather than a
 * computation — it is never derived from a text diff or a content hash (FR-043a).
 *
 * PURE. This module imports nothing from `server-only`, so Vitest loads it directly and
 * the exhaustive evaluator suite can cover every registry shape without a database
 * (`contracts/consent-evaluate.md`, "Purity").
 *
 * Ships with BOTH keys and ZERO entries. `terms_privacy`'s first revision lands in P3
 * with the documents it describes; `camera_inference`'s lands in P4 with the camera
 * wording. An empty entry list is not a bug here — the evaluator throws on one rather
 * than returning `undefined` (`evaluate.ts`), and nothing renders a gate until P4.
 *
 * `versionId` is the join key into the database: `user_consents.document_version` holds
 * exactly this string, and two CHECKs constrain its shape independently of this file
 * (`data-model.md` §6.5). The CI-enforced guards over these entries — explicit
 * materiality, non-empty rationale, unique well-formed self-prefixed ids, ascending
 * publication order, and append-only against a frozen snapshot — live in
 * `tests/unit/lib/consent/registry-guards.test.ts`.
 */

export type ConsentTextKey = "terms_privacy" | "camera_inference";
export type Materiality = "material" | "cosmetic";

export type ConsentRevision = {
  /** `<consent_key>@YYYY-MM-DD.<n>` — the value stored in user_consents.document_version. */
  readonly versionId: string;
  /** Publication date. EVIDENCE ONLY — never an input to the gate (see §6.2). */
  readonly publishedOn: string;
  /** Human judgment made at publish time. NEVER derived from a text comparison. */
  readonly materiality: Materiality;
  /** Why this classification was chosen. Required; the reviewer reads this. */
  readonly rationale: string;
};

export const CONSENT_REGISTRY: Readonly<Record<ConsentTextKey, readonly ConsentRevision[]>> = {
  // First entry: P3 (T023), with the Terms and Privacy Policy documents themselves.
  terms_privacy: [],
  // First entry: P4, with the camera-and-inference consent wording.
  camera_inference: [],
};

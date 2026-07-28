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
 * `terms_privacy` carries its first revision as of P3, appended in the same PR as the
 * Terms of Service and Privacy Policy wording it describes (`lib/legal/copy.ts`).
 * `camera_inference` carries its first revision as of P4, appended in the same PR as the
 * camera-and-inference wording it describes (`lib/consent/copy.ts`). Both keys are now
 * published, so `evaluate.ts`'s empty-list throw is no longer reachable for either.
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
  terms_privacy: [
    {
      versionId: "terms_privacy@2026-07-26.1",
      publishedOn: "2026-07-26",
      materiality: "material",
      rationale:
        "Initial publication of the Terms of Service and the Privacy Policy. The first " +
        "revision of a text is material by definition — there is no earlier wording anyone " +
        "could already hold, so every user must be asked. Published together with the " +
        "documents themselves in lib/legal/copy.ts (feature 013, P3).",
    },
  ],
  camera_inference: [
    {
      versionId: "camera_inference@2026-07-26.1",
      publishedOn: "2026-07-26",
      materiality: "material",
      rationale:
        "Initial publication of the camera-and-inference consent. The first revision of " +
        "a text is material by definition — there is no earlier wording anyone could " +
        "already hold, so every user must be asked before a calibration or a monitoring " +
        "session captures anything. Published together with the wording itself in " +
        "lib/consent/copy.ts (feature 013, P4).",
    },
  ],
};

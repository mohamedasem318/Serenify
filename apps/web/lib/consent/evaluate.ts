/**
 * Feature 013 — the consent evaluator (T013).
 *
 * The pure module boundary every consent gate depends on. Both gates call only these
 * three functions; neither reads the registry directly, and neither compares timestamps
 * (`contracts/consent-evaluate.md`).
 *
 * VERSION IDENTITY IS THE ONLY INPUT (research.md §6.2). Nothing here reads
 * `decided_at`, `Date.now()`, or any other clock. A timestamp rule would compare the
 * database clock against a hand-written `publishedOn` made live by a deploy — three
 * moments that are never the same instant — and the answer it gets wrong is *whether a
 * person is asked for consent*. It also survives the deploy race: a user holding the old
 * page when v2 ships submits after v2's publication date having read v1, and identity
 * records what they actually saw.
 *
 * These signatures take no registry parameter, deliberately. Test isolation comes from
 * module-mocking `./registry`, not from widening the public surface that both gates and
 * every write path depend on.
 */

import { CONSENT_REGISTRY, type ConsentRevision, type ConsentTextKey } from "./registry";

/**
 * The published entries for `key`, guaranteed non-empty.
 *
 * An empty entry list THROWS rather than returning `undefined`: the contract's return
 * type is non-optional, and a silent `undefined` would propagate into a gate as a
 * falsy "not satisfied" — indistinguishable from a real answer. A key with no published
 * revision is a build-time mistake (a gate shipped before its wording), so it fails
 * loudly. Both keys ship empty in P2 by design; nothing calls this until P4.
 */
function publishedRevisions(key: ConsentTextKey): readonly ConsentRevision[] {
  const entries = CONSENT_REGISTRY[key];
  if (entries.length === 0) {
    throw new Error(
      `No published revision for consent key "${key}". ` +
        `A revision must be appended to CONSENT_REGISTRY in the same PR as the wording it describes.`,
    );
  }
  return entries;
}

/** The revision currently shown to a user being prompted — the newest published one. */
export function currentRevision(key: ConsentTextKey): ConsentRevision {
  const entries = publishedRevisions(key);
  // Guarded by publishedRevisions(); the assertion satisfies noUncheckedIndexedAccess.
  return entries[entries.length - 1] as ConsentRevision;
}

/** The revision a user must hold at or after: the newest MATERIAL revision.
 *  Cosmetic revisions published after it do NOT move the requirement. */
export function bindingRevision(key: ConsentTextKey): ConsentRevision {
  const entries = publishedRevisions(key);
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry && entry.materiality === "material") return entry;
  }
  // Unreachable through a registry that passes the T014 guards: the first published
  // revision of each text is material by definition (research.md §6.2). Reached only if
  // that guard is bypassed, so it fails loudly rather than binding to nothing.
  throw new Error(
    `Consent key "${key}" has published revisions but no material one. ` +
      `The first revision of every text is material by definition.`,
  );
}

/** The gate. True iff the held version's registry index >= the binding revision's index. */
export function satisfiesConsent(key: ConsentTextKey, heldVersionIds: readonly string[]): boolean {
  const entries = publishedRevisions(key);
  const binding = bindingRevision(key);
  const bindingIndex = entries.findIndex((entry) => entry.versionId === binding.versionId);

  return heldVersionIds.some((heldId) => {
    const heldIndex = entries.findIndex((entry) => entry.versionId === heldId);
    // A well-formed but non-registry id is inert: findIndex returns -1, which is never
    // >= a valid binding index (R7/R8). Membership is checked, never assumed.
    return heldIndex >= 0 && heldIndex >= bindingIndex;
  });
}

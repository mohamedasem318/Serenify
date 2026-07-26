import { satisfiesConsent } from "./evaluate";
import type { ConsentTextKey } from "./registry";

/**
 * Feature 013 — the owner-scoped consent read (T046).
 *
 * The one server-side read both gates share. It selects `document_version` from
 * `public.user_consents` under the CALLER'S OWN session, so `user_consents_select_self`
 * scopes it to their rows and nothing here has to filter by user id. There is no
 * service-role path and no cross-user read: the policy is the scoping.
 *
 * THE FAIL DIRECTION IS NOT DECIDED HERE, DELIBERATELY. The camera gate fails CLOSED
 * (§7.2) and P5's app-shell gate fails OPEN (§7.3) on this very same read. Baking a
 * direction into the read would force one of those two call sites to un-bake it, which
 * is how a safety default quietly becomes whatever the last edit wanted. So the read
 * returns a DISCRIMINATED result and each call site composes its own decision.
 *
 * The discriminated shape also exists to stop one specific mistake. A bare
 * `string[]` return makes "this user has consented to nothing" and "the SELECT failed"
 * both look like `[]`, and a call site that treats `[]` as "not consented" is then
 * correct by accident for the camera gate and catastrophically wrong for the shell gate.
 * Separating them means a caller has to say which one it means.
 *
 * "NO ROWS" IS A REAL, EXPECTED ANSWER — not an error. Every pre-existing user has zero
 * consent records, because the migration backfills nothing, ever (§7.4, FR-041), and so
 * does anyone created during the P8 deploy window. It means *not consented*, not *broken*.
 */

/**
 * The minimal shape of the Supabase client this read needs — injected, never created.
 *
 * `data` is `unknown` on purpose, and not `{ document_version: string }[] | null`. Two
 * reasons, one practical and one principled. Practically, a precise row type here makes
 * the assignability check against Supabase's deeply-generic query builder blow the
 * compiler's instantiation limit (TS2589) at the call sites. Principled: this module
 * treats the response as untrusted and validates its shape below, which is what lets it
 * distinguish "no rows" from "something unreadable came back" honestly rather than by
 * assertion.
 */
type ConsentQueryResponse = { data: unknown; error: unknown };

/**
 * The contract is only `from`, and its return is `unknown`. Spelling the whole
 * `.select().eq()` chain out here made the assignability check against Supabase's
 * deeply-generic `PostgrestQueryBuilder` exceed the compiler's instantiation limit
 * (TS2589) in `app/(authed)/app/calibrate/page.tsx`, which already does enough generic
 * Supabase work in one file to sit near it. Narrowing the contract to `from` and
 * asserting the chain shape at ONE controlled point below keeps the check trivial, keeps
 * a hand-written fake trivial to construct in a test, and costs nothing in safety — the
 * response is validated at runtime either way, which is the actual guarantee.
 */
type ConsentQueryClient = {
  from: (table: string) => unknown;
};

type ConsentEqChain = {
  eq: (column: string, value: string) => ConsentEqChain & PromiseLike<ConsentQueryResponse>;
};

type ConsentSelectChain = {
  select: (columns: string) => ConsentEqChain;
};

export type ConsentReadResult =
  /** The read succeeded. `heldVersionIds` may legitimately be empty. */
  | { readonly status: "ok"; readonly heldVersionIds: readonly string[] }
  /** The read failed, or returned something that cannot be interpreted as rows. */
  | { readonly status: "unreadable"; readonly error: unknown };

/**
 * Every `document_version` this caller holds for one consent key.
 *
 * Takes the client as a parameter rather than creating one, so it is testable without a
 * database and without mocking `next/headers`.
 */
export async function readHeldConsentVersions(
  client: ConsentQueryClient,
  key: ConsentTextKey,
): Promise<ConsentReadResult> {
  try {
    // The `decision = 'granted'` filter is a NO-OP today — the column's CHECK admits
    // nothing else — and that is exactly why it is written now rather than later.
    // Feature 018 widens that CHECK to model withdrawal by inserting a NEW row, and at
    // that moment a query without this filter would silently count a withdrawn row as a
    // held consent. The filter costs nothing and closes that door before it opens.
    const { data, error } = await (client.from("user_consents") as ConsentSelectChain)
      .select("document_version")
      .eq("consent_key", key)
      .eq("decision", "granted");

    if (error) {
      return { status: "unreadable", error };
    }
    // A null `data` with no error is not a shape this client is documented to return,
    // which is exactly why it is treated as unreadable rather than as an empty list.
    // Guessing here would mean guessing about consent.
    if (!Array.isArray(data)) {
      return { status: "unreadable", error: new Error("consent read returned no rows array") };
    }

    // Each row is validated rather than asserted. A row whose document_version is not a
    // string is dropped, not coerced — a malformed value must never become a held
    // version id, because `satisfiesConsent` checks membership and a garbage entry that
    // happened to match would satisfy a gate it has no business satisfying (R7/R8).
    return {
      status: "ok",
      heldVersionIds: data
        .map((row) =>
          row && typeof row === "object" && "document_version" in row
            ? (row as { document_version: unknown }).document_version
            : undefined,
        )
        .filter((version): version is string => typeof version === "string"),
    };
  } catch (error) {
    // A thrown client (network, aborted request, a mock that rejects) is unreadable too.
    // Without this the exception would propagate into a Server Component render and the
    // route would fail open by crashing — which is not a decision anyone made.
    return { status: "unreadable", error };
  }
}

/** What a capture route does with the result. `blocked` means: show the consent gate. */
export type CameraGateDecision = "allowed" | "blocked";

/**
 * The camera gate's composition — FAILS CLOSED (§7.2).
 *
 * An unreadable result yields `blocked`, exactly as an empty one does. The cost of
 * being wrong in this direction is that a consenting user answers once more, and
 * `UNIQUE (user_id, consent_key, document_version)` plus `ON CONFLICT DO NOTHING` makes
 * that a no-op rather than a duplicate row. The cost of being wrong in the other
 * direction is a webcam capture uploaded and inferred with no recorded consent because
 * a SELECT blipped — which is the precise harm this gate exists to prevent.
 *
 * Lives here, in one place, rather than being written out at each of the three capture
 * routes: three copies of a safety default is three chances for one of them to drift.
 * P5's shell gate composes the OPPOSITE direction against the same read, at its own call
 * site, and T054 / T071 pin both so neither can move.
 */
export function decideCameraGate(result: ConsentReadResult): CameraGateDecision {
  if (result.status !== "ok") {
    return "blocked";
  }
  return satisfiesConsent("camera_inference", result.heldVersionIds) ? "allowed" : "blocked";
}

/** Convenience for the three capture routes: read, then decide, failing closed. */
export async function readCameraGateDecision(
  client: ConsentQueryClient,
): Promise<CameraGateDecision> {
  return decideCameraGate(await readHeldConsentVersions(client, "camera_inference"));
}

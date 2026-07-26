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

/** The minimal shape of the Supabase client this read needs — injected, never created. */
type ConsentQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{
        data: { document_version: string }[] | null;
        error: unknown;
      }>;
    };
  };
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
    const { data, error } = await client
      .from("user_consents")
      .select("document_version")
      .eq("consent_key", key);

    if (error) {
      return { status: "unreadable", error };
    }
    // A null `data` with no error is not a shape this client is documented to return,
    // which is exactly why it is treated as unreadable rather than as an empty list.
    // Guessing here would mean guessing about consent.
    if (!Array.isArray(data)) {
      return { status: "unreadable", error: new Error("consent read returned no rows array") };
    }

    return {
      status: "ok",
      heldVersionIds: data
        .map((row) => row?.document_version)
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

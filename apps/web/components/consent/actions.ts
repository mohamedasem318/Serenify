"use server";

import { currentRevision } from "@/lib/consent/evaluate";
import type { ConsentTextKey } from "@/lib/consent/registry";
import { createClient } from "@/lib/supabase/server";

/**
 * Feature 013 — the consent-write server action (T047).
 *
 * Colocated with the gate that calls it rather than living in `app/(authed)/actions.ts`,
 * because the camera gate renders at `/onboarding` — which is OUTSIDE the `(authed)`
 * group — as well as inside it. One action, both places.
 *
 * THERE IS NO DECLINE PATH. Not a `decision` parameter, not a `declined` branch, not a
 * withdrawal function. Declining calls nothing at all: it writes no row, deletes no row,
 * and records no withdrawal state (FR-042, FR-043e, §7.5). The database agrees
 * independently — `decision` admits only `'granted'`, and admitting `'declined'` would
 * invite writing one. Feature 018 owns withdrawal; this feature does not model it.
 *
 * That is also why declining is safely repeatable and why the gate reappears: the
 * ABSENCE of a satisfying record IS the state (§6.4). Nothing has to be stored to
 * remember a decline, so nothing is.
 *
 * ── The two values a caller cannot supply ────────────────────────────────────
 *
 * This action takes exactly ONE argument: which consent key is being granted. Both of
 * the values that decide what the row MEANS are resolved here, on the server.
 *
 * `user_id` — resolved via `supabase.auth.getUser()`, never accepted as a parameter.
 * There is no `user_id` argument in the signature at all, optional or otherwise: a
 * caller that can name the subject of a consent record reduces defence-in-depth to RLS
 * alone, and defence-in-depth is the whole point of having two. `getUser()` and NOT
 * `getSession()` — getSession returns the cookie's contents without revalidating them
 * against the auth server, which in a function that writes a consent record is the
 * difference between a record and a forgery.
 *
 * The column is `NOT NULL` with no default (`20260726000000_user_consents.sql:25`), so
 * the value must be passed explicitly. This mirrors what the shipped `handle_new_user()`
 * trigger already does at `:109-110`, which passes `NEW.id` rather than relying on a
 * default that does not exist. RLS `WITH CHECK ((select auth.uid()) = user_id)` remains
 * the ENFORCEMENT — it rejects any row whose subject is not the caller — but it is not
 * the source of the value.
 *
 * `document_version` — resolved from the in-repo registry via `currentRevision(key)`,
 * never accepted from the caller. A caller-supplied version is exactly the forgeable-
 * version problem `plan.md` §15 R8 already documents on the signup path, where it is
 * unavoidable because the signup request is unauthenticated. Here it is entirely
 * avoidable, so it is avoided: this path opens no second instance of R8.
 *
 * FAILS CLOSED on an absent or unreadable user. No user means no row — it does not
 * proceed, and it does not silently succeed. The caller renders the failure.
 */

export type ConsentWriteResult = { status: "ok" } | { status: "error" };

/**
 * Record that the CALLER accepted the CURRENT published revision of `key`.
 *
 * Called only on the accept path. There is no counterpart for declining, by design.
 */
export async function grantConsent(key: ConsentTextKey): Promise<ConsentWriteResult> {
  const supabase = await createClient();

  // getUser(), not getSession(): this revalidates the token against the auth server
  // rather than trusting the cookie it was parsed from.
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data?.user;
  if (userError || !user) {
    console.error("[consent] no authenticated user; wrote nothing:", userError);
    return { status: "error" };
  }

  const { versionId } = currentRevision(key);

  // ON CONFLICT DO NOTHING against user_consents_one_per_revision: re-accepting the same
  // revision is a NO-OP, not an error. That is precisely what makes the camera gate's
  // fail-CLOSED direction cheap — a user shown the gate again because a SELECT blipped
  // can accept again with no duplicate row and no failure.
  const { error } = await supabase.from("user_consents").upsert(
    [{ user_id: user.id, consent_key: key, document_version: versionId }],
    { onConflict: "user_id,consent_key,document_version", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[consent] write failed:", error);
    return { status: "error" };
  }
  return { status: "ok" };
}

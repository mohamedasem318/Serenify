import { redirect } from "next/navigation";

import { ChatPill } from "@/components/chat-pill";
import { TermsReconsentScreen } from "@/components/consent/terms-reconsent-screen";
import { Header } from "@/components/header/header";
import { currentRevision, satisfiesConsent } from "@/lib/consent/evaluate";
import { readHeldConsentVersions } from "@/lib/consent/read";
import { serverEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

type Role = "employee" | "team_lead" | "admin";

/**
 * Feature 013 — the app-shell Terms/Privacy entry gate (T066/T067, §7.3).
 *
 * THE HIGHEST-BLAST-RADIUS CHANGE IN THE FEATURE. This is the single shell every
 * authenticated route renders through, so a bug here does not degrade a feature — it
 * locks out every user of the product. Two things make that survivable, and neither is
 * care:
 *
 *   1. IT RENDERS A DIFFERENT TREE. It never redirects. A gate implemented as
 *      `redirect("/consent")` bounces forever if the destination sits inside the gated
 *      group or if the proxy and the layout disagree, and `proxy.ts` is not touched at
 *      all. Rendering in place cannot loop — that is the entire point (§7.3 failure
 *      mode 1). The `redirect("/login")` below is the pre-existing unauthenticated path
 *      and is deliberately unchanged.
 *   2. IT FAILS OPEN, LOUDLY. Any failure yields the normal shell, and every such path
 *      emits the `[consent-gate] FAIL-OPEN` line. Deliberately the OPPOSITE of the camera
 *      gate, which fails CLOSED (`lib/consent/read.ts`, T054): failing open on Terms
 *      costs a user briefly reaching the app before acknowledging, and they meet the gate
 *      on their next navigation. Failing open on camera consent costs a video captured
 *      and inferred with no recorded consent. Those are not comparable, so they get
 *      opposite defaults, and both are pinned by tests so neither can drift.
 *
 * `/terms` and `/privacy` are untouched by construction: they live in the `(public)`
 * route group, so this layout cannot run for them at all (FR-043d).
 */

/** Which fail-open path fired. Present in the log payload; see `failOpen` below. */
type FailOpenReason = "consent-read-unreadable" | "gate-threw";

/**
 * Fail OPEN — and say so (T067, §7.3). Never called on the happy path.
 *
 * THIS LOG LINE IS NOT OPTIONAL. A *transient* read failure is what fail-open is for. A
 * *persistent* one — an RLS policy wrong after a migration, a dropped grant, a renamed
 * column — silently disables the Terms gate for every user, with nothing on any surface
 * to say so: the app looks perfectly healthy while a legal gate is off. `console.error`
 * matches the repo's existing server convention (`[signUp] supabase error:` at
 * `app/(auth)/signup/actions.ts:55`) and surfaces in Vercel's function logs. The line is
 * deliberately loud and greppable: one occurrence is noise, a steady stream is an outage.
 *
 * `reason` is in the payload alongside `error`, not instead of it. `error` is always
 * present — `readHeldConsentVersions` synthesises one even for the null-data case
 * (`lib/consent/read.ts:97-99`) — but `Error`'s `message` and `stack` are non-enumerable,
 * so `JSON.stringify(new Error("x"))` is `"{}"`. In a structured log pipeline the
 * synthesised-Error mode is therefore the one most likely to arrive as an empty object,
 * and that is precisely the mode a persistent RLS defect produces. A plain string always
 * survives serialisation, so the mode is legible even when the error is not.
 */
function failOpen(userId: string, reason: FailOpenReason, error: unknown): void {
  console.error("[consent-gate] FAIL-OPEN: terms_privacy gate disabled for this request", {
    userId,
    reason,
    error,
  });
}

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; role: Role }>();

  const fullName = profile?.full_name ?? null;
  const role: Role = profile?.role ?? "employee";
  const email = user.email ?? "";

  // ── The entry gate ────────────────────────────────────────────────────────
  //
  // THE KILL SWITCH IS CHECKED BEFORE THE READ, NOT AFTER. If the gate is deliberately
  // disabled and the read still ran and failed, `[consent-gate] FAIL-OPEN` would fire for
  // a gate nobody is running — and that line's whole value is that a steady stream of it
  // means a real outage. A disabled gate has to be silent, or the signal is worthless.
  //
  // ONE VARIABLE, NOT A BOOLEAN PLUS AN ID. `reconsentVersionId` is non-null if and only
  // if the user is blocked, and it holds the exact revision the screen will show. A
  // separate `blocked` flag could disagree with the id beside it; this cannot. It also
  // means a throw ANYWHERE below leaves it null — and null is the fail-open answer — so
  // both evaluator calls sit inside the try rather than one of them depending on a
  // non-local invariant to be unable to throw.
  let reconsentVersionId: string | null = null;
  if (serverEnv.consentEntryGateEnabled) {
    try {
      const consent = await readHeldConsentVersions(supabase, "terms_privacy");
      if (consent.status === "ok") {
        if (!satisfiesConsent("terms_privacy", consent.heldVersionIds)) {
          reconsentVersionId = currentRevision("terms_privacy").versionId;
        }
      } else {
        // `unreadable` is the one shape the read returns for all three failure modes: a
        // Postgrest error, a null `data` with no error, and a client that threw. Note
        // that "no rows" is NOT one of them — it is a real, expected answer meaning *not
        // consented*, and it correctly blocks (§7.4).
        failOpen(user.id, "consent-read-unreadable", consent.error);
      }
    } catch (error) {
      // The evaluator throws on a key with no published revision, and a throw inside a
      // Server Component render takes down every authed route — the exact lockout this
      // gate is built to be incapable of. Caught here so a registry mistake fails OPEN
      // and visibly, rather than crashing the shell.
      failOpen(user.id, "gate-threw", error);
    }
  }

  if (reconsentVersionId) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <TermsReconsentScreen versionId={reconsentVersionId} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Header fullName={fullName} email={email} role={role} />
      <main className="flex-1 px-4 pt-6 sm:px-6 sm:pt-8">{children}</main>
      {role === "employee" && <ChatPill />}
    </div>
  );
}

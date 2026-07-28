import { NextResponse } from "next/server";

/**
 * ⚠ TEMPORARY — DELETE BEFORE MERGING PR #188. ⚠
 *
 * The positive control for P8 Stage 3 §8, which has never actually been run.
 *
 * Stage 3 concluded that Vercel's log channel was "dead, not quiet" from a deliberate failed
 * sign-in. That control was invalid: `app/(auth)/login/actions.ts` returns at the
 * invalid-credentials branch (line 33) BEFORE the `console.error` at line 39, so a failed
 * sign-in emits nothing and its absence proved nothing. The later dashboard check hit the
 * same wall from the other side, on a request that succeeded. Every `console.error` in the
 * app sits on a fallback branch that needs a genuine backend fault to reach — which is why
 * no amount of ordinary use answers the question.
 *
 * This route is the smallest thing that does: a request that ALWAYS emits, at two console
 * levels, with a payload shaped like the real one.
 *
 * WHY THE OBJECT PAYLOAD IS NOT DECORATION. The line this is a proxy for —
 * `[consent-gate] FAIL-OPEN` at `app/(authed)/layout.tsx:62` — logs a `{ userId, reason,
 * error }` object, and its own docstring worries that `Error`'s `message` and `stack` are
 * non-enumerable, so a synthesised error can arrive as `{}` in a structured pipeline. So the
 * probe carries both a nested object and a real `Error`: if the object survives but the
 * Error serialises to `{}`, that is worth knowing BEFORE it matters.
 *
 * A5 ("a sustained stream of FAIL-OPEN") is a separate problem this does not solve — see
 * BACKLOG. This answers only "is server console output readable here at all".
 *
 * Guarded against production as belt-and-braces. It is going to be deleted, but a temporary
 * debug route that 404s in production if someone forgets is strictly better than one that
 * does not.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const stamp = new Date().toISOString();

  console.warn(`[log-probe] WARN level reached, stamp=${stamp}`);
  console.error(`[log-probe] ERROR level reached, stamp=${stamp}`, {
    reason: "deliberate-probe",
    nested: { objectPayloadSurvives: true },
    syntheticError: new Error("probe: does an Error serialise, or arrive as {}?"),
  });

  return NextResponse.json({ ok: true, stamp, emitted: ["warn", "error"] });
}

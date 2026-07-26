import { describe, expect, it } from "vitest";

import {
  decideCameraGate,
  readCameraGateDecision,
  readHeldConsentVersions,
  type ConsentReadResult,
} from "@/lib/consent/read";
import { currentRevision } from "@/lib/consent/evaluate";

/**
 * T054 — the camera gate FAILS CLOSED.
 *
 * WHY THIS DIRECTION, stated here because a default nobody can explain is a default
 * somebody will eventually flip: the cost of being wrong toward "blocked" is that a
 * consenting user answers once more, and `UNIQUE (user_id, consent_key,
 * document_version)` plus `ON CONFLICT DO NOTHING` makes that a no-op rather than a
 * duplicate row. The cost of being wrong toward "allowed" is a webcam capture uploaded
 * and inferred with NO RECORDED CONSENT because a SELECT blipped. That is the exact harm
 * this gate exists to prevent (§7.2).
 *
 * THE ASYMMETRY WITH P5 IS DELIBERATE. P5's app-shell Terms gate fails OPEN on this very
 * same read (§7.3), and T071 asserts that inverse. Failing open on Terms costs a user
 * briefly reaching the app before acknowledging; failing open on camera consent costs a
 * video captured and inferred without it. Those are not comparable, so they get opposite
 * defaults — and BOTH are pinned by tests so neither can drift into the other.
 *
 * The three failure shapes below are not hypothetical variations. A rejected client is
 * a network fault, a `{ error }` response is an RLS or grant problem, and a `null` data
 * with no error is what a misconfigured PostgREST returns — each has been a real
 * production failure mode somewhere, and each must produce the same answer.
 */

const CURRENT = currentRevision("camera_inference").versionId;

/**
 * A PostgREST-shaped fake: `.eq()` is chainable AND thenable, exactly as Supabase's
 * builder is. Modelling it as returning a bare Promise would make these fakes pass while
 * the real client did something else — the read chains two `.eq()` calls (consent_key
 * and decision), and a non-chainable fake would have hidden that.
 */
function chain(settle: () => Promise<{ data: unknown; error: unknown }>) {
  const link = {
    eq: () => link,
    then: (
      onFulfilled?: ((value: { data: unknown; error: unknown }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => settle().then(onFulfilled, onRejected),
  };
  return link;
}

/** A client whose query resolves to whatever response shape a test needs. */
function clientResolving(response: { data: unknown; error: unknown }) {
  return { from: () => ({ select: () => chain(async () => response) }) };
}

/** A client whose query rejects outright. */
function clientRejecting(reason: unknown) {
  return {
    from: () => ({
      select: () =>
        chain(() => Promise.reject(reason) as Promise<{ data: unknown; error: unknown }>),
    }),
  };
}

describe("the read distinguishes 'no rows' from 'unreadable' (T046)", () => {
  it("an empty result is OK with no held versions — NOT an error", async () => {
    // Every pre-existing user is in exactly this state, because the migration backfills
    // nothing, ever (§7.4, FR-041). Treating it as an error would make the log unusable.
    const result = await readHeldConsentVersions(
      clientResolving({ data: [], error: null }),
      "camera_inference",
    );
    expect(result).toEqual({ status: "ok", heldVersionIds: [] });
  });

  it("filters to granted decisions, so a future withdrawal row cannot satisfy a gate", async () => {
    // The filter is a no-op against today's CHECK, which admits only 'granted'. It is
    // asserted anyway: feature 018 widens that CHECK, and this is the assertion that
    // will fail if someone removes the filter while making that change.
    const eqCalls: [string, string][] = [];
    const link = {
      eq: (column: string, value: string) => {
        eqCalls.push([column, value]);
        return link;
      },
      then: (onFulfilled?: ((v: { data: unknown; error: unknown }) => unknown) | null) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled),
    };

    await readHeldConsentVersions({ from: () => ({ select: () => link }) }, "camera_inference");

    expect(eqCalls).toContainEqual(["consent_key", "camera_inference"]);
    expect(eqCalls).toContainEqual(["decision", "granted"]);
  });

  it("an error response is unreadable, and carries the underlying error", async () => {
    const error = { code: "42501", message: "permission denied" };
    const result = await readHeldConsentVersions(
      clientResolving({ data: null, error }),
      "camera_inference",
    );
    expect(result.status).toBe("unreadable");
    expect(result.status === "unreadable" && result.error).toBe(error);
  });

  it("a null data with NO error is unreadable, not an empty list", async () => {
    // The subtle one. Guessing "no rows" here would silently convert a broken read into
    // a confident "this user has not consented" — right for this gate by accident, and
    // wrong for P5's, which uses the same function.
    const result = await readHeldConsentVersions(
      clientResolving({ data: null, error: null }),
      "camera_inference",
    );
    expect(result.status).toBe("unreadable");
  });

  it("a thrown client is unreadable rather than an unhandled render crash", async () => {
    const result = await readHeldConsentVersions(
      clientRejecting(new Error("socket hang up")),
      "camera_inference",
    );
    expect(result.status).toBe("unreadable");
  });

  it("drops a row whose document_version is not a string, never coerces it", async () => {
    const result = await readHeldConsentVersions(
      clientResolving({ data: [{ document_version: null }, { document_version: 7 }], error: null }),
      "camera_inference",
    );
    expect(result).toEqual({ status: "ok", heldVersionIds: [] });
  });
});

describe("decideCameraGate — every non-OK read is BLOCKED (§7.2)", () => {
  const failures: readonly [string, ConsentReadResult][] = [
    ["a read that errored", { status: "unreadable", error: new Error("boom") }],
    ["a read that returned null", { status: "unreadable", error: null }],
    ["a read that was otherwise unreadable", { status: "unreadable", error: undefined }],
  ];

  it.each(failures)("%s produces gate SHOWN", (_label, result) => {
    expect(decideCameraGate(result)).toBe("blocked");
  });

  it("a successful read with no rows produces gate SHOWN", () => {
    expect(decideCameraGate({ status: "ok", heldVersionIds: [] })).toBe("blocked");
  });

  it("a successful read holding an unrelated version produces gate SHOWN", () => {
    // A well-formed but non-registry id is inert (R7/R8) — membership is checked, never
    // assumed, so a forged-looking value cannot open the gate.
    expect(
      decideCameraGate({
        status: "ok",
        heldVersionIds: ["camera_inference@2099-01-01.9"],
      }),
    ).toBe("blocked");
  });

  it("ONLY an explicit satisfying row produces gate HIDDEN", () => {
    expect(decideCameraGate({ status: "ok", heldVersionIds: [CURRENT] })).toBe("allowed");
  });

  it("the opposite default is not used for this key, under any failure shape", () => {
    // Stated as its own assertion so a future edit that flips the direction fails with a
    // message about the direction, not about an unrelated expectation.
    for (const [, result] of failures) {
      expect(decideCameraGate(result), "the camera gate must never fail OPEN").not.toBe(
        "allowed",
      );
    }
  });
});

describe("readCameraGateDecision — the composition the three routes call", () => {
  it("blocks on an unreadable client", async () => {
    expect(await readCameraGateDecision(clientRejecting(new Error("down")))).toBe("blocked");
  });

  it("blocks on an empty consent history", async () => {
    expect(await readCameraGateDecision(clientResolving({ data: [], error: null }))).toBe(
      "blocked",
    );
  });

  it("allows only when the binding revision is actually held", async () => {
    expect(
      await readCameraGateDecision(
        clientResolving({ data: [{ document_version: CURRENT }], error: null }),
      ),
    ).toBe("allowed");
  });
});

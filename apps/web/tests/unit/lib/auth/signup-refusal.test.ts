import { describe, expect, it } from "vitest";

import {
  refusalFromParam,
  refusalRedirectPath,
  SIGNUP_CHECK_FIELDS_MESSAGE,
  SIGNUP_GENERIC_ERROR_MESSAGE,
} from "@/lib/auth/signup-refusal";
import { TERMS_ACK_REQUIRED_MESSAGE } from "@/lib/consent/copy";

/**
 * #184 — the no-JS refusal marker. The contract under test: every refused
 * SignUpResult maps to a fixed enum marker (never field values, the email, or
 * message text), and the marker maps back to the same result shape the JS path
 * would have rendered. ST-9's silent-failure regression is the round trip failing
 * at either end.
 */

describe("refusalRedirectPath — every refusal becomes a fixed, non-identifying marker", () => {
  it.each([
    [
      { status: "validation", field: "accept_terms", message: TERMS_ACK_REQUIRED_MESSAGE } as const,
      "terms",
    ],
    [{ status: "validation", field: "email", message: "Invalid email" } as const, "fields"],
    [{ status: "validation", field: "password", message: "too short" } as const, "fields"],
    [{ status: "validation", field: "full_name", message: "name" } as const, "fields"],
    [{ status: "stale_terms" } as const, "stale_terms"],
    [{ status: "exists" } as const, "exists"],
    [{ status: "error", message: SIGNUP_GENERIC_ERROR_MESSAGE } as const, "error"],
  ])("maps %o → reason=%s", (result, reason) => {
    expect(refusalRedirectPath(result)).toBe(`/signup?state=refused&reason=${reason}`);
  });

  it("never leaks message text or field values into the URL", () => {
    const path = refusalRedirectPath({
      status: "validation",
      field: "email",
      message: "the address alex@example.com is not valid",
    });
    // The whole path is a fixed template — nothing from the result's message or the
    // submission survives into it. Credentials-in-URL is what the old void return
    // was protecting; the marker keeps that property.
    expect(path).toBe("/signup?state=refused&reason=fields");
    expect(path).not.toContain("@");
    expect(path).not.toContain("alex");
  });
});

describe("refusalFromParam — the marker rebuilds the result the JS path would have shown", () => {
  it("terms → the accept_terms validation with the exact required-acknowledgement copy", () => {
    expect(refusalFromParam("terms")).toEqual({
      status: "validation",
      field: "accept_terms",
      message: TERMS_ACK_REQUIRED_MESSAGE,
    });
  });

  it("stale_terms / exists rebuild their bare statuses", () => {
    expect(refusalFromParam("stale_terms")).toEqual({ status: "stale_terms" });
    expect(refusalFromParam("exists")).toEqual({ status: "exists" });
  });

  it("fields / error rebuild the fixed generic messages signUp() itself returns", () => {
    expect(refusalFromParam("fields")).toEqual({
      status: "validation",
      field: "",
      message: SIGNUP_CHECK_FIELDS_MESSAGE,
    });
    expect(refusalFromParam("error")).toEqual({
      status: "error",
      message: SIGNUP_GENERIC_ERROR_MESSAGE,
    });
  });

  it("ignores anything outside the enum — the URL is input, not content", () => {
    for (const junk of [null, undefined, "", "ok", "check_email", "<script>", "TERMS", "terms "]) {
      expect(refusalFromParam(junk)).toBeNull();
    }
  });

  it("round-trips every refusal the action can produce", () => {
    const refusals = [
      { status: "validation", field: "accept_terms", message: TERMS_ACK_REQUIRED_MESSAGE },
      { status: "stale_terms" },
      { status: "exists" },
      { status: "error", message: SIGNUP_GENERIC_ERROR_MESSAGE },
    ] as const;
    for (const refusal of refusals) {
      const reason = new URL(refusalRedirectPath(refusal), "http://x").searchParams.get("reason");
      expect(refusalFromParam(reason)).toEqual(refusal);
    }
  });
});

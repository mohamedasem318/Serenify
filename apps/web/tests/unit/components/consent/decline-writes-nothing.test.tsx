import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { CAMERA_GATE_DECLINE_LABEL } from "@/lib/consent/copy";

/**
 * T055 — declining writes NOTHING. The server half of research.md §12.2; T017 already
 * asserts the database half statically.
 *
 * The assertion is deliberately "the writer was never CALLED", not "no row appeared".
 * The stronger claim is the one that holds with no database present at all, and it is
 * also the one that survives someone later pointing the action at a different table.
 *
 * FR-042 / FR-043e / §7.5: declining writes no row, deletes no row, and records no
 * withdrawal state. There is nothing to write, because there is no decline path to write
 * it — which the static half of this file proves by reading the action's source.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the decline path performs zero writes", () => {
  it("declining never invokes the write action", () => {
    const writer = vi.fn();
    render(<CameraConsentGate onGrant={writer} />);

    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL }));

    expect(writer).toHaveBeenCalledTimes(0);
  });

  it("declining navigates away from the capture route", () => {
    render(<CameraConsentGate onGrant={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL }));
    expect(push).toHaveBeenCalledWith("/app");
  });

  it("abandoning — unmounting without answering — invokes nothing at all", () => {
    // Zero is trivially provable here, which is the point: there is no timer, no
    // beforeunload, and no "record that they saw it" side effect anywhere in the gate.
    const writer = vi.fn();
    const { unmount } = render(<CameraConsentGate onGrant={writer} />);
    unmount();
    expect(writer).toHaveBeenCalledTimes(0);
  });

  it("declining, then arriving again, still writes nothing", () => {
    // The absence of a record IS the state (§6.4). Nothing accumulates across declines.
    const writer = vi.fn();
    const first = render(<CameraConsentGate onGrant={writer} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL }));
    first.unmount();

    render(<CameraConsentGate onGrant={writer} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL }));

    expect(writer).toHaveBeenCalledTimes(0);
  });
});

/**
 * COMMENTS ARE STRIPPED BEFORE THESE SCANS, unlike the FR-051 web-storage guard which
 * deliberately scans prose too. The difference is the subject. `localStorage` is an API
 * name that should never appear in this feature in any form, so catching it in a comment
 * is a feature. "withdrawal" is a CONCEPT these modules must discuss at length in order
 * to explain why they do not implement it — a prose scan would force the code to stop
 * documenting its own most important absence, which is precisely backwards.
 *
 * The stripper is deliberately crude and only has to be right about `//` and block
 * comments in these two hand-written files.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("no withdrawal path exists to be called (FR-042, FR-043e, §7.5)", () => {
  const action = codeOnly(
    readFileSync(resolve(process.cwd(), "components/consent/actions.ts"), "utf8"),
  );
  const gate = codeOnly(
    readFileSync(resolve(process.cwd(), "components/consent/camera-consent-gate.tsx"), "utf8"),
  );

  it("the action's executable code names no decision other than the column default", () => {
    // `decision` is never written at all — the column defaults to 'granted' and its CHECK
    // admits nothing else. So no decision VALUE should appear in code here, including
    // 'granted' itself: writing it explicitly would be the first step toward writing
    // something else.
    expect(action).not.toMatch(/["']declined["']|["']withdrawn["']|["']revoked["']/i);
    expect(action).not.toMatch(/\bdecision\s*:/);
  });

  it("the action's executable code contains no DELETE and no UPDATE", () => {
    // A withdrawal implemented as a deletion would be just as much a violation as one
    // implemented as a column — and it would leave no trace to audit.
    expect(action).not.toMatch(/\.delete\s*\(/);
    expect(action).not.toMatch(/\.update\s*\(/);
  });

  it("the action exports exactly one function, and it grants", () => {
    const exported = action.match(/export\s+async\s+function\s+(\w+)/g) ?? [];
    expect(exported).toEqual(["export async function grantConsent"]);
  });

  it("the gate reaches a writer from exactly one place — the accept control", () => {
    expect(gate.match(/onGrant\(/g) ?? []).toHaveLength(1);
  });

  it("the gate's decline handler body contains no call at all beyond navigation", () => {
    const declineBody = gate.match(/function decline\(\)\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
    expect(declineBody, "decline() must exist to be checked").not.toBe("");
    expect(declineBody).toContain("router.push");
    expect(declineBody).not.toMatch(/onGrant|grantConsent|fetch|supabase/);
  });
});

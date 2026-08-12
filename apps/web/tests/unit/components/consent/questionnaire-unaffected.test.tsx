import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import {
  WeeklyCheckInCard,
  type WeeklyCheckInCardProps,
} from "@/components/questionnaire/weekly-check-in-card";
import { decideCameraGate } from "@/lib/consent/read";

/**
 * T057 — SC-013, the component half. T016 is the static half (an import-graph proof that
 * no questionnaire module reaches into `lib/consent/`); this is the behavioural one.
 *
 * DECLINING BLOCKS THAT SCOPE AND ONLY THAT SCOPE (FR-043c, ST-12). Calibration, baseline
 * capture and monitoring sessions become unavailable; the weekly work-environment
 * survey — the text questionnaire about working conditions — keeps working exactly as
 * it did, because it has never involved the camera.
 *
 * The user modelled here is the one the camera gate blocks: ZERO consent records, which
 * `decideCameraGate` turns into "blocked". The same user drives the card below and every
 * path through it completes.
 *
 * TERMINOLOGY (plan.md §11, amended 2026-08-12 — #198): the concept is the **weekly
 * work-environment survey**, and it is never called a check-in — that word names the
 * camera-based monitoring session and nothing else. The existing component file is named
 * `weekly-check-in-card.tsx` and the existing table is `weekly_checkin_cadence`; both are
 * quoted here as-is, as filenames and identifiers, and neither is used as prose.
 */

type SubmitFn = NonNullable<WeeklyCheckInCardProps["submit"]>;
type CadenceFn = NonNullable<WeeklyCheckInCardProps["recordCadence"]>;

/** The exact consent state of a user who has just declined: nothing recorded at all. */
const DECLINED_USER_CONSENT_ROWS: readonly string[] = [];

function setup() {
  const submit = vi.fn<SubmitFn>(async () => ({ ok: true as const, data: null }));
  const recordCadence = vi.fn<CadenceFn>(async () => ({ ok: true as const, data: null }));
  render(
    <WeeklyCheckInCard
      userId="u1"
      isoWeekStart="2026-06-29"
      cadence={null}
      submit={submit}
      recordCadence={recordCadence}
      onResolved={vi.fn()}
    />,
  );
  return { submit, recordCadence, user: userEvent.setup() };
}

afterEach(cleanup);

describe("the user under test really is camera-gate-blocked", () => {
  it("a user with no consent rows is blocked from capture", () => {
    // Without this the whole file could pass against a consenting user and prove nothing.
    expect(
      decideCameraGate({ status: "ok", heldVersionIds: DECLINED_USER_CONSENT_ROWS }),
    ).toBe("blocked");
  });
});

describe("the weekly work-environment survey is unaffected by a camera decline", () => {
  it("renders in full for a user with no camera_inference record", () => {
    setup();
    expect(
      screen.getByText("How has the work environment felt lately?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Good/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Could be better/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip/ })).toBeInTheDocument();
  });

  it("submits normally — the positive path completes and contributes", async () => {
    const { submit, user } = setup();
    await user.click(screen.getByRole("button", { name: /^Good/ }));
    expect(submit).toHaveBeenCalledWith({ isoWeekStart: "2026-06-29", sentiment: "good" });
  });

  it("the skip path still records cadence and still contributes nothing", async () => {
    const { submit, recordCadence, user } = setup();
    await user.click(screen.getByRole("button", { name: /Skip/ }));
    expect(recordCadence).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("the negative path reaches its follow-up questions", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    // The card advances rather than refusing — nothing about consent gates it.
    expect(screen.queryByRole("button", { name: /Could be better/ })).toBeNull();
  });

  it("shows no consent surface, no camera language, and no gate anywhere", () => {
    const { container } = render(
      <WeeklyCheckInCard
        userId="u1"
        isoWeekStart="2026-06-29"
        cadence={null}
        submit={vi.fn<SubmitFn>(async () => ({ ok: true as const, data: null }))}
        recordCadence={vi.fn<CadenceFn>(async () => ({ ok: true as const, data: null }))}
        onResolved={vi.fn()}
      />,
    );
    expect(container.textContent ?? "").not.toMatch(/camera|consent|permission|calibrat/i);
  });
});

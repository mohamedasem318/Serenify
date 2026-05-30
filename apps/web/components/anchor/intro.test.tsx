import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Intro } from "./intro";

describe("Intro (FR-001–004)", () => {
  it("shows the calm heading, the three what-to-expect lines, the privacy line and the CTA", () => {
    render(<Intro onTurnOnCamera={() => {}} />);
    expect(screen.getByRole("heading", { name: "Set your calm baseline" })).toBeInTheDocument();
    expect(screen.getByText("A quiet moment to yourself")).toBeInTheDocument();
    expect(screen.getByText("Good lighting on your face")).toBeInTheDocument();
    expect(screen.getByText("About a minute, sitting still")).toBeInTheDocument();
    expect(screen.getByText(/your video isn.t stored/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /turn on camera/i })).toBeInTheDocument();
    expect(screen.getByText(/browser will ask for permission/i)).toBeInTheDocument();
  });

  it("nudges the heading 'set' → 'update' in the recalibrate path (FR-038/040)", () => {
    render(<Intro mode="recalibrate" onTurnOnCamera={() => {}} />);
    expect(screen.getByRole("heading", { name: "Update your calm baseline" })).toBeInTheDocument();
  });

  it("requests the camera when the primary action is pressed", async () => {
    const onTurnOnCamera = vi.fn();
    render(<Intro onTurnOnCamera={onTurnOnCamera} />);
    await userEvent.click(screen.getByRole("button", { name: /turn on camera/i }));
    expect(onTurnOnCamera).toHaveBeenCalledTimes(1);
  });
});

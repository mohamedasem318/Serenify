import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CrisisResourcePanel } from "@/components/chat/crisis-panel";
import type { CrisisPanel } from "@/lib/api/chat-client";

const UNIVERSAL = "If you're in immediate danger, contact your local emergency services right away.";

const EG: CrisisPanel = {
  resources: [
    {
      country: "EG",
      name: "General Secretariat of Mental Health & Addiction Treatment hotline",
      number: "16328",
      url: null,
      lastChecked: "2026-06-28",
    },
  ],
  universalLine: UNIVERSAL,
  emergencyNumber: "123",
};

const US: CrisisPanel = {
  resources: [
    { country: "US", name: "988 Suicide & Crisis Lifeline", number: "Call/text 988", url: null, lastChecked: "2026-06-28" },
  ],
  universalLine: UNIVERSAL,
  emergencyNumber: null,
};

const NONE: CrisisPanel = { resources: [], universalLine: UNIVERSAL, emergencyNumber: null };

describe("CrisisResourcePanel", () => {
  it("renders the calm heading and the Egypt verified row", () => {
    render(<CrisisResourcePanel panel={EG} />);
    expect(screen.getByText("Reach someone who can help")).toBeInTheDocument();
    expect(screen.getByText(/General Secretariat of Mental Health/)).toBeInTheDocument();
    expect(screen.getByText("16328")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("renders the US verified row", () => {
    render(<CrisisResourcePanel panel={US} />);
    expect(screen.getByText("988 Suicide & Crisis Lifeline")).toBeInTheDocument();
    expect(screen.getByText("Call/text 988")).toBeInTheDocument();
  });

  it("always shows the universal line and never renders blank for an unsupported country", () => {
    render(<CrisisResourcePanel panel={NONE} />);
    expect(screen.getByText(new RegExp(UNIVERSAL.slice(0, 30)))).toBeInTheDocument();
    expect(screen.getByTestId("crisis-panel")).toBeInTheDocument();
  });

  it("uses the calm foggy treatment, never crimson/red (FR-043)", () => {
    render(<CrisisResourcePanel panel={EG} />);
    const panel = screen.getByTestId("crisis-panel");
    expect(panel.className).toMatch(/foggy/);
    expect(panel.className).not.toMatch(/crimson|red-|bg-red|destructive/);
  });
});

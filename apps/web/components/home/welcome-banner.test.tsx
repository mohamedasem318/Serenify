import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WelcomeBanner } from "@/components/home/welcome-banner";

const LOCKED_SUBTITLE = "A space to check in with yourself.";

function atHour(hour: number): Date {
  // Fixed date with the requested local hour. The component reads
  // getHours() (not getUTCHours()), so a local-time Date is correct
  // for the assertion regardless of test-runner timezone.
  const d = new Date(2026, 4, 21, hour, 0, 0);
  return d;
}

describe("WelcomeBanner — adaptive greeting", () => {
  it("says 'Good morning' at 05:00 (start of morning band)", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(5)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good morning, Jane");
  });

  it("says 'Good morning' at 11:59 (end of morning band)", () => {
    const d = new Date(2026, 4, 21, 11, 59, 0);
    render(<WelcomeBanner fullName="Jane Doe" now={d} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good morning, Jane");
  });

  it("says 'Good afternoon' at 12:00 (start of afternoon band)", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(12)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good afternoon, Jane");
  });

  it("says 'Good afternoon' at 17:59 (end of afternoon band)", () => {
    const d = new Date(2026, 4, 21, 17, 59, 0);
    render(<WelcomeBanner fullName="Jane Doe" now={d} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good afternoon, Jane");
  });

  it("says 'Good evening' at 18:00 (start of evening band)", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(18)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good evening, Jane");
  });

  it("says 'Good evening' at 23:00 (late-evening)", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(23)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good evening, Jane");
  });

  it("says 'Good evening' at 03:00 (small hours fall into evening band)", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(3)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good evening, Jane");
  });
});

describe("WelcomeBanner — first-name extraction", () => {
  it("extracts the first whitespace token verbatim, preserving capitalisation", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(10)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good morning, Jane");
  });

  it("uses only the first token from a multi-token name", () => {
    render(
      <WelcomeBanner fullName="Mary Jane Smith-Jones" now={atHour(10)} />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Good morning, Mary");
    expect(heading).not.toHaveTextContent("Jane");
    expect(heading).not.toHaveTextContent("Smith");
  });

  it("preserves diacritics in the first name", () => {
    render(<WelcomeBanner fullName="Zoé Tremblay" now={atHour(10)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good morning, Zoé");
  });

  it("falls back to a name-less greeting when fullName is null", () => {
    render(<WelcomeBanner fullName={null} now={atHour(10)} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Good morning");
    expect(heading.textContent).not.toMatch(/,\s/);
  });

  it("falls back to a name-less greeting when fullName is empty / whitespace-only", () => {
    render(<WelcomeBanner fullName="   " now={atHour(10)} />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Good morning");
  });
});

describe("WelcomeBanner — locked subtitle (Decision M)", () => {
  it("renders the exact subtitle string", () => {
    render(<WelcomeBanner fullName="Jane Doe" now={atHour(10)} />);
    expect(screen.getByText(LOCKED_SUBTITLE)).toBeInTheDocument();
  });

  it("renders the subtitle even when fullName is null", () => {
    render(<WelcomeBanner fullName={null} now={atHour(10)} />);
    expect(screen.getByText(LOCKED_SUBTITLE)).toBeInTheDocument();
  });
});

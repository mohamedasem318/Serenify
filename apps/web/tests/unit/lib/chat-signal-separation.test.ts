import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T072 — signal separation (FR-045/046). A chat-derived band must never appear on a
 * video-derived surface. Enforced structurally: the video surfaces must not import the
 * chat client or the chat band chip, nor reference a chat rollup band.
 */

const ROOT = process.cwd(); // apps/web

const VIDEO_SURFACES = [
  "components/home/todays-checkin-card.tsx",
  "components/monitor/session-trend.tsx",
  "components/monitor/today-view.tsx",
];

const CHAT_IMPORT_MARKERS = [
  "lib/api/chat-client",
  "components/chat/band-chip",
  "components/chat/crisis-panel",
  "rollupBand",
];

describe("chat bands never reach video-derived surfaces", () => {
  const present = VIDEO_SURFACES.map((rel) => path.join(ROOT, rel)).filter(existsSync);

  it("has at least one video surface to check", () => {
    expect(present.length).toBeGreaterThan(0);
  });

  it.each(present)("%s does not import chat band data", (file) => {
    const src = readFileSync(file, "utf8");
    for (const marker of CHAT_IMPORT_MARKERS) {
      expect(src, `${path.basename(file)} references "${marker}"`).not.toContain(marker);
    }
  });
});

/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Serenify — Workplace stress, gently noticed.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const iconData = await readFile(
    join(process.cwd(), "public", "icon-512.png"),
    "base64",
  );
  const iconSrc = `data:image/png;base64,${iconData}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px 76px 62px",
        background: "#101214",
        color: "#E2E5E8",
        borderTop: "8px solid #63B292",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <img
          alt=""
          src={iconSrc}
          width="92"
          height="92"
          style={{ width: 92, height: 92, borderRadius: 18 }}
        />
        {/*
          Hand-sync exception 1 (constitution Principle V, Wordmark).
          This card cannot consume components/brand/wordmark.tsx because
          Satori cannot load Outfit, so the two-colour split is typed by
          hand here. The card is dark-themed (background #101214), so
          both halves carry the DARK token values —
          tests/unit/brand/wordmark-sync.test.ts reads those values out
          of app/globals.css and fails if either side drifts.

          `display: "flex"` on the wrapper is load-bearing: Satori
          requires it on any element with more than one child.
        */}
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          <span style={{ color: "#E2E5E8" }}>seren</span>
          <span style={{ color: "#63B292" }}>ify</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            maxWidth: 980,
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: 0,
          }}
        >
          Workplace stress, gently noticed.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "#939A9F",
            fontSize: 25,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              width: 34,
              height: 4,
              display: "flex",
              borderRadius: 2,
              background: "#63B292",
            }}
          />
          Private check-ins for calmer workdays
        </div>
      </div>
    </div>,
    size,
  );
}

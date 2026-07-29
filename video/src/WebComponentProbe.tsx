import { loadFont } from "@remotion/google-fonts/Outfit";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// The real component, imported straight out of apps/web through the `@/` alias
// that the app itself uses. Nothing is copied, re-typed or re-styled here —
// which is the whole point of the check, and is also what Constitution
// Principle V demands of the wordmark specifically.
import { Wordmark } from "@/components/brand/wordmark";

// `apps/web/app/globals.css` sets `--font-display: "Outfit", sans-serif`, and in
// the app next/font supplies the actual file. Remotion is not Next, so the font
// is loaded here instead; without it `font-display` would silently fall back to
// a generic sans and the wordmark would render in the wrong typeface.
const { fontFamily } = loadFont();

/**
 * Check (2): a real `apps/web` component rendered inside a Remotion
 * composition, with its real Tailwind v4 theme tokens resolved.
 *
 * `<Wordmark />` is the right probe because it fails loudly rather than
 * subtly: it is two tokenised colours (`text-ink` on `seren`, `text-meadow-text`
 * on `ify`) plus a tokenised font and a `lowercase` rule. If the CSS pipeline
 * were broken the output would be one flat colour in the wrong face — visible
 * at a glance in a frame grab, not something you have to squint at.
 */
export function WebComponentProbe() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill className="items-center justify-center bg-bg" style={{ fontFamily }}>
      <div style={{ opacity }} className="flex flex-col items-center gap-8">
        <Wordmark className="text-9xl" />
        <p className="text-muted text-3xl">real apps/web component, real theme tokens</p>
      </div>
    </AbsoluteFill>
  );
}

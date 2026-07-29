import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Check (1): proves the toolchain renders an MP4 at 1920x1080.
 *
 * Uses nothing from `apps/web` on purpose — if this renders and the probe
 * does not, the failure is in the app-component bridge, not in Remotion.
 */
export function HelloWorld() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill className="items-center justify-center bg-bg">
      <div style={{ transform: `scale(${scale})`, opacity }} className="text-ink text-7xl">
        Hello, Remotion.
      </div>
    </AbsoluteFill>
  );
}

import { Composition } from "remotion";

import { HelloWorld } from "./HelloWorld";
import { WebComponentProbe } from "./WebComponentProbe";
import "./tailwind.css";

/**
 * Two compositions, both setup checks, neither a beat from the beat sheet
 * (`docs/video/serenify-launch-video-beat-sheet.md`). The video itself is not
 * started here — this project only proves the pipeline works.
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="WebComponentProbe"
        component={WebComponentProbe}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
}

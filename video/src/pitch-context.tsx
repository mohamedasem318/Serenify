import React from "react";

/**
 * ══ THE TWO THINGS THE PITCH CUT CHANGES INSIDE A BEAT ══════════════════════════════
 *
 * The pitch cut (`docs/video/serenify-pitch-video-beat-sheet.md`) is a different reading of the
 * same thirteen beats, and it is built as a **separate composition** — `PitchVideo` — precisely
 * so the launch cut stays byte-identical and renderable. Almost everything it changes is a
 * duration, and durations live in `pitch.tsx`'s time map, outside the beats entirely.
 *
 * **Two things are not durations**, and this file is how they are reached without forking a beat
 * or editing the launch cut:
 *
 *   `breathPhases`   Beat 5's pacer. 5d goes 75 → 240 output frames, and at three phases that is
 *                    2.7s a phase — slower than a breath, and the label alternates twice in eight
 *                    seconds. §7 · beat 5 asks for **six phases at 40 frames each**, which is the
 *                    first version of the minute where the alternation is followable. The beat
 *                    reads the count from here instead of from a local const.
 *
 *   `beat9Options`   Beat 9's framing. The pitch cut shows the confirmatory prompt TWICE — once
 *                    in the false-alarm sequence, where it is new, and once at beat 9, where it
 *                    is known. Framing it identically the second time is exactly what makes it
 *                    read as a repeat, so beat 9 opens **already landed** on `BEAT9_OPTIONS`
 *                    (the three option rows) rather than pushing in on `BEAT9_PROMPT` (the whole
 *                    panel). See the pitch sheet §7 · beat 9 and `framing.ts` § THE PITCH CUT'S
 *                    BEAT 9.
 *
 * ── WHY A CONTEXT RATHER THAN A PROP OR A SECOND BEAT FILE ──────────────────────────
 *
 * The beats are dispatched by frame, with no props — both cuts mount `<Beat05Calibration/>` the
 * same way — so a prop has nowhere to come from. Copying the two beats into pitch-only variants
 * would put two authored timelines on one set of decisions, which is the launch cut's `CLOCK`
 * bug in a new place: a value that appears twice drifts.
 *
 * **The defaults ARE the launch cut**, so a beat rendered with no provider above it — the
 * `Greybox` composition, every per-beat Studio composition, every probe — behaves exactly as it
 * did. Only `PitchVideo` mounts the provider.
 */
export interface Readout {
  /** `sessionFrom`, in seconds. */
  from: number;
  /** The browser toolbar clock. */
  clock: string;
}

export interface PitchOptions {
  /** 5d's pacer phase count. 3 is the launch cut; the pitch cut takes 6. */
  breathPhases: number;
  /** Beat 9 opens landed on the option group rather than pushing in on the panel. */
  beat9Options: boolean;
  /**
   * ══ THE INTERNAL CLOCK, RE-SOLVED FOR A FILM THAT IS 35 SECONDS LONGER ═════════════
   *
   * The launch sheet's internal clock is a **hard invariant** carried forward by the pitch sheet
   * §2: *any clock, timestamp or timer drawn anywhere in the video must sit on this line.* The
   * line runs 10:43 (the session begins) → 11:30 (beats 7–11), with the session readout at
   * `47:12` when beat 7 opens.
   *
   * **Inserting 1,050 frames of false alarm between beats 7 and 8 puts 35 story-seconds into the
   * middle of that line**, and the readout is the one thing on screen that counts them. Left
   * alone, the film runs `47:20` at the end of 7e and then `47:16` at the start of beat 8 — the
   * session timer going *backwards*, in a cut whose whole second half is about a reading over
   * time. It is the launch sheet's `CLOCK` bug in a new place: a value with two sources.
   *
   * So the three beats that draw the readout after the insertion take their values from here.
   * The gaps are preserved rather than re-derived — each beat picks up where the previous one's
   * own `local frame ÷ 30` left it:
   *
   * **And it is re-solved a second time by the trim pass**, because the same thing is true of a
   * cut that gets shorter: 7b–7e lost 144 frames and beat 10 lost 62, so every readout downstream
   * of them moves. The line below is the shipped one.
   *
   *   beat  7      47:12 → 47:20    (240 frames)
   *   7b–7e        47:20 → 47:50    (906 frames)
   *   beat  8      47:50 → 48:01    (330 frames)
   *   beat  9      48:01 → 48:09    (240 frames)
   *   beat 10      48:09 → 48:29    (598 frames — the chat draws no readout, and the launch cut
   *                                  already treats the session as continuing across it)
   *   beat 11      48:29 → …
   *
   * ── AND THE TOOLBAR CLOCK SURVIVES IT, WHICH IS THE NUMBER THAT MATTERED ───────────
   *
   * 10:43 + 48:01 = **11:31:01**, so beats 9 and 11 genuinely read 11:31 and say so. Beat 8 does
   * not: it runs 11:30:50 → 11:31:01, and `BEAT8_CLOCK` — the **only** shot in the film where
   * the toolbar clock is legible — is up across output frames 30–106, which is 11:30:51 to
   * 11:30:53. It reads **11:30**, and the film's single piece of arithmetic (11:30, "by 12",
   * thirty minutes) is untouched.
   *
   * `COMPOSITE` and `BEAT9_OPTIONS` both frame from world y 156, the app header's own bottom,
   * and the drawn clock sits at y 58 — so beats 9 and 11 never have it in shot either way. The
   * 11:31 is correctness rather than something the audience reads.
   *
   * **`null` is the launch cut**, where each beat keeps its own constant and nothing moves.
   */
  session: { beat8: Readout; beat9: Readout; beat11: Readout } | null;
}

const LAUNCH: PitchOptions = { breathPhases: 3, beat9Options: false, session: null };

export const PitchContext = React.createContext<PitchOptions>(LAUNCH);

export const usePitch = (): PitchOptions => React.useContext(PitchContext);

export const PITCH: PitchOptions = {
  breathPhases: 6,
  beat9Options: true,
  session: {
    beat8: { from: 47 * 60 + 50, clock: "11:30 AM" },
    beat9: { from: 48 * 60 + 1, clock: "11:31 AM" },
    beat11: { from: 48 * 60 + 29, clock: "11:31 AM" },
  },
};

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame as useRenderedFrame } from "remotion";

import { Beat01ColdOpen } from "./greybox/beats/Beat01ColdOpen";
import { Beat02Signup } from "./greybox/beats/Beat02Signup";
import { Beat03Dashboard } from "./greybox/beats/Beat03Dashboard";
import { Beat04CameraGate } from "./greybox/beats/Beat04CameraGate";
import { Beat05Calibration } from "./greybox/beats/Beat05Calibration";
import { Beat06Later } from "./greybox/beats/Beat06Later";
import { Beat07AtEase } from "./greybox/beats/Beat07AtEase";
import { Beat07bFalseAlarm } from "./greybox/beats/Beat07bFalseAlarm";
import { Beat08Email } from "./greybox/beats/Beat08Email";
import { Beat09Questionnaire } from "./greybox/beats/Beat09Questionnaire";
import { Beat10Ren } from "./greybox/beats/Beat10Ren";
import { Beat11ReturnToEase } from "./greybox/beats/Beat11ReturnToEase";
import { Beat12Closing } from "./greybox/beats/Beat12Closing";
import { Beat13EndCard } from "./greybox/beats/Beat13EndCard";
import { BeatRRoadmap } from "./greybox/beats/BeatRRoadmap";
import { PITCH_SETTLE_TICKS, Settle } from "./greybox/settle";
import { FONT, GREY } from "./greybox/theme";
import { PITCH, PitchContext } from "./pitch-context";
import { SubFrameContext } from "./retime";

/**
 * ══ THE PITCH CUT — 5,962 FRAMES, 198.7s, 3:18.7 ════════════════════════════════════
 *
 * `docs/video/serenify-pitch-video-beat-sheet.md` is the spec. This file is its §4 frame table
 * and its §7 per-beat notes, made executable.
 *
 * **It is a SEPARATE composition from `Greybox`, deliberately.** The launch cut is a shipped
 * film and a point-in-time record; nothing here may change it. So `GreyboxVideo.tsx`, its BEATS
 * table, its four interstitial cards and `retime.tsx`'s Premiere segment table are all untouched
 * and still render the film they rendered. What the two cuts share is the thirteen beat
 * components themselves — which is the point, because a beat copied is a beat that drifts.
 *
 * ── WHAT THE PITCH CUT IS ───────────────────────────────────────────────────────────
 *
 * A submission to the Egypt IoT Challenge: a file, watched once, by a judging panel, **with
 * sound on.** A recorded Egyptian Arabic narration is laid over the locked cut in Premiere
 * afterwards, so "silent-first" is retired as a discipline for this cut and the film is slower
 * on purpose — a panel does not scroll away, and a beat has to leave room for a person to talk
 * over it.
 *
 * Three structural differences from the launch cut, all of them in the table below:
 *
 *   · the four interstitial cards are REMOVED. They existed because the dropped VO left the film
 *     with no narration; the narration is back. Three seams they were covering re-open and are
 *     answered in the sheet's §5 — 4 → 5 by the app's own click-and-reload causality, 5 → 6 by a
 *     narrated line the script now OWES, and 9 → 10 by the shipped navigation that "Yes, that's
 *     me" genuinely performs (`confirmatory-trigger.ts:422` → `/app/chat?handoff=…`).
 *   · a NEW false-alarm sequence, 7b–7e, 1,050 frames, between beats 7 and 8. It supersedes the
 *     launch cut's "the questionnaire shows the true-positive branch" invariant; the reason is
 *     recorded in the sheet's §3 rather than the rule being silently dropped.
 *   · a NEW roadmap card, 240 frames, between beats 11 and 12.
 *
 * ── THE MAP IS PER-BEAT, AND THAT IS THE WHOLE DESIGN ───────────────────────────────
 *
 * `retime.tsx` maps the launch cut with fifteen segments across one continuous authored
 * timeline. That shape cannot express this cut: two new beats are inserted into the middle of
 * the timeline, so every downstream source frame would move, which is exactly the "thirteen
 * hand-moved numbers" the launch cut's own notes reject.
 *
 * So each beat carries **its own segment list, in its own local frames**, and the beats are
 * concatenated. A beat's segments are independent of every other beat's, which means inserting
 * 1,050 frames after beat 7 moves nothing at all in beats 8–13.
 *
 * The two mechanisms `retime.tsx` established are kept, because both are load-bearing:
 *
 *   · **the source frame is FRACTIONAL.** A move slowed to 0.45× is genuinely drawn at the
 *     positions between two authored frames rather than at the nearest one. The integer part
 *     rides the `<Sequence>` offset; the remainder rides `SubFrameContext` and is added by the
 *     `useCurrentFrame` every component inside a beat imports from `retime.tsx`.
 *   · **L18 cannot desynchronise.** The stateline and the trend are one number read two ways and
 *     both read the same remapped frame, so a band crossing lands on the frame its copy change
 *     does at any rate. There is no second place for a key to be forgotten.
 *
 * ── AND ONE MECHANISM IS NEW: A BEAT MAY RUN PAST ITS AUTHORED END ──────────────────
 *
 * §7's governing instruction: *extending a beat is not changing `durationInFrames`.* Beat 7
 * going 72 → 240 frames means five and a half seconds after its authored animation finishes, and
 * a beat that holds a finished animation for its remainder has not been retimed, it has been
 * stretched — it renders as a freeze.
 *
 * For **moves**, a segment slower than 1.000× is exactly right: the camera's own easing is
 * re-rendered at the in-between positions and the move simply takes longer.
 *
 * For **holds**, it is exactly wrong. Slowing a hold slows everything ambient inside it — the
 * bloom's pulse, his breath, the typing, the blink, the `Session · MM:SS` seconds — all of which
 * are frame-derived and all of which are supposed to be running at real speed. A 6.5s bloom loop
 * at 0.25× is a 26-second bloom loop, and the readout stops being a clock.
 *
 * So a beat's last segment may map to source frames **beyond its authored duration**. The beat
 * is mounted for as long as the map asks for; its camera keys clamp at their last shot, its
 * expression keys clamp at their last pose, its level keys clamp at their last value — and
 * everything ambient keeps running at 1.000×, because the beat's own local frame keeps
 * advancing. That is what a *motivated hold* is: the camera has stopped and the picture has not.
 * Beats 7 and 11 both use it, and both are the beats §7 gives a genuine hold to.
 *
 * ── TWO THINGS INSIDE BEATS THAT ARE NOT DURATIONS ──────────────────────────────────
 *
 * Beat 5's pacer phase count and beat 9's framing. Both are reached through `PitchContext`,
 * whose defaults are the launch cut's behaviour — see `pitch-context.tsx` for why a context and
 * not a prop or a forked beat file.
 */

/**
 * One rate change inside a beat. `[src0, src1)` of the beat's own authored timeline is played
 * over `out` output frames. `src0 === src1` means **hold that source frame** for `out` frames,
 * which is what the end card's tail does.
 */
export type Seg = readonly [src0: number, src1: number, out: number];

interface PitchBeat {
  readonly name: string;
  readonly Beat: React.FC;
  /** The beat's authored duration, for the record. Unchanged from the launch cut. */
  readonly authored: number;
  readonly segs: readonly Seg[];
}

/**
 * ══ THE PER-BEAT TABLE ══════════════════════════════════════════════════════════════
 *
 * Every beat's output length is the sum of its segments' `out` values, and the film's length is
 * the sum of those. **There is no second copy of any duration anywhere** — the sheet's §4 table
 * is prose about this table, and `PITCH_DURATION` below is computed rather than asserted. A
 * duration that appears in two places is the launch cut's `CLOCK` bug waiting to happen.
 *
 *   beat                    authored     out       Δ
 *   ──────────────────────  ────────  ──────  ──────
 *    1 cold open                 180     300    +120
 *    2 signup                    432     600    +168
 *    3 dashboard                 120     300    +180
 *    4 camera gate               120     270    +150
 *    5 calibration               422     900    +478
 *    6 later                      36      60     +24
 *    7 at ease                    72     240    +168
 *   7b–7e false alarm             —    1050   +1050   NEW
 *    8 the email                 184     330    +146
 *    9 questionnaire              76     240    +164
 *   10 Ren                       310     660    +350
 *   11 return to ease            234     450    +216
 *    R roadmap                    —      240    +240   NEW
 *   12 closing card               90      90       0
 *   13 end card                  172     232     +60   172 + the 60-frame tail hold
 *                             ──────  ──────
 *                               2448    5962          198.73s · 3:18.7
 */
export const PITCH_BEATS: readonly PitchBeat[] = [
  {
    name: "1 · cold open",
    Beat: Beat01ColdOpen,
    authored: 180,
    /**
     * §7: the +120 is a **slower ease on the lift and the push, not a hold.** A slow arrival at a
     * live URL says *this is deployed* better than a fast one plus dead air, and it is the
     * narrator's opening, which needs an unhurried picture under it.
     *
     * The lift's travel and settle take 100 output frames rather than 44; the push to the hero
     * block takes 80 rather than 34; the hero landing holds 40 before the click rather than 28.
     * The beat's tail after the click is 1.000× — it is the seam into beat 2.
     */
    segs: [
      [0, 46, 52], // the lifted omnibox, `serenify.tech` typed
      [46, 90, 100], // the lift travels home as the page paints
      [90, 124, 80], // the push to the hero block
      [124, 152, 40], // the hero, read, before the click
      [152, 180, 28], // 1.000× — the seam
    ],
  },
  {
    name: "2 · signup",
    Beat: Beat02Signup,
    authored: 432,
    /**
     * §7: distributed across the ten landings' settles, and explicitly **not** as one long hold
     * anywhere. The launch cut's −1.2s pass took eleven holds out of 2e because each outlasted
     * its own read *in a feed*; a panel with a narrator over it has the opposite problem, so most
     * of them come back.
     *
     * **Three things do not move, and they are 1.000× below:** the URL typing (a performed
     * action at its own rate), the email card's own read, and the **OTP choreography**, which
     * stays at 2.94s real time. It is the best piece of motion in the product and slowing it
     * would be the one change in this cut that makes something worse. Its 1.000× segment runs to
     * the beat's end, so the seam into beat 3 keeps its velocity too.
     *
     * **And the push onto the email in the inbox goes 16 → 21 frames.** The launch sheet measured
     * it at 167.0 px/frame, wanted 21 for family with the rest of the film, and could not afford
     * them out of beat 2's tail. This cut can. Peak drops to ~127 px/frame — the body's own
     * fastest move.
     */
    segs: [
      [0, 16, 38], // establish, the whole signup card
      [16, 48, 36],
      [48, 70, 40], // the field group
      [70, 88, 22],
      [88, 110, 40], // the password and its checklist lighting row by row
      [110, 134, 28], // (the page scroll to the consent row is inside this)
      [134, 158, 42], // the consent row and the submit
      [158, 182, 28],
      [182, 196, 32], // "Check your email", with the OTP panel already mounted
      [196, 206, 14],
      [206, 220, 24], // the new-tab click, and the blank tab
      [220, 236, 16], // 1.000× — THE URL TYPING, a performed action
      [236, 252, 21], // the push onto the unread row: 16 → 21 (§7)
      [252, 262, 16], // the row, read, and clicked
      [262, 272, 14],
      [272, 277, 10],
      [277, 290, 17],
      [290, 302, 12], // 1.000× — THE EMAIL CARD'S OWN READ
      [302, 310, 12],
      [310, 330, 30],
      [330, 344, 20],
      [344, 432, 88], // 1.000× — THE OTP CHOREOGRAPHY, 2.94s, and the seam into beat 3
    ],
  },
  {
    name: "3 · dashboard",
    Beat: Beat03Dashboard,
    authored: 120,
    /**
     * §7: this beat has the most obvious answer in the film and the launch cut could not afford
     * it. The launch sheet: *"The 20-word sentence was never going to be fully read whatever the
     * hold — the lift buys legibility, not reading time."* **In this cut it is read** — the
     * lifted calibration banner holds **120 frames, four seconds**, at its 520px measure and its
     * real 14px.
     *
     * Both ends are 1.000×: the arrival from beat 2 and the departure into beat 4 are hand-overs
     * at speed, and changing either half's rate would break the velocity match that makes them
     * read as one gesture rather than two moves.
     */
    segs: [
      [0, 26, 26], // 1.000× — beat 2's pull-out finishing, the dashboard arriving under it
      [26, 40, 28],
      [40, 60, 25], // the banner detaches and travels
      [60, 82, 120], // THE LIFTED BANNER, READ — 22 → 120 (§7)
      [82, 100, 40], // it settles back
      [100, 108, 49], // the settled dashboard, its three real empty states legible
      [108, 120, 12], // 1.000× — the departure into beat 4, at speed
    ],
  },
  {
    name: "4 · camera gate",
    Beat: Beat04CameraGate,
    authored: 120,
    /**
     * §7: the beat's real content is a long page visibly scrolling, and the added time goes to
     * the scroll and the two landings' settles. **No new landing, and the deleted "Nothing is
     * kept…" landing does not come back** — it was removed because the claim is made better at
     * 5a, and having more time does not change that reasoning.
     *
     * **One departure from §7, stated rather than fudged.** §7 says the scroll runs across 150
     * output frames; it runs across **200** here. The scroll and the establishing hold are the
     * same authored frames (the scroll is held under the establishing camera and finished under
     * the pull to the buttons), so separating them would need a keyframe edit inside the beat,
     * which is out of scope. 200 is the consequence of giving the establish its settle; the
     * direction is right and the number is not the one §7 predicted.
     */
    segs: [
      [0, 14, 14], // 1.000× — beat 3's push, arriving at speed
      [14, 72, 140], // establish + the page scrolling under it
      [72, 104, 60], // the pull to the buttons, the scroll finishing
      [104, 120, 56], // the CTA, and the click on "Allow camera and inference"
    ],
  },
  {
    name: "5 · calibration",
    Beat: Beat05Calibration,
    authored: 422,
    /**
     * §7 allocates this beat's +478 sub-beat by sub-beat, and the segments below are exactly that
     * allocation:
     *
     *   5a  +120   the 590 landing holds 160 frames rather than 44. The privacy line takes the
     *              in-place emphasis (L12) ONCE — a longer hold is not permission to fire it
     *              twice, and L12's *no yo-yo* rule is absolute
     *   5b   +90   the green-room hold 52 → 142. This is the film's first sight of his face and
     *              the launch sheet says *give it a real hold*; in the launch cut it got 1.7s
     *   5c   +30   three numbers at 25 output frames each instead of 15
     *   5d  +165   75 → 240, and **six breath phases at 40 frames each** rather than three. The
     *              phase count comes from `PitchContext`; see `pitch-context.tsx`
     *   5e   +30   the push across the flip keeps its shape and its 21%-in landing
     *   5f   +43   the success state's read — sixteen words at 16px got 48 frames, and gets 91
     */
    segs: [
      [0, 76, 196], // 5a · the intro, the privacy line, its emphasis
      [76, 150, 164], // 5b · the green room, and the first sight of his face
      [150, 195, 75], // 5c · the countdown, 25 frames a number
      [195, 270, 240], // 5d · the compressed minute, six phases
      [270, 318, 78], // 5e · the uploading line
      [318, 422, 147], // 5f · the success state, read, then the click
    ],
  },
  {
    name: "6 · later",
    Beat: Beat06Later,
    authored: 36,
    /**
     * §7: the +24 is **entirely in front of the click.** The launch cut's −24 pass removed 38
     * dead frames *after* the press — the page does not respond to that click and the camera does
     * not move — and those stay removed.
     *
     * What the beat gains is time for the calibration banner's *absence* to register, and for the
     * narrated line this seam owes to land inside the beat rather than across its boundary. **The
     * 5 → 6 seam is the one place in the film where "the narration covers it" is the whole
     * answer** (sheet §5.2): the toolbar clock reads 10:26 at the end of beat 5 and 10:43 here,
     * and the card that used to bridge those seventeen minutes is gone. The clock gets no
     * emphasis — L11 forbids it — so the picture makes the information reachable and the narrator
     * makes it land.
     */
    segs: [
      [0, 18, 42], // the absence, and the cursor to the real "Start check-in"
      [18, 36, 18], // 1.000× — the 14-frame post-click band, unchanged
    ],
  },
  {
    name: "7 · at ease",
    Beat: Beat07AtEase,
    authored: 72,
    /**
     * §7 gives this beat a **genuine hold**, and it has the strongest claim to one in the film:
     * it is the "before" the whole second half is measured against, and the launch sheet's own
     * note is that the audience needs it *registered*.
     *
     * So the push is slowed a little — 36 → 60 output frames, a gentler settle onto a calm frame
     * — and then the beat **runs past its authored end at 1.000×**. The camera clamps at
     * `COMPOSITE` from its f36 key and does not move again; everything else keeps running at real
     * speed, which is the whole reason the tail is a hold rather than a slow-down: the orb pulses
     * at its own rate, he breathes and types at his, and the `Session · MM:SS` seconds tick at
     * one per thirty frames.
     *
     * The readout runs 47:12 → **47:20** across the beat, which is where the false-alarm sequence
     * picks it up.
     */
    segs: [
      [0, 36, 60], // the push, slowed
      [36, 240, 180], // 1.000× — landed, and alive. The beat runs 168 frames past its authored end
    ],
  },
  {
    name: "7b–7e · false alarm",
    Beat: Beat07bFalseAlarm,
    authored: 1050,
    /**
     * NEW — sheet §6. 1,050 frames, authored at its own rate throughout, so no segment here does
     * anything but pass the frame through.
     *
     *   7b    0– 210   he settles into `focused` over 60 frames. The reading is still at ease,
     *                  which is the point: the audience sees him look strained WHILE the app says
     *                  "You're at ease right now"
     *   7c  210– 510   the climb — identical amber, identical copy, identical band thresholds to
     *                  beat 8's. Only the pacing differs, and it differs because nothing else is
     *                  happening in it
     *   7d  510– 810   the prompt, read whole at `BEAT9_PROMPT`, and the cursor goes to
     *                  **"No, I'm okay"**
     *   7e  810–1050   the prompt is gone. Nothing acknowledges the answer, because the shipped
     *                  handler acknowledges nothing (`confirmatory-trigger.ts:424`). The reading
     *                  comes down from f855 — 45 frames after the click, never on it, because a
     *                  descent tied to the click frame is a film depicting a model that learns
     *                  from being corrected. It does not.
     */
    segs: [[0, 1050, 1050]],
  },
  {
    name: "8 · the email",
    Beat: Beat08Email,
    authored: 184,
    /**
     * §7: the beat to change least. **The fall does not change** — sixteen frames of continuous
     * travel through the whole pose vector, at the tight framing, with the toast up. It is the
     * fifteen most important frames in the film and it is 1.000× below.
     *
     *   +38  the toast's hold at `BEAT8_CLOCK`, 38 → 76. This is the film's only piece of
     *        arithmetic — the clock at 32.1px, the subject at 16.05px, the audience subtracting
     *        11:30 from "by 12" unaided. It got 1.27s in a feed; it gets 2.5s from a panel
     *   +16  the settle on the fall, 16 → 32. Still less than the 48 the launch cut removed,
     *        because a held constant pose is the definition of dead dwell
     *   +92  the wide phase. The escalation runs on a static camera with nothing else moving, and
     *        the launch sheet flags it as *the one thing to watch*: whether "a little tense" →
     *        "tense" reads as easy to miss. This puts ~62 output frames between the two copy
     *        changes instead of 22, which is the cheapest available answer to that risk. The
     *        in-place emphasis still does not come back — L15 removed it and the trend has its room
     */
    segs: [
      [0, 30, 30], // 1.000× — opens on COMPOSITE, handed over from 7e
      [30, 68, 76], // the clock and the toast: 38 → 76 (§7)
      [68, 86, 18], // 1.000× — the move to his face, and THE FALL
      [86, 102, 32], // the settle on the fall: 16 → 32 (§7)
      [102, 134, 32], // 1.000× — the pull out to the wide
      [134, 184, 142], // the drift, and both stateline steps
    ],
  },
  {
    name: "9 · questionnaire",
    Beat: Beat09Questionnaire,
    authored: 76,
    /**
     * §7: **this beat must not read as a repeat of 7d**, and three things make sure of it.
     *
     *   1. It opens ALREADY LANDED. 7d pushes in over 36 frames; this does not push at all. The
     *      audience has seen this surface arrive once, and watching it arrive again is the repeat.
     *      (The framing swap is `PitchContext`'s `beat9Options`; see `Beat09Questionnaire.tsx`.)
     *   2. It is framed on the CHOICE, not the question — `BEAT9_OPTIONS`, the three option rows,
     *      rather than `BEAT9_PROMPT`, the whole panel. The title and body are partly out of frame
     *      by design.
     *   3. It is shorter — 240 against 7d's 300, and the difference is read time.
     *
     * The tail after the click is the moment before the navigation: "Yes, that's me" genuinely
     * calls `openRen` and navigates to `/app/chat?handoff=confirmatory_yes`, which is what covers
     * the 9 → 10 seam the fourth interstitial card used to cover (sheet §5.3).
     */
    segs: [
      [0, 42, 96], // landed on the options from f0 — the read
      [42, 60, 50], // the pointer's travel, deliberate
      [60, 76, 94], // the hover, the click, and the beat before the navigation
    ],
  },
  {
    name: "10 · Ren",
    Beat: Beat10Ren,
    authored: 310,
    /**
     * §7: mostly a debt being paid rather than air being added.
     *
     *   typing   92 → 156 output frames. 78 characters at **15 c/s**. The launch sheet's rule is
     *            *never speed the typing to fit, shorten the line instead*; the copy is fixed and
     *            Mohamed's, so the only lever is the beat's length, and this cut has it. 25.4 c/s
     *            was already declared faster than a person types and the Premiere cut took it to
     *            35.6. This is the first version where it reads as somebody typing
     *   turn 1   36 → 60. Seven words at 14.37px, in the beat itself rather than via a retime
     *            island the way the launch cut had to
     *   turn 3   60 → 170. *Protect at all costs*; it reads at 9.52px, which is a property of the
     *            conversation's own layout and not fixable by framing, so time is the only lever
     *            and this cut takes it. §7 predicted 110 — the surplus goes here rather than into
     *            padding a move, and it is stated rather than absorbed
     *   the two typing indicators and the face landing take the rest
     *
     * **No retime island.** The launch cut runs this beat at 1.400× with a 0.706× split cut into
     * it for turn 1, and records both sets of numbers so they can never be confused. Here the
     * durations are authored directly and the two sets stop existing.
     *
     * Beat 10 is otherwise unchanged: the composer-seeding divergence recorded in the sheet's §10
     * item 2 is known and is deliberately not fixed in this cut.
     */
    segs: [
      [0, 38, 106], // the panel, the move, and Ren composing — his face landing gets its hold
      [38, 74, 60], // TURN 1, READ — 36 → 60 (§7)
      [74, 104, 70], // the move to the working shot, the cursor, the caret click
      [104, 196, 156], // THE TYPING — 92 → 156, i.e. 15 c/s (§7)
      [196, 214, 50], // the pointer to send, the hover on arrival, the click, the bubble
      [214, 250, 48], // the second typing indicator — 36 → 48 (§7)
      [250, 310, 170], // TURN 3 — the protected hold, 60 → 170
    ],
  },
  {
    name: "11 · return to ease",
    Beat: Beat11ReturnToEase,
    authored: 234,
    /**
     * §7: +40 to the player's landing (Billie Jean and Michael Jackson are the evidence Ren knew
     * him, and a panel should get to read them rather than infer them), +40 to the relief before
     * the pull-out, and +136 to the closing composite.
     *
     * **The composite's 136 extra frames are taken as a live hold, not as a slow-down**, and the
     * distinction matters here more than anywhere: the descent — the bloom drifting amber →
     * meadow on its 1.3s ease, the stateline returning, the trend's tail walking back down, the
     * nod, the drifting notes, him typing throughout — plays at **1.000×**, and then the beat runs
     * 134 frames past its authored end with the camera clamped at `BEAT11_WIDE`. Slowing the
     * descent instead would have halved the speed of the nod and the notes, which are the two
     * things in the frame that have to look like a person enjoying a song.
     *
     * The 31 frames Mohamed deleted from beat 11's tail in Premiere are not restored as a tail;
     * the linger here is in front of the roadmap card and is measured against a 199s film.
     */
    segs: [
      [0, 18, 18],
      [18, 24, 6],
      [24, 42, 20], // the punch onto the player, beginning on the click
      [42, 60, 58], // the player, landed — the track named and read (§7 +40)
      [60, 98, 78], // the pull-out, and the relief travelling into `easing` (§7 +40)
      [98, 234, 136], // 1.000× — the whole descent, at real speed
      [234, 368, 134], // 1.000× — the linger, alive: his breath, the nod, the notes
    ],
  },
  {
    name: "R · roadmap",
    Beat: BeatRRoadmap,
    authored: 240,
    /**
     * NEW — sheet §8. Three rows, flush left, in a two-column grid: a list rather than a centred
     * sentence, because beat 12's card is the film's one claim and a second centred sentence
     * eight seconds before it competes with it.
     *
     * **The most severable part of this cut.** If the schedule slips it comes out whole — 240
     * frames, no dependency in either direction, and the film is 5,722, under the floor, with the
     * frames coming back from beat 5's 5d and beat 10's turn-3 hold in that order.
     */
    segs: [[0, 240, 240]],
  },
  {
    name: "12 · closing card",
    Beat: Beat12Closing,
    authored: 90,
    /**
     * **Unchanged, to the frame.** *"A detection is a question, not a verdict."*, verbatim from
     * `lib/landing/copy.ts` § `NEVER_CARD_DECIDE_BODY`. The launch cut ran it at 88–89 output
     * frames because its last three caught the end card's 2.600× segment; there is no such
     * segment here, so it runs its authored 90.
     *
     * Two things this cut changes about the card without changing the card. It is now the film's
     * **only** subtitle card — the four interstitials are gone — so it is a device used once,
     * which is what it was designed to be. And its first constraint is retired: the launch cut
     * showed only the true-positive path and the line could not lean on a branch the film never
     * showed. **This cut shows both**, so the line is demonstrated rather than asserted. The line
     * does not change — it was chosen to satisfy the stricter constraint.
     */
    segs: [[0, 90, 90]],
  },
  {
    name: "13 · end card",
    Beat: Beat13EndCard,
    authored: 172,
    /**
     * **Unchanged in structure and in every authored event**, and it runs at the **Premiere cut's
     * rates**, which are Mohamed's and are approved: 2.600× across the wordmark reveal, 1.699×
     * through the domain. The reveal lands in **27.7 frames, 0.92s**. *Do not restore the
     * 72-frame wipe* — it was reported as "still far too fast" at 36, doubled to 72, and his own
     * cut then took it below the version he rejected. He has watched this and approved it.
     *
     * The three rates are `retime.tsx`'s last three segments, converted to this beat's local
     * frames. What differs from the launch cut is only the **static tail**: its last 17 authored
     * frames, in which nothing animates at all, are held over **100** output frames rather than
     * 58. That is where the difference between the 129-frame Premiere output and the 172 this cut
     * specifies goes, and it is the one place in beat 13 where time can be added without touching
     * a decision already made twice.
     *
     * ── AND THE 60-FRAME TAIL HOLD ──────────────────────────────────────────────────
     *
     * The last segment holds source frame 171.99 — the end card's final frame — for 60 frames,
     * for Mohamed to trim in Premiere. Nothing animates in it. **Cutting all 60 gives 5,902
     * frames, which is still inside the sheet's 5,900–6,100 window**, so it is severable without
     * anything else moving.
     */
    segs: [
      [0, 95.8, 37], // 2.600× — the wordmark reveal, 27.7 frames of it
      [95.8, 155.0, 35], // 1.699× — "take care of yourself", and the domain deriving
      [155.0, 172.0, 100], // the static tail: 17 authored frames over 100
      [172, 172, 60], // THE TAIL HOLD — the final frame, held, for Premiere
    ],
  },
];

// ── The map ─────────────────────────────────────────────────────────────────

interface Placed {
  readonly beat: PitchBeat;
  /** First output frame of the beat. */
  readonly out0: number;
  /** Output length. */
  readonly out: number;
  /** How many frames the beat must stay mounted for — may exceed `authored`. */
  readonly mount: number;
}

const outOf = (b: PitchBeat) => b.segs.reduce((n, s) => n + s[2], 0);

export const PITCH_PLACED: readonly Placed[] = PITCH_BEATS.reduce<Placed[]>((acc, beat) => {
  const prev = acc[acc.length - 1];
  const out0 = prev ? prev.out0 + prev.out : 0;
  const maxSrc = beat.segs.reduce((m, s) => Math.max(m, s[0], s[1]), 0);
  acc.push({ beat, out0, out: outOf(beat), mount: Math.ceil(maxSrc) + 1 });
  return acc;
}, []);

/** The film's length. Computed from the table — never asserted beside it. */
export const PITCH_DURATION = PITCH_PLACED.reduce((n, p) => n + p.out, 0);

/** The beat an output frame lands in, and the fractional source frame it reads. */
export const pitchFrameAt = (out: number): { placed: Placed; source: number } => {
  const f = Math.min(Math.max(out, 0), PITCH_DURATION - 1);
  let placed = PITCH_PLACED[PITCH_PLACED.length - 1];
  for (const p of PITCH_PLACED) {
    if (f < p.out0 + p.out) {
      placed = p;
      break;
    }
  }
  let local = f - placed.out0;
  for (const [src0, src1, out1] of placed.beat.segs) {
    if (local < out1) {
      // A zero-length source range is a HOLD on `src0` — the end card's tail.
      const t = out1 === 0 ? 0 : local / out1;
      return { placed, source: src0 + t * (src1 - src0) };
    }
    local -= out1;
  }
  const last = placed.beat.segs[placed.beat.segs.length - 1];
  return { placed, source: last[1] };
};

/**
 * The film at one output frame. Same mounting contract as `GreyboxVideo.tsx`'s `FilmFrame`: the
 * integer source frame rides the `<Sequence>` offset so the child's `useCurrentFrame()` reads it,
 * and the remainder rides `SubFrameContext`. `key` is the beat's name, so a beat mounts once and
 * stays mounted for its whole run — the `delayRender` gates in `landing.tsx` and `monitor.tsx`
 * depend on that and would otherwise re-fire every frame.
 */
export const PitchFrame: React.FC<{ out: number }> = ({ out }) => {
  const { placed, source } = pitchFrameAt(out);
  const authored = Math.min(Math.floor(source), placed.mount - 1);
  const subFrame = source - authored;
  const { name, Beat } = placed.beat;

  return (
    <SubFrameContext.Provider value={subFrame}>
      <Sequence key={name} layout="none" from={out - authored} durationInFrames={placed.mount}>
        <Beat />
      </Sequence>
    </SubFrameContext.Provider>
  );
};

export const PitchVideo: React.FC = () => {
  // Remotion's own frame — this is the OUTPUT frame the renderer is producing.
  const out = useRenderedFrame();
  return (
    <PitchContext.Provider value={PITCH}>
      <AbsoluteFill style={{ backgroundColor: GREY.black, fontFamily: FONT }}>
        {/* Mounted once for the whole cut, outside the provider that carries the sub-frame —
            see `settle.tsx`: it keys on the frame being RENDERED, not the frame being read. */}
        <Settle ticks={PITCH_SETTLE_TICKS} />
        <PitchFrame out={out} />
      </AbsoluteFill>
    </PitchContext.Provider>
  );
};

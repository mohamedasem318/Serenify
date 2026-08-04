# Serenify — Egypt IoT Challenge pitch cut · beat sheet v1

**Format:** 16:9, 1920×1080, 30fps. **5,962 frames — 198.7s, 3:18.7.**

**Submission context:** a file uploaded to a judging panel, watched **with sound on**, once,
by people whose job is to evaluate it. Not a scrolling feed. Every constraint in this sheet
that differs from the launch cut descends from those three facts.

**This is a sibling of `docs/video/serenify-launch-video-beat-sheet.md`, not a revision of it.**
That sheet is a point-in-time record of a shipped film and is not edited. It remains the
authority on everything this sheet does not restate: the framing geometry and its derivations,
the character rig's construction, the assets pass, the five bad rects, the frame-drop
investigation, the Premiere round trip and the deferred register. **None of that is reproduced
here.** Where this sheet needs a number from it, it cites it.

---

## §1 · What is different about this cut

**1. Sound is on, and the film no longer has to explain itself.** A recorded Egyptian Arabic
narration is laid over the locked cut in Premiere afterwards. **"Silent-first" is retired as a
discipline for this cut.** It is not repealed as a *value* — the pictures still carry the
argument, and a judge who mutes it still follows the story — but a beat is no longer forbidden
from depending on something being said. That is the single change that unlocks everything else.

**2. It is slower on purpose.** The launch cut was tuned for a phone in a feed, where a beat
that outlasts its own read loses the viewer. A panel watching a submission does not scroll away.
Every beat gets room for a person to talk over it, and the pacing target inverts: the launch
cut's problem was dead dwell, this cut's problem would be a narrator racing a picture.

**3. It shows the false-alarm branch**, which the launch cut did not. New sequence 7b–7e, ~35s,
between beats 7 and 8. See §6.

**4. The four interstitial cards are removed.** They existed because the dropped VO left the
film with no narration. The narration is back. See §5.

**5. A roadmap card is added** between beats 11 and 12. See §8.

---

## §2 · What carries forward unchanged

Everything below is settled in the launch sheet and **is not reopened by this cut.** Do not
re-derive, re-measure or re-litigate any of it.

- **The declared creative liberties, L1–L18**, in full, including their measured justifications.
  L18 in particular — the reading is one number, `bandOf(level)` drives both the stateline and
  the trend's right-hand end — is load-bearing for the new false-alarm sequence and must not be
  worked around there.
- **The hard invariants**, with exactly one supersession, recorded in §3: no cuts inside a beat;
  hover is a function of the frame; expressions are transforms on separable parts; **he never
  stops working**; **no red anywhere** (attention = foggy, stress = amber, affirmative = meadow);
  **no numeric stress value, ever**; copy is verbatim from the app.
- **The character rig** — the thirteen-number decomposition, the named expressions, the
  Avataaars base and its licence, the authored torso and backdrop, the cut hands, and the facial
  coding rule that **`tense` must never use lowered inner brows.** §6 adds one new *point* in
  that thirteen-number space and no new drawing; see §6.2.
- **The framing discipline and its geometry references.** `video/src/app/geometry.ts` and
  `framing.ts` stand as measured. Push-ins land on whole elements; full-bleed furniture is the
  one exception; a sliced line of text is always a failure. **No framing number in this cut is
  re-derived**, and no beat below asks for one.
- **The assets pass** — the browser chrome and its clock, the mail client, the music player, the
  album art, the macOS toast, the two closing cards. All built, all reused as-is.
- **The third-party-brand decision (L2b)** — generic mail client, generic player, Billie Jean
  named.
- **The internal clock.** Signup ~10:20 → calibration ~10:25 → session begins 10:43 → beats 7
  through 11 all read **11:30**, session timer from `47:12`. §6's false-alarm sequence sits
  *inside* that same minute and does not disturb it; see §6.5.
- **The typeface work** — Inter and Outfit registered in `video/src/fonts.ts`, the furniture on
  Inter with tabular figures, Nunito on the end card's one line.
- **`<StillMotion/>`** — the CSS half of `prefers-reduced-motion`, mounted in `<Camera/>`. Every
  beat renders it by construction; the new sequence inherits it and must not fight it.

---

## §3 · The one superseded invariant

The launch sheet's hard invariants contain:

> **The confirmatory questionnaire shows the TRUE-POSITIVE branch.** The landing hero shows the
> false alarm. This inversion is intentional.

**SUPERSEDED for this cut, 2026-08-04. Recorded rather than dropped, with its reason.**

**What it becomes:** the pitch cut shows **both branches, false alarm first** — 7b–7e, then
beats 8–9. The inversion is retired because it has nothing left to be an inversion *of*: it was
a division of labour between two artefacts, and one of the two is no longer carrying half.

**Why the original rule existed, stated fairly.** The launch cut was 83 seconds for a muted
feed. It could afford exactly one questionnaire, and it picked the branch that leads somewhere —
the true positive, which opens Ren, which is beats 10 and 11. The false alarm leads nowhere by
design (see §6.4), so in an 83-second film it would have been thirty-five seconds spent on a
thing that resolves to nothing. Putting it on the landing hero instead meant the *product's*
public surface still showed both branches, across the two artefacts, and neither one lied.

**Why it does not survive here.** The pitch cut is 199 seconds and it is watched by a panel
evaluating the system's *judgement*, not by a stranger deciding whether to click. To that
audience the false alarm is not a branch, it is **the claim**: a detector that cannot be wrong
in public is a detector nobody should trust. Beat 12's card — *"A detection is a question, not a
verdict."* — is an assertion in the launch cut and a **demonstration** in this one, because the
audience has watched the same question get two different answers.

**What is NOT affected.** The landing hero is untouched. `apps/web` changes nothing. The
inversion was a statement about the *film*, and only the film is superseded.

---

## §4 · Frame budget

30fps throughout.

**The baseline is the authored timeline, and nothing is subtracted from it.** An earlier version
of this section derived it from the shipped 2,501 by subtracting the cards and the Premiere
deltas and then adding beats 12 and 13 back — which double-counted those two, and quoted beats
1–11 at 2,129 when §7's own per-beat authored durations sum to **2,186**. The authored numbers in
§7 are the correct ones; they are `video/src/greybox/GreyboxVideo.tsx` § `BEATS`, verified
against the repo, and the per-beat target table below is unchanged.

The derivation is simpler than the one it replaces, because both of the things that were being
subtracted were never in the baseline to begin with:

| | frames |
|---|---|
| **the authored timeline — 13 beats, `GreyboxVideo.tsx` § `BEATS`** | **2,448** |
| of which beats 1–11, which this cut extends | 2,186 |
| of which beats 12–13, which this cut keeps exactly | 262 |
| the four interstitial cards | **0** — they are *output*-timeline material, inserted downstream of the retime map, and were never in the authored 2,448 |
| the Premiere cut's deltas | **0** — they are a time map *over* the authored timeline, not an edit *of* it |

    180 + 432 + 120 + 120 + 422 + 36 + 72 + 184 + 76 + 310 + 234  =  2,186   (beats 1–11)
                                                          90 + 172 =    262   (beats 12–13)
                                                                    ───────
                                                                      2,448

Removing the four cards costs the *shipped film* 240 frames (2,501 → 2,261) and costs this
baseline nothing. Beats 1–11 extend from their authored durations; beats 12 and 13 keep theirs
exactly.

### The table

| # | Beat | Authored | Pitch cut | Δ |
|---|---|---|---|---|
| 1 | Cold open | 180 | **300** | +120 |
| 2 | Signup | 432 | **600** | +168 |
| 3 | Dashboard, first arrival | 120 | **300** | +180 |
| 4 | Camera consent gate | 120 | **270** | +150 |
| 5 | Calibration | 422 | **900** | +478 |
| 6 | "Later" | 36 | **60** | +24 |
| 7 | Working, at ease | 72 | **240** | +168 |
| **7b–7e** | **False alarm — NEW** | — | **1,050** | +1,050 |
| 8 | The email | 184 | **330** | +146 |
| 9 | Confirmatory questionnaire | 76 | **240** | +164 |
| 10 | Ren | 310 | **660** | +350 |
| 11 | Return to ease | 234 | **450** | +216 |
| **R** | **Roadmap card — NEW** | — | **240** | +240 |
| 12 | Closing subtitle card | 90 | **90** | 0 |
| 13 | End card | 172 | **172** | 0 |
| — | tail hold | — | **60** | +60 |
| | **total** | | **5,962** | |

**5,962 frames = 198.73s = 3:18.7.** Inside the 5,900–6,100 window with 62 frames of headroom
below and 138 above.

### The three numbers that are not the brief's

The brief's targets summed to **5,782**, which is 118 frames under the floor. Three beats argue
for more, and the argument in each case is the beat's own material rather than a need to make an
arithmetic work:

- **Beat 2 · 540 → 600 (18s → 20s).** At 18s the beat gains 3.6s across **ten landings** — under
  a second each, which is not a slower version of the beat, it is the same beat with a slightly
  longer breath at every stop. Beat 2 is the credibility spend and it is the first thing the
  narrator has enough screen time to actually explain. 20s puts about a second on each landing,
  which is where a settle becomes legible as a settle.
- **Beat 5 · 840 → 900 (28s → 30s).** The extra 60 goes to **5d, the compressed minute, and
  nowhere else.** The launch sheet establishes that the breathing pacer needs to be seen to
  *alternate*, that 15 frames a phase is the flicker floor, and that 25 frames is where it
  becomes followable. At 5d = 240 frames the beat gets **six phases at 40 frames each** — in,
  out, in, out, in, out — which is the first version of this beat where the minute reads as a
  minute of breathing rather than as a demonstration of a label changing. Everything else in
  beat 5 takes its share of the +418 the brief already granted.
- **Beat 10 · 600 → 660 (20s → 22s).** This pays a debt the launch sheet records twice and never
  settled. Turn 2 is 78 characters; the rule is *never speed the typing to fit, shorten the line
  instead*; the authored rate was already 25.4 c/s, declared "faster than a person types", and
  the Premiere cut took it to 35.6. At 660 frames the typing runs **156 frames — 15 c/s**, which
  is a person typing fast with a deadline in half an hour, which is what the line is *for*.

### One reconciliation note on beat 13

The brief specifies beat 13 at **5.7s** *and* that it keeps the end card's **2.60× Premiere
compression** and the **0.92s wordmark reveal**. Those are two different timelines: 5.7s is the
**authored** 172 frames (which contains the rejected 72-frame wipe), and the Premiere output is
**129 frames, 4.30s** (which contains the 0.92s wipe). The launch sheet's own beat headings were
never updated after the Premiere cut, which is where the 5.7s comes from.

**Both are honoured, and the difference goes into the hold.** Beat 13 runs **172 output frames**
at the Premiere cut's rates — the reveal at 2.60× (27.7 frames, 0.92s), the domain at 1.70×
(`.tech` in 7.1 frames), every authored event finished by its local f144 exactly as cut — and
the **static tail grows from 58 output frames to 101**. Nothing animates in those frames; it is
the same held picture of `serenify.tech`. That is the one place in beat 13 where time can be
added without touching a decision Mohamed has already made twice.

**And the 60-frame tail hold is genuinely severable.** It sits on the final frame for Mohamed to
trim in Premiere. Cutting all 60 gives **5,902 frames — still inside 5,900–6,100.** Cutting the
60 *and* shortening the end card's hold back to its shipped 58 gives 5,859, which is under; so
if both are wanted, the frames come back from beat 5's 5d, in that order.

---

## §5 · The four interstitial cards are removed, and three seams re-open

**Why they go.** Their entire justification was the sentence at the head of the launch sheet:
*"the VO is dropped, so on-screen text is the film's only narration."* The narration is back.
Four cards of visual narration in a film with an audible narrator is the same idea twice, and
the weaker copy of it — the cards can only say four short sentences and the narrator can say
whatever the beat needs.

**But the cards were also the transitions.** The launch sheet is explicit: *"And the card is the
transition. Where a card sits, it covers the change of composition. That is the point of putting
them at these four seams and not elsewhere."* Removing them re-exposes what they were covering.
The four lines themselves — *"First it learns what calm looks like. Then it stays quiet. Until
something changes. Then it helps you come back down."* — are one sentence across the film and
are **handed to the narration script as a structural hint, not as copy.** Do not put them on
screen.

**7 → 8 needs no treatment.** The launch sheet already records that this card was the odd one
out: beats 7 and 8 join on the *identical* shot (`COMPOSITE`) on the identical surface, so that
card interrupted a continuity rather than hiding a discontinuity. In this cut the position is
occupied by the false-alarm sequence, which is on the same surface and the same shot again. The
seam was never there.

The other three:

### 5.1 · Seam 4 → 5 (camera gate → calibration)

**What it was covering:** the composition changes completely — page-level consent copy at 616
world px, to `<AnchorIntro/>` at 920 — and the app performs a **full page reload**, because the
camera route's `Permissions-Policy` cannot be reached by a soft nav. The launch sheet flagged
that reload as an open greybox question and never answered it; the card made the question moot.

**What covers it now: the app's own causality, shown honestly.** He clicks **"Allow camera and
inference"** and the page reloads into the calibration intro. That is a click and its
consequence, which is this film's own grammar everywhere else, and the reload is a real thing
the product does rather than a smoothing. It joins on a **move, not a cut**, using the exact
device beat 3 → 4 already uses: beat 4's pull-back from the CTA begins before the boundary and
beat 5's arrival at `BEAT5_INTRO` finishes after it, handed over **at speed**, so the surface
changes on the fastest frame of the move rather than on its only stationary one.

**Narration debt: none.** This seam is causal and needs no line. If the narrator wants one here
it is free, not owed.

### 5.2 · Seam 5 → 6 (calibration → "later")

**This is the one that most needs an answer**, and the launch sheet says so in as many words:
the second card *"covers the only unexplained time jump in the film."* The toolbar clock reads
10:26 at the end of beat 5 and **10:43** at beat 6. Nothing on screen bridges seventeen minutes.
The launch sheet's beat 6 explicitly declines to spend anything on making the jump read — a
decision taken when the beat was 36 frames long and the card was doing the work.

**What covers it now: the narration, and only the narration.** This is the one seam in the film
where *"the narration covers it"* is the whole answer, and it is stated here so the narration
script knows it **owes a line at this seam.** Something in the shape of *"and then it goes
quiet — it watches while he works"* — the script's wording, not this sheet's, but that idea and
at that moment.

**What the picture contributes, and its limits.** Beat 6 doubles, 36 → 60 frames, which puts the
dashboard on screen for two seconds rather than 1.2 — long enough for the toolbar clock to be
*available* to anyone who looks, and long enough for a narrated line to land inside the beat
rather than across its boundary. It is **not** long enough to make the jump read on its own, and
**the clock gets no emphasis** — L11 forbids it: *"It is plain — no pulse, flash, tint or
animation beyond the time changing."* Emphasis would convert a discovery into an instruction,
and there is no colour available for it anyway. The picture makes the information reachable; the
narrator makes it land.

**And the causal chain across the seam is intact**, which is why a line is sufficient rather than
a patch: beat 5f ends on a click of **"Back to home"** and beat 6 opens on the dashboard that
click lands on. What jumps is time, not causality. The calibration banner's *absence* is beat 6's
visible content and it reads immediately.

### 5.3 · Seam 9 → 10 (questionnaire → Ren)

**What it was covering:** the app ceases to measure and begins to talk — a change of who is
acting, which the launch sheet names as the fourth card's job.

**What covers it now: the product genuinely performs this navigation, and the film shows it.**
This is the seam that turned out not to need anything invented. Read in the repo:

    apps/web/lib/questionnaire/confirmatory-trigger.ts:422
      onConfirm: () => void answerThenOpen("confirmed", "confirmatory_yes")

    apps/web/lib/questionnaire/confirmatory-trigger.ts:357-360
      await finalize({ type: "answered", outcome });
      depsRef.current.openRen(handoff);

    apps/web/components/monitor/monitoring-session.tsx:709
      openRen: (handoff) => deps.navigate(`/app/chat?handoff=${handoff}`)

**"Yes, that's me" navigates to `/app/chat?handoff=confirmatory_yes`.** The seam is a real,
shipped transition with a real cause: he answers, and the answer opens Ren. The card was covering
a discontinuity the product does not have. So beat 9 ends on the click and beat 10 opens on the
chat the click navigated to, joined by the same at-speed hand-over as 4 → 5.

**Narration debt: none owed, but there is a line available and it is the best one in the film.**
The chain *he was asked → he answered → it opened Ren* is the product thesis, and it is now
visible rather than asserted. The narration script should know the transition is causal so it
does not spend a line explaining a jump that is not one.

**One divergence recorded rather than fixed.** The shipped handoff seeds the **composer** with a
soft opener — `"I've been feeling tense for a while and could use a moment to talk it through."`
(`apps/web/lib/chat/confirmatory-handoff.ts:21-22`) — and does **not** have Ren speak first. The
launch sheet's beat 10 has Ren open the exchange. Restructuring beat 10 is out of scope for this
cut, so **beat 10 is unchanged** and this is logged in §10 as an unreconciled item for a later
pass, not silently corrected here.

---

## §6 · The false-alarm sequence · 7b–7e · 1,050 frames (35s)

Placed between beat 7 and beat 8, on the same surface and the same shot beat 7 lands on.

**The story:** he is concentrating hard on a difficult problem. He frowns at the screen. The
reading climbs. The confirmatory prompt fires. He answers that he is fine. It is dismissed and he
goes back to work at ease. Then beat 8 happens and it is real.

**The point:** the false alarm and the true positive are **identical up to the answer.** Same
amber, same climb, same prompt, same three options, same push-in. The only difference is which
button the cursor goes to. Beat 12's card is a claim in the launch cut and a demonstration in
this one because of these thirty-five seconds.

### 6.1 · Every surface reuses something already built

No new drawn assets. No new components. No new geometry. Named, per surface:

| Surface in 7b–7e | Existing thing it reuses |
|---|---|
| the monitoring page shell | `apps/web/components/monitor/monitoring-session.tsx` — `MonitoringSession`, as beats 7–9 already mount it |
| the ambient orb | `apps/web/components/monitor/bloom.tsx` — `Bloom`, driven by the frame-derived `--bloom` |
| the stateline (head + sub) | the inline `<p>` pair in `apps/web/components/monitor/op-surfaces.tsx` § `LiveStage`, copy from `use-monitoring-session.ts:189-216` |
| the session trend | `SessionTrend`, inside the stage card under the stateline, per L16/L17 |
| the viewfinder and the character | `apps/web/components/monitor/viewfinder.tsx` — `Viewfinder`, at L1's 320×181, with the rig inside it |
| the confirmatory prompt | `apps/web/components/questionnaire/confirmatory-prompt.tsx` — `ConfirmatoryPrompt`, through `components/notification.tsx` |
| the session readout | the stage card's own top band, per L14 |
| the shot | `COMPOSITE` (884.4) and `BEAT9_PROMPT` (600.9) from `video/src/app/framing.ts` — both existing |
| the pointer and its click ring | `video/src/app/pointer.tsx`, at 13 × 20 with the hotspot on the tip |
| the option hover | the prompt's own shipped `hover:bg-[color-mix(…foggy 8%…)]` over `transition-colors`, transcribed through `video/src/app/hover.tsx` |
| the beat component | a sibling of `video/src/greybox/beats/Beat07AtEase.tsx` and `Beat09Questionnaire.tsx`, reusing both |

**The one derivation this sequence adds, and it is arithmetic on an existing rect.**
`geometry.ts` § `PROMPT` currently exports `panel` and `yes` only. 7d needs the **"No, I'm
okay"** row. The options are a `flex flex-col gap-2` of 44px rows, so:

    PROMPT.no = rect(PROMPT.yes.x, PROMPT.yes.y + 52, 270, 44)

Same 25px inset off the panel, one row (44) plus one gap (8) below `yes`. That is a value derived
from measured numbers, not a new measurement, and it is the *only* geometry this sequence
touches.

### 6.2 · His frown is concentration, not distress

The rig has to distinguish them, and it can, because an expression is a vector rather than a
picture. **A new named point in the existing thirteen-number space — `focused` — and no new
drawing.** The separation runs on four axes, and the first is decisive:

- **Inner brow direction, and this is the whole difference.** The launch sheet's own facial
  coding rule: *inner ends raised is sadness and worry, inner ends pulled down is anger*, and
  **`tense` must never use lowered inner brows.** `focused` is the configuration `tense` is
  forbidden to use — brows drawn together with the **inner ends lowered**, which is effort. Every
  distress pose in this film (`dismayed`, `tense`) has raised inner ends by rule, so the two
  families cannot be confused at any interpolation, on any frame, by construction rather than by
  care.
- **The shoulders keep typing.** He never stops working in 7b–7e. In beat 8 he stops on the
  fall and does not start again until beat 11 — that stop is beat 8's, and spending it here would
  cost beat 8 its clearest physical marker.
- **Gaze stays down at the keyboard.** He is looking at work. Beat 8's fall takes the gaze off it.
- **No head sink, no shoulder slump.** Both are zero in `focused`. `tense` sinks the head and
  sinks the shoulders twice as far as `dismayed`.

And one thing that is not in the vector at all: **`focused` is a pose he is already holding when
7b opens.** Beat 8's `dismayed` is a *travel* — sixteen frames through the whole vector at once,
which is what makes it read as a fall. A held pose and a fall do not look alike even before the
brows are considered.

### 6.3 · Sub-beats

| | frames | seconds | shot | content |
|---|---|---|---|---|
| **7b** | 210 | 7.0 | `COMPOSITE`, static | he settles into `focused`. The reading is still at ease. |
| **7c** | 300 | 10.0 | `COMPOSITE`, static | the climb: bloom drifts, stateline steps twice, trend walks up |
| **7d** | 300 | 10.0 | push to `BEAT9_PROMPT`, land, hold | the prompt fires and is read whole; the cursor goes to **"No, I'm okay"** |
| **7e** | 240 | 8.0 | pull back to `COMPOSITE`, hold | the prompt is gone. He works. The reading comes down on its own. |

**7b · 210 frames.** Opens on the frame beat 7 ended on — same `COMPOSITE`, same static camera,
nothing cuts. He is at ease and typing. Over f0–f60 the rig travels from beat 7's contented pose
into `focused`: brows drawing together and their inner ends dropping, mouth width narrowing, gaze
locking down. **This is the only thing that moves in 7b**, and it is deliberately a slow travel
rather than a snap, because a face arriving at concentration over two seconds reads as somebody
getting stuck on a problem, and a face snapping into it reads as a reaction to something. Nothing
has happened to him. The reading is unchanged at `at_ease` throughout — that is the point of
7b's length: the audience registers that he looks strained *and* the app is still saying
**"You're at ease right now"**, so the climb in 7c is caused by his face rather than announced
before it.

**7c · 300 frames.** Identical to beat 8's third act in every respect except that there is no
toast and no fall. One `level` scalar (L18) drives the bloom, the stateline and the trend's
right-hand end.

- f0–f120 — the bloom drifts meadow → mixed → amber on the component's own 1.3s ease. Let it
  drift, never snap.
- f120 — stateline steps to **"You're a little tense"** · "A bit of an edge lately. Maybe a slow
  breath." The trend's drawn ten walk to `at ease ×5 + a little ×5` **on the same frame**, per
  L18.
- f200 — stateline steps to **"You're feeling tense"** · "This has held a while. Serenify can
  check in when you're ready." Trend to `at ease + a little ×4 + tense ×5`.
- f200–f300 — trend continues to `a little ×3 + tense ×7`. Amber holds.

**The copy, the bands and the thresholds are byte-identical to beat 8's.** What differs is the
*pacing* — 7c gives the climb 10 seconds where beat 8 gives it about 6.5 — and it differs because
in beat 8 the climb is intercut with a toast, a clock and a face falling, and here nothing else is
happening. That is the honest reason and it is also the useful one: the audience should feel the
difference between the two sequences without being able to name it, and the surfaces being
identical is what makes the feeling land on the *cause* rather than on the UI.

**7d · 300 frames.** The prompt fires. `ConfirmatoryPrompt` mounts at `PROMPT.panel`, in the
pinned right column, 32px below the viewfinder.

- f0–f36 — the camera pushes `COMPOSITE` → `BEAT9_PROMPT` (600.9 world px, option copy at
  10.5px on a phone).
- f36–f200 — **held, and read whole.** Title **"Checking in"**, body **"Your signals have looked
  tense for a little while. Is that how you're feeling?"**, and all three options:
  **"Yes, that's me"** / **"No, I'm okay"** / **"Maybe — talk about it"**. This is the audience's
  first sight of this surface and it gets 5.5 seconds of static camera on it. **No focus ring** —
  see the launch sheet's beat 9: `:focus-visible` cannot fire on a mouse click and the film must
  not draw a state the product never shows a mouse user.
- f200–f236 — the pointer travels to `PROMPT.no`. Its hover opens on the frame the pointer
  arrives (a control acknowledges a cursor that has *reached* it), and the click lands **four
  frames later** — this film's own idiom.
- f240 — the click. `onFalseAlarm` fires.
- f240–f300 — the prompt unmounts. See 6.4 for what does and does not happen next.

**7e · 240 frames.** The camera pulls back f0–f36 to `COMPOSITE` and does not move again.

- f0–f36 — the pull-back. He is already typing; he never stopped.
- f45 — **the earliest frame at which anything about the reading may change.** Not before. See
  6.4.
- f45–f180 — the bloom drifts amber → meadow on its own 1.3s ease; the `level` scalar walks down
  and the trend's tail walks with it; the stateline returns to **"You're at ease right now"** ·
  "Steady and settled — nothing to do." at f120, the same frame the trend crosses.
- f180–f240 — settled. Nothing moves but his breath and the typing. The film's picture at 7e's
  last frame is the same picture beat 8's first frame opens on, which is what lets beat 8 join
  it with no cut at all.

### 6.4 · The dismissal must not imply the model learns

**It does not learn, and the shipped component gives the film nothing to be tempted by.** Read
the handler:

    apps/web/lib/questionnaire/confirmatory-trigger.ts:424-427
      onFalseAlarm: () => {
        void finalize({ type: "answered", outcome: "false_alarm" });
        depsRef.current.armFalseAlarmNextSessionSuppression();
      },

`finalize()` sets `visible` false and persists the answer. **There is no toast, no banner, no
"thanks", no confirmation text, no state change on the monitoring surface at all.** The prompt
simply is not there any more. That is the real dismissal path, and it is exactly what the
constraint requires, so **the film adds nothing.**

Three prohibitions, stated because each is a thing somebody will want to add:

- **No acknowledgement of any kind.** No check, no fade-to-confirmed, no "got it". The
  temptation is real — a click with no visible response feels unfinished — and it is the wrong
  instinct here. What responds to the click is *the prompt disappearing*, and 7d's last 60 frames
  exist so that absence has room to register.
- **No copy, glyph, motion or colour anywhere on screen that could read as adaptation.** No
  "learning", no "updated", no threshold moving visibly, no trend re-drawing its history, no
  progress toward anything.
- **Nothing about the reading may be tied to the click frame.** This is the subtle one. If the
  bloom starts drifting back on the frame he clicks, the film has depicted the answer *moving the
  model*, which is precisely the thing the sequence must not say. **The earliest permitted band
  movement is 7e f45 — 45 frames after the click**, with the pull-back finished and him visibly
  back at the keyboard for a beat first. The on-screen cause of the descent is **him settling**,
  not him answering. (`armFalseAlarmNextSessionSuppression()` does affect a *later* session, and
  nothing on screen shows it. It is not depicted and must not be.)

### 6.5 · The internal clock still holds

7b–7e sit between beats 7 and 8. **The toolbar clock reads 11:30 across all of 7b–7e**, and the
session readout ticks continuously through it.

**AND THAT IS NOT FREE — INSERTING 35 STORY-SECONDS MOVES THE SESSION TIMER, AND THE FIRST BUILD
RAN IT BACKWARDS.** This section originally asserted the continuity rather than solving for it.
The readout is `sessionFrom + local frame ÷ 30`, and beats 8, 9 and 11 each carry their own
`sessionFrom` constant from the launch cut — so with 1,050 frames inserted in front of it, the
film ran **47:20** at the end of 7e and then **47:16** at the start of beat 8. A session timer
going backwards, in a cut whose entire second half is about a reading over time. It is the launch
sheet's `CLOCK` bug in a new place: one value with two sources.

The line is re-solved end to end, preserving the gaps rather than re-deriving them — each beat
picks up where the previous one's own `local ÷ 30` left it:

| | readout | frames |
|---|---|---|
| beat 7 | 47:12 → 47:20 | 240 |
| **7b–7e** | **47:20 → 47:55** | 1,050 |
| beat 8 | 47:55 → 48:06 | 330 |
| beat 9 | 48:06 → 48:14 | 240 |
| beat 10 | 48:14 → 48:36 | 660 — the chat draws no readout, and the launch cut already treats the session as continuing across it |
| beat 11 | 48:36 → … | 450 |

**And the toolbar clock survives it, which is the number that actually mattered.** 10:43 + 48:06
= 11:31:06, so beats 9 and 11 genuinely read **11:31** and say so. Beat 8 does not: it runs
11:30:55 → 11:31:06, and `BEAT8_CLOCK` — **the only shot in the film where the toolbar clock is
legible** — is up across output frames 30–106, which is 11:30:56 to 11:30:58. It reads **11:30**,
and the film's single piece of arithmetic (11:30, "by 12", *thirty minutes*) is untouched.
`COMPOSITE` and `BEAT9_OPTIONS` both frame from world y 156, the app header's own bottom, and the
drawn clock sits at y 58 — so beats 9 and 11 never have it in shot either way, and their 11:31 is
correctness rather than something the audience reads.

The three values are supplied through `PitchContext`, whose default is each beat's own launch-cut
constant, so **the launch cut's readout does not move by a frame.** This is L3 (time is
compressed throughout) applied once more, not a new liberty — but the arithmetic is now done
rather than asserted.

### 6.6 · And beat 9 must not read as a repeat

Covered in §7 under beat 9. The short version: it is shorter, it opens already landed, and it is
framed on the choice rather than on the question.

---

## §7 · Beats — durations, and what fills them

**The instruction that matters most.** *Extending a beat is not changing `durationInFrames`.*
Beat 7 going 72 → 240 frames means five and a half seconds after its authored animation has
finished. Every beat below whose duration changes carries a note on what its timeline does after
its authored motion ends. **A beat with nothing to say about this is a beat that will render as a
freeze.**

Three devices are used repeatedly and are named once here rather than at every beat:

- **A slower ease** — the authored move keeps its keyframes' *shape* and stretches its duration.
  Safe wherever the move is a camera travel on `inOut(cubic)`, because Remotion re-renders the
  in-between positions rather than repeating frames.
- **A continued drift** — the camera keeps moving very slowly past its landing, 10–30 world px
  across the remaining hold. Reads as breath in the shot rather than as a second move.
- **A motivated hold** — the camera is genuinely still and something *on the page* is the thing
  being watched. Only legitimate where there is such a thing.

**Restructuring beats 1–6 and 8–13 beyond their durations is out of scope.** Every note below is
about time, not about content.

---

### 1 · Cold open · 180 → 300 (+120)

Unchanged in structure: the lifted omnibox, `serenify.tech` typed, the lift settling home as the
page paints, the push to the hero block, the click on "Get started".

**After the authored motion:** the +120 is spent as **a slower ease on the lift and the push, not
as a hold.** The lift's travel and the settle stretch across 100 frames rather than 60, and the
push to the hero block takes 80 rather than 44. Two reasons: the beat's job is *this is deployed*
and a slow arrival at a live URL says that better than a fast one plus dead air; and it is the
narrator's opening, which needs an unhurried picture under it. **The 20 frames that are not in
the moves go to the hero landing**, which holds 40 frames rather than 20 before the click — the
headline reads at 46.5px on a phone and a panel will actually read it.

### 2 · Signup · 432 → 600 (+168)

Structure unchanged: 2a field group, 2b–2c pan to consent and submit, 2d the "Check your email"
transition, 2e the performed mail sequence, 2f the OTP choreography.

**After the authored motion:** the +168 is distributed across **the ten landings' settles**, and
explicitly **not** as one long hold anywhere. The launch cut's −1.2s pass took eleven holds out
of 2e on the grounds that each was outlasting its own read *in a feed*; a panel with a narrator
talking over it has the opposite problem, so most of those frames come back — the blank new tab,
the page load, the row after the click, the pull-out from the list, the page-scale hold, the
pull-back before the tab switch. **Three things do not move:** the URL typing (a performed
action at its own rate), the email card's own read (already sized to its content) and **the OTP
choreography, which stays at 2.94s real time.** It is the best piece of motion in the product and
slowing it would be the one change in this cut that makes something worse.

**The push onto the email in the inbox keeps its 16 frames.** The launch sheet measured it at
167.0 px/frame and wanted 21 for family with the rest of the film, and could not afford them.
**This cut can: it goes to 21.** Peak drops to ~127 px/frame, which is the body's own fastest
move, and the beat has the room in front of it.

### 3 · Dashboard, first arrival · 120 → 300 (+180)

Structure unchanged: the pull-out from the OTP row with the verify surface still rendering, the
navigation at the measured frame, the welcome banner, the calibration banner's travelling lift
(L10), the click on "Set baseline".

**After the authored motion:** this beat has the most obvious answer in the film and the launch
cut could not afford it. The launch sheet: *"The 20-word sentence was never going to be fully
read whatever the hold — the lift buys legibility, not reading time."* **In this cut it is read.**
The lifted calibration banner holds **120 frames — four seconds — at its 520px measure**, at its
real 14px, which is comfortably enough for *"Stress detection isn't active yet — it needs about a
minute of calibration to know what your calm looks like."* That is 120 of the 180. The remaining
60 go to the travel out of the lift and back to seated, which stretches from 24 frames to 50 (a
slower ease, same path), and to 34 frames of settled dashboard before the cursor sets off — where
the three real card empty states are on screen and legible for the first time.

### 4 · Camera consent gate · 120 → 270 (+150)

Structure unchanged: the seam arriving at speed from beat 3, the establish at 616, the continuous
page scroll, the CTA landing at 658, the click on "Allow camera and inference".

**After the authored motion:** the beat's real content is a long page visibly scrolling, and the
+150 goes to **the scroll itself, slowed, plus the two landings' settles.** The scroll runs
across **200** output frames instead of 90 — which is closer to how fast a person actually
scrolls a page they are reading. *(This section first said 150. The scroll and the establishing
hold are the **same authored frames** — the scroll is held under the establishing camera and
finished under the pull to the buttons — so they cannot be given different rates without a
keyframe edit inside the beat, which is out of scope. 200 is the consequence of giving the
establish its settle; the direction is right and the number is not the one predicted.)* **No new
landing is added and the deleted "Nothing is kept…" landing does not come back.** It was
removed because the claim is made better at 5a, and that reasoning is unaffected by having more
time. The narrator can say the ~230 words the picture cannot; the picture's job is to show that
there are ~230 words.

### 5 · Calibration · 422 → 900 (+478)

Structure unchanged: 5a intro and its in-place emphasis (L12) on the privacy line, 5b the green
room and the first sight of his face, 5c the countdown, 5d the compressed minute, 5e the
uploading line, 5f the success state and the click.

**After the authored motion**, sub-beat by sub-beat, because this beat's +478 is the largest
single allocation in the cut:

- **5a · +120.** The 590 landing holds 160 frames rather than 44. The privacy line **"Your video
  isn't stored — only the calm reading it produces."** takes the in-place emphasis exactly as
  built, at 1.25×, growing downward from its own top edge — **once, not twice.** L12's *no yo-yo*
  rule is absolute and a longer hold is not permission to fire it again. What fills the rest is a
  **motivated hold**: the three icon rows are on screen at 10.01px and there is something to read.
- **5b · +90.** The green-room hold grows from 52 frames to 142. This is the film's first sight of
  the protagonist's face and the launch sheet says *"give it a real hold"* — in the launch cut it
  got 1.7 seconds. It gets 4.7. What fills it: the gate clearing (brackets graphite → meadow, the
  glow blooming, the check appearing) is re-paced across the whole window rather than compressed
  into its first second, and his idle breath and blink run under it. Both are frame-derived.
- **5c · +30.** Three numbers at 25 frames each instead of 15. Half a second per number was the
  floor; five sixths is a count.
- **5d · +165 (75 → 240).** **Six breath phases at 40 frames each.** The pacer alternates
  in / out / in / out / in / out, and the sixth gets its full 40 frames before the flip, so no
  phase is clipped. The capture bar and the mm:ss readout take the new compression directly —
  the minute now runs at 7.5× rather than 24×, eased in and out, with the numeral still held four
  frames at a time. **The orb's amplitude, shape, easing and copy remain the component's; only
  the period is staged**, which is the same liberty the launch cut takes and no wider.
- **5e · +30.** The push-in across the flip keeps its shape and stretches 28 → 44 frames, still
  landing the flip six frames in (21% of the travel), and the uploading line's settled hold grows
  26 → 40 frames.
- **5f · +43.** The success state's read. Sixteen words at 16px got 48 frames in the launch cut;
  it gets 91 here, with the ripple's full overshoot in frame, before the click.

### 6 · "Later" · 36 → 60 (+24)

Structure unchanged: locked on the full 1200 frame, the banner's absence is the content, the
click on the real "Start check-in" CTA at (49, 399.6).

**After the authored motion:** the +24 is **entirely in front of the click**, not after it. The
launch cut's −24 pass removed 38 dead frames *after* the press, and those stay removed — the page
does not respond to that click and the camera does not move, so they were empty then and would be
empty now. What the beat gains is time for the absence to register and for the narrated line this
seam owes (§5.2) to land inside the beat. It holds 14 frames after the click, unchanged.

### 7 · Working, at ease · 72 → 240 (+168)

Structure unchanged: the push to `COMPOSITE`, and the four things it holds — the bloom, the
stateline, the trend and the viewfinder.

**After the authored motion:** the +168 is **a slower arrival plus a genuine hold**, and this
beat has the strongest claim to a hold in the film:

- f0–f60 — the push, slowed from 36 output frames to 60. A gentler settle onto a calm frame.
  *(This section first specified a separate continued drift past the landing. That needs a
  camera key the beat does not have, and adding one is a keyframe edit inside a beat, which is
  out of scope; slowing the existing push to 2s buys the same thing — a camera still visibly
  arriving — out of a rate change rather than a new key.)*
- f60–f240 — **static, and motivated.** What is being watched is not the camera. The stateline
  head reads at 17.18px, the trend's plot is a flat meadow line, his face is at 57.1px and he is
  typing, and the session readout's seconds are ticking. **This is the "before" the whole film's
  second half is measured against**, and the launch sheet's own note is that the audience needs it
  *registered*. Four seconds registers it; 2.4 asserts it.

**And the hold is a LIVE hold, not a slowed one — which is the general mechanism this cut needed
and did not have when §7 was written.** Slowing a hold slows everything ambient inside it: the
bloom's pulse, his breath, the typing, the blink, the `Session · MM:SS` seconds. A 6.5s bloom
loop at 0.25× is a 26-second bloom loop and the readout stops being a clock. So a beat's last
segment may map to source frames **beyond its authored duration**: the beat stays mounted, its
camera keys clamp at their last shot, its expression and level keys clamp at their last values,
and everything frame-derived keeps running at 1.000×. That is what a motivated hold *is* — the
camera has stopped and the picture has not. Beats 7 and 11 both use it, and both are the beats
this section gives a genuine hold to. See `video/src/pitch.tsx`.

**And it hands to 7b on the identical frame**, so the false-alarm sequence opens with nothing
having changed but him.

### 7b–7e · False alarm · 1,050 (NEW)

See §6.

### 8 · The email · 184 → 330 (+146)

Structure unchanged, and this is the beat to change least. Three landings inside one continuous
move: `BEAT8_CLOCK` (368) → `BEAT8_FACE` (649) → `BEAT8_WIDE`/`COMPOSITE` (884.4). The toast, the
fall, the drift, the two stateline steps, the trend's two crossings.

**After the authored motion:**

- **The fall does not change.** Sixteen frames of continuous travel through the whole pose
  vector, at the tight framing, with the toast up. It is the fifteen most important frames in the
  film and it is correct.
- **+38 to the clock landing.** The toast's hold at `BEAT8_CLOCK` goes 38 → 76 frames. This is
  the film's only piece of arithmetic — the clock at 32.1px, the subject at 16.05px, and the
  audience subtracting 11:30 from "by 12" unaided. It got 1.27s in a feed; it gets 2.5s from a
  panel, which is enough for the subtraction to actually happen.
- **+16 to the settle on the fall.** `dismayed` is a constant pose after f86 and the launch cut
  cut the hold to 16 frames for exactly the right reason. It goes to 32 — still less than the 48
  that was removed, because a held constant pose is the definition of dead dwell and the reason
  the film is slower is not that dead dwell is now acceptable.
- **+92 to the wide phase.** The escalation — the drift, then the head changes, then it changes
  again — runs on a static camera with nothing else moving, and the launch sheet flags this as
  *the one thing to watch in the whole pass*: whether "a little tense" → "tense" reads as easy to
  miss. The extra 92 frames put ~50 frames between the two copy changes instead of 22, which is
  the cheapest available answer to that risk. **The in-place emphasis still does not come back**
  — L15 removed it and the room it needs is the room the trend occupies.

**The trend's band crossings stay on the frames the copy steps on** (L18). If any frame above
moves, both move together, because they are one number.

### 9 · Confirmatory questionnaire · 76 → 240 (+164)

**This beat must not read as a repeat of 7d, and three things make sure of it.**

**1. It opens already landed.** 7d pushes from `COMPOSITE` to `BEAT9_PROMPT` over 36 frames; beat
9 does not push at all. Beat 8 ends wide, the prompt fires, and the camera is **already** at the
prompt when the beat opens — the transition into it is beat 8's own move finishing. The audience
has seen this surface arrive once; watching it arrive again is the repeat.

**2. It is framed on the choice, not on the question.** 7d frames `PROMPT.panel` whole — title,
body, three options — because the surface is new. Beat 9 frames **tighter, on the option group**,
via a new `PROMPT_OPTIONS` rect. The title is out of the shot entirely; the subject is which
button the cursor goes to. *(This is the one new framing derivation in the cut besides
`PROMPT.no`, and it is arithmetic over rects that already exist.)*

**AND ITS TOP EDGE IS PLACED RATHER THAN CENTRED, WHICH THE RENDER IS WHAT FOUND.** The first
build took `frameRect` over the three option rows alone, centred — and the frame's top edge
landed 29.5px above the first option, which is *inside the body copy*, so the shot opened on
"…little while. Is that how you're feeling?" **sliced through its letterforms.** "Partly out of
frame by design" is a description of the title and body being **absent**; it is not a licence to
cut a line of type in half, and the framing rule has no exception for that — full-bleed furniture
may run off the frame, and a sliced line of text is always a failure.

So `PROMPT_OPTIONS` runs from **14px above the first option** — inside the component's own
`gap-2`, so the edge falls in air and crosses no glyph — down to **the panel's own bottom
border**, which gives the shot a whole element boundary below rather than empty page. The top
edge being *placed* rather than derived is established grammar here: `COMPOSITE` and
`BEAT5_SUCCESS` both place theirs on the app header's bottom for the same class of reason.

What the shot holds, as built: the **last line of the question, whole**, and the three answers,
whole, inside the panel's own border. That is a better version of the intent than the one
specified — the audience gets the tail of what he was asked and the three things he can say —
and it is what "framed on the choice" was reaching for.

**3. It is shorter.** 240 frames against 7d's 300, and the difference is all read time: 7d holds
164 frames on the panel before the pointer sets off, beat 9 holds **90**.

**After the authored motion:** f0–f90 the hold, f90–f126 the pointer travels to `PROMPT.yes`, the
hover opens on arrival, the click lands four frames later at f130. **f130–f240 is not dead** — it
is the navigation. `onConfirm` fires, the page navigates to `/app/chat?handoff=confirmatory_yes`,
and the camera begins its hand-over into beat 10 at speed (§5.3). The launch cut's 24 dead frames
after the click were dead because there was nothing after them; here there is a real transition
and it is performed rather than cut to.

### 10 · Ren · 310 → 660 (+350)

Structure unchanged: four landings — the panel establish (889), his face and his opener (433.5),
turn 2's static hold (760), turn 3 (665). Two avatar states, `thinking` and `warm`, the eyes
closing on turn 3. The typing indicator as a travelling wave (L9).

**After the authored motion**, and this beat's +350 is mostly a debt being paid rather than air
being added:

- **Turn 2's typing: 92 → 156 frames.** 78 characters at **15 c/s**. The launch sheet's rule is
  *never speed the typing to fit, shorten the line instead*; the copy is fixed and Mohamed's, so
  the only remaining lever is the beat's length, and this cut has it. 25.4 c/s was already
  declared faster than a person types and the Premiere cut took it to 35.6 — this is the first
  version where it reads as somebody typing.
- **Turn 1's read: 36 → 60 frames.** Seven words at 14.37px. The launch cut restored it to 1.70s
  in the time map; here it gets 2.0s in the beat itself, with no retime involved.
- **Turn 3's protected hold: 60 → 170 frames.** Turn 3 is the beat that sells the product and the
  launch sheet says to protect it at all costs. It reads at 9.52px — under the phone floor, which
  is a property of the conversation's own layout and not fixable by framing — and on a laptop or
  a projector, which is what a judging panel uses, it is comfortable. **Time is the only lever
  this cut has on it and it takes it.** *(This section first said 110. The itemised increases
  above account for +202 of this beat's +350, and the balance had to land somewhere; it goes here
  rather than into padding a camera move, and it is stated rather than absorbed. 170 frames is
  5.7s on 114 characters — long for a silent read, and the narrator is talking over it.)*
- **The two typing indicators: 38 and 36 → 50 and 48.** An indicator is looked at, not read, and
  the launch cut's cut to 38/36 was right on its own terms. +12 each is enough to see the wave
  travel twice without turning it into the subject.
- **The face landing's hold: +40.** Ren at 42px, composing, before turn 1 lands.

**No retime.** Beat 10 in the launch cut runs at 1.40× with a 0.706× island cut into it for turn
1. **The pitch cut authors these durations directly and runs the beat at 1.00×.** That is the
whole point of re-authoring rather than re-cutting: the two sets of numbers stop existing.

### 11 · Return to ease · 234 → 450 (+216)

Structure unchanged: the player established over the composition, the punch onto it at 640, the
play click, headphones, notes, the nod, the pull-out, the closing composite at 884.

**After the authored motion:**

- **+40 to the player's landing.** Billie Jean and Michael Jackson are on screen and legible; the
  launch cut gave them 18 frames because the track name reads fast. It is the evidence Ren knew
  him, and a panel should get to read it without inference.
- **+40 to the relief, before the pull-out.** The expression finishes travelling into `easing`
  and holds 66 frames at the tight headphones framing rather than 26 — his head is ~120px on a
  phone there and this is the only moment in the film the relief is legible on his face.
- **+136 to the closing composite.** It holds **272 frames** rather than 136 — and the split
  matters more here than anywhere. **The descent runs at 1.000×**: the bloom drifting amber →
  meadow on its 1.3s ease, the stateline returning, **the trend's tail walking back down**, the
  notes drifting, the nod, him typing throughout. Slowing it instead would have halved the speed
  of the nod and the notes, which are the two things in the frame that have to look like a person
  enjoying a song. The extra 136 frames are then **a live hold past the beat's authored end** —
  camera clamped, level clamped, everything ambient still at real speed — which is **the
  linger**, and the launch sheet's own argument for it is that beat 12 lands better arriving out
  of a settled frame than out of a settling one. **The 31 frames Mohamed deleted from beat 11's
  tail in Premiere are not restored as a tail**; the linger here is in front of the roadmap card
  and is measured against a 199s film.

**The recovery still skips `a little tense` because the stateline does** — the reading crosses
both thresholds inside one frame, so the graph is never in a band the copy is not showing.

### R · Roadmap card · 240 (NEW)

See §8.

### 12 · The closing subtitle card · 90 → 90 (0)

**Unchanged, to the frame.** The line is **"A detection is a question, not a verdict."**, verbatim
from `lib/landing/copy.ts` § `NEVER_CARD_DECIDE_BODY`, framed at 760, not typed on, in Outfit at
34px world.

The launch cut ran this at 89 output frames because its last three caught the end card's 2.60×
segment. There is no retime here, so it runs its authored **90**.

**Two things this cut changes about the card without changing the card.** First, it is now the
film's *only* subtitle card — the four interstitials are gone — so it is a device used once,
which is what it was designed to be. Second, its first constraint is retired: *"The video shows
only the true-positive path… Nothing that turns on the false alarm."* **This cut shows both
paths**, so the line is now demonstrated rather than asserted (§3). The line does not change —
it was chosen to satisfy the *stricter* constraint and satisfies the looser one trivially.

**"Nothing moved until he answered." is still rejected**, and for the same reason: a great deal
visibly moves before he answers, twice over now. Do not reconsider it.

### 13 · End card · 172 → 172 (0)

**Unchanged in structure and in every authored event.** The wordmark reveal, "take care of
yourself" appearing in Nunito, `serenify.tech` deriving from the wordmark with only `.tech`
typing in.

**It runs at the Premiere cut's rates**, which are Mohamed's and are approved: 2.60× across the
reveal (**27.7 frames, 0.92s** — do not restore the 72-frame wipe), 1.70× through the domain
(`.tech` in 7.1 frames), every authored event finished by local f144. **The static tail holds 101
output frames** rather than 58, which is where the difference between the 129-frame Premiere
output and the 172 this cut specifies goes. See §4.

### tail hold · 60 (NEW)

Sixty frames of the end card's **final frame**, held, for Mohamed to trim in Premiere. Nothing
animates. If all 60 go, the film is 5,902 frames and still inside the window.

---

## §8 · The roadmap card · 240 frames (8s)

Between beat 11 and beat 12. **The most severable part of this cut — if it is dropped, drop it
cleanly**: remove the 240 frames entirely, the film becomes 5,722 (under the floor), and the
frames come back from beat 5's 5d and beat 10's turn-3 hold in that order. It has no dependency
in either direction; nothing else in the cut refers to it.

**What it says.** Three lines, stating what is next: audio, physiological signals, and their
fusion.

**Composition — a list, not a centred sentence.** This is the binding constraint. Beat 12's card
is the film's one claim and it is a centred sentence; a second centred sentence eight seconds
before it competes with it and turns the closing card into the second of a pair. So: **flush
left, three rows, a two-column grid** — a short tense marker in one column and the item in the
other.

    Next    Voice — strain in how something is said
    Then    Physiology — heart rate, breathing, skin conductance
    Then    Face, voice and body read as one signal

**Two changes from the first draft of these rows, both decided and both shipped.** Row 2 gained
**breathing**: the training data carries ECG, EDA *and* RESP, and a panel that knows the dataset
would read the omission. Its label then shortened, `Physiological signals` → **`Physiology`**,
because the longer row overflowed the 760 framing — measured on a still, not guessed, and taken
as step (1) of the fallback order, so the list after the em-dash is untouched and the type never
shrank. Row 3 stopped saying **"all three"**: once row 2 named three *signals*, the count was
ambiguous, so the row names the modalities instead — and names **the face**, the one that is
already shipped and that the card otherwise never mentioned.

**Tokens and type, reused not re-designed.** Same ground (`CARD.field`, #0b0c0e), same ink, same
face (Outfit), same weight (500), same tracking (−0.01em), same **760** framing as beat 12 and
the end card. **Size 27px world = 14.99px phone-equivalent** — the size the four interstitials
used, which is clear of the 14px floor and visibly under beat 12's 34px/18.88px. The `Next` /
`Then` column is the same size at `CARD.muted`. Entry and exit are the interstitials' own gesture
— **a fade with eight pixels of rise**, in over 12 frames, settled 216, out over 12. Not the
typewriter (reserved for domains), not the end card's wipe.

**Unmistakably future tense, and this is a hard requirement rather than a preference.** The
`Next` / `Then` / `Then` column carries it structurally, so no row can be read as a shipped
capability even out of context. **Three phrasings are banned outright:** any present-tense verb
with Serenify as its subject ("Serenify listens…"), any progressive ("we're building…", which
reads as in-flight and invites a "when"), and any claim of accuracy or improvement from the
fusion. The rows name *signals*, not outcomes.

**This copy is AUTHORED, and that is declared here rather than blurred.** Every other word in the
film is verbatim from `apps/web` or from `lib/landing/copy.ts`. There is no app copy about a
roadmap, because a roadmap is not a product surface. This card is the film's **second** authored
element, after the one authored hover treatment on the chat send button — and, like that one, it
is declared where it lives. **It must not be mistaken for app copy in a later pass and it must
not be back-ported into `apps/web`.**

**Colour.** Near-black ground, off-white type, and nothing else is available: meadow, amber and
crimson all carry band meaning, foggy is Ren's structural colour, and there is no red anywhere in
this film.

---

## §9 · What the narration script owes

Collected so the script is written against a list rather than against this whole document.

| Where | Owed? | What |
|---|---|---|
| beat 1 | free | the opening. The picture says *deployed*; the narrator says what it is |
| beat 4 → 5 seam | **no** | causal — a click and a page reload. A line is available, not owed |
| **beat 5 → 6 seam** | **YES — owed** | the only unexplained time jump in the film, and the card that covered it is gone. §5.2 |
| beat 6 | **YES — owed** | same line; it lands *inside* beat 6's 60 frames rather than across the boundary |
| beat 7 → 7b | free | nothing changes but his face. A line here helps and is not required |
| 7d → 7e | **no** | and a line here is **dangerous** — anything said over the dismissal that implies the system adjusted breaks §6.4 as surely as a graphic would |
| beat 9 → 10 seam | **no** | causal — the answer navigates to Ren. The script should know this so it does not explain a jump that is not one |
| beat 12 | **no line at all** | the card is the film's one claim and it is read, not narrated over |
| beat 13 + tail | free | the film ends on a held domain |

**And the four interstitial lines are handed over as structure, not as copy:** *"First it learns
what calm looks like. Then it stays quiet. Until something changes. Then it helps you come back
down."* They are one sentence across the film and they mark the four places the film's argument
turns. The script may use that shape. It must not put those words on screen.

---

## §10 · The render

**Wall clock: 8m06s for 5,962 frames**, at the launch cut's own settings and default concurrency
— about 12 frames a second. The launch cut's 2,501 frames scale to roughly 3m24s on the same
machine, so the cost is linear in length and there is no cliff at this duration. Budget two full
renders per verification pass, because the acceptance test below needs two.

### The frame race reappears, and it is worse at this length

The launch sheet's race — `remotion_setFrame` allows **one** `requestAnimationFrame` between
committing a frame number and declaring the page ready, which is not always enough for the
compositor to have produced a new surface, so the screenshot catches the tab's *previous* output —
is present in this cut and at a much higher rate.

**Measured the only way it can be: two full renders of the same commit, diffed frame by frame.**
The composition is a pure function of frame, so any disagreement is a race by definition.

| | |
|---|---|
| frames rendered | 5,962 |
| median cross-render MSE | **0.00** — most of the film is bit-identical between runs |
| frames disagreeing beyond the noise floor | **51 (0.86%)** |
| the launch cut's post-`<Settle/>` rate | ~1 in 2,572 |

**And the worst of them are not sub-pixel.** At output f517 the two renders show beat 2's signup
page at **different scroll positions** — one about fourteen frames behind the other, with
"Already have an account? Sign in" below the fold in one render and on screen in the other. That
is the same class and size of artifact the launch sheet reported as *"the landing page's left
side jumps down and back up"*.

All 51 sit in beats 1 and 2. That is very likely a detection floor rather than a distribution:
those beats are bright type at high magnification over a moving camera, where a one-frame slip
produces a large delta, and the rest of the film is near-black and mostly static, where the same
slip produces almost none.

### And the fix is NOT more settle — it is fewer tabs

`settle.tsx`'s own acceptance test says to raise its rAF budget when a diffed pair disagrees.
**Raising it from 6 to 20 made the rate exactly twice as bad** — 101 disagreeing frames in the
same 900-frame region, against 51. The inversion is the finding: more rAFs means more **wall
clock** per frame, and Remotion keeps *one live page* across the whole render, so anything in the
page still driven by real elapsed time drifts further the longer each frame is held. Settling
harder feeds the bug it was meant to starve. This is the launch sheet's *"no frame-addressed
render ever fires a timeout is false"* finding, surfacing in a site `<StillMotion/>` does not
cover.

Three measurements pin it, and the first is what makes the other two readable:

- **The composition is deterministic.** Two `remotion still` renders of output frame 517 are
  identical to **MSE 0.00**. A still renders one frame in a fresh page, so no wall-clock state
  accumulates — which is also why **a still is the ground truth** the other two are measured
  against. The bug is in the render path, not in anything this cut authored.
- **A video-render frame can be flatly wrong, not merely late.** At output f494 one render sits
  **4.30** from its still — h264 noise against a lossless PNG — and the other **12,790.99**.
- **`--concurrency=2` clears it.** Six frames that had been wrong come back at **3.4–16.8** MSE
  from their stills: encoding noise, brighter frames scoring higher, no outlier.

**So the settle budget stays at 6 for both cuts, and the pitch cut renders at `--concurrency=2`.**
It costs about 2× per frame and it is the difference between a correct film and one with a page
visibly jumping in beat 2. The `ticks` prop stays because it costs nothing and the next person to
hit this should find the measurement rather than the guess — but **do not raise it to fix a race.**

---

## §11 · What could not be reconciled

Recorded rather than silently resolved.

1. **Beat 13's "5.7s" is the authored duration, not the shipped one.** The launch sheet's beat
   headings were never updated after the Premiere cut, so beat 13's heading says 5.7s (172
   authored frames, containing the rejected 72-frame wipe) while the shipped film runs it at 129
   output frames (4.30s, containing the approved 0.92s wipe). The brief asks for both. **Resolved
   by extending the static tail** — §4. Flagged because the same ambiguity is in the headings of
   all thirteen beats and the brief's whole "Shipped" column is in fact the authored column.

2. **The chat handoff does not have Ren speaking first.** The shipped
   `/app/chat?handoff=confirmatory_yes` seeds the **composer** with
   `"I've been feeling tense for a while and could use a moment to talk it through."`
   (`apps/web/lib/chat/confirmatory-handoff.ts:21-22`); the launch sheet's beat 10 opens with Ren
   saying *"Something shifted just now. What happened?"* into a thread the user has not spoken in.
   **Not changed here** — restructuring beat 10 is out of scope — but it is a fidelity divergence
   the launch sheet does not record, and it is now more visible than it was, because §5.3 makes
   the navigation itself part of the film. For a later pass.

3. **`geometry.ts` § `PROMPT` has no `no` rect.** Only `panel` and `yes` existed, because the
   launch cut only ever clicked one option. **BUILT** — `PROMPT.no` and `PROMPT.maybe`, derived
   from `PROMPT.yes` by the component's own 44px row height and 8px `gap-2`. No probe.

4. **Beat 9's tighter framing is a new derived shot.** **BUILT** — `PROMPT_OPTIONS` and
   `BEAT9_OPTIONS`, with a **placed** top edge rather than a centred one; see §7 · beat 9 for
   what the render found and why.

5. **`focused` is a new expression vector.** **BUILT** — thirteen numbers, no new drawing, in the
   rig's existing space, coded per §6.2. It is not a liberty and not an asset; it is a point.
   Noted so nobody looks for it in the launch sheet's expression table.

6. **§4's baseline arithmetic was wrong and is corrected.** It quoted beats 1–11 at 2,129 against
   §7's own 2,186, and derived the baseline from the shipped 2,501 by subtracting the cards and
   the Premiere deltas and then adding beats 12 and 13 back — double-counting them. Both of those
   subtractions were of things that were never in the baseline: the cards are output-timeline
   material and the Premiere cut is a time map *over* the authored timeline. Fixed in §4; the
   per-beat target table was correct and is unchanged.

7. **The session readout had to be re-solved, and §6.5 originally asserted it instead.** Inserting
   1,050 frames in front of beat 8 ran the session timer *backwards*. Corrected in §6.5, with the
   three values supplied through `PitchContext` so the launch cut's readout does not move.

8. **Two things inside beats are not durations, and needed a seam.** Beat 5's pacer phase count
   (3 → 6) and beat 9's framing. Both are reached through `PitchContext`, whose defaults are the
   launch cut's behaviour — see `video/src/pitch-context.tsx` for why a context rather than a
   prop or a forked beat file. Everything else this cut changes is a duration and lives in
   `video/src/pitch.tsx`'s per-beat time map, outside the beats entirely.

9. **The pitch cut is a SEPARATE composition.** `Pitch` in `video/src/Root.tsx`, built on
   `video/src/pitch.tsx`. `GreyboxVideo.tsx`, its BEATS table, its four interstitial cards and
   `retime.tsx`'s Premiere segment table are untouched and still render the launch film. The two
   cuts share the beat components, which is the point — a beat copied is a beat that drifts.

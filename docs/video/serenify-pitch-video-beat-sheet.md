# Serenify — Egypt IoT Challenge pitch cut · beat sheet v1

**Format:** 16:9, 1920×1080, 30fps. **5,584 frames — 186.1s, 3:06.1.** (The first render was
5,962; §4 has the silent-watch trim that took 378 frames out of it.)

**Submission context:** a file uploaded to a judging panel, watched **with sound on**, once,
by people whose job is to evaluate it. Not a scrolling feed. Every constraint in this sheet
that differs from the launch cut descends from those three facts.

**This is a sibling of `docs/video/serenify-launch-video-beat-sheet.md`, not a revision of it.**
That sheet is a point-in-time record of a shipped film and is not edited. It remains the
authority on everything this sheet does not restate: the framing geometry and its derivations,
the character rig's construction, the assets pass, the five bad rects, the frame-drop
investigation, the Premiere round trip and the deferred register. **None of that is reproduced
here.** Where this sheet needs a number from it, it cites it.

> **Label note (2026-08-13).** The display bands were renamed after this video was submitted:
> "At ease" → "Calm" and "A little tense" → "Uneasy" ("Tense" unchanged). The submitted render
> (`video/out/serenify-pitch-2026-08-05.mp4`) carries the old labels on every monitoring surface —
> beats 7, 7b–7e, 8, and 11 — and is not being re-rendered or re-timed. This sheet now uses the
> new vocabulary; beat 8's step timing was hand-tuned to the length of the old "a little tense"
> stateline and is deliberately untouched.
>
> **Stateline note (2026-08-14).** The stateline heads then moved to observational wording:
> "Looking calm" / "Looking uneasy" / "Looking tense" (subs unchanged). The submitted render
> still carries the statelines it was rendered with — "You're at ease right now" /
> "You're a little tense" / "You're feeling tense" — on beats 7, 7b–7e, 8, and 11. Still no
> re-render, still no re-timing; this sheet quotes the new heads.

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
cut's problem was dead dwell, this cut's problem would be a narrator racing a picture. **And it has been cut once against
that, in silence** — see §4: mechanism came out, every read time stayed.

**3. It shows the false-alarm branch**, which the launch cut did not. New sequence 7b–7e, ~30s,
between beats 7 and 8. See §6.

**4. The four interstitial cards are removed.** They existed because the dropped VO left the
film with no narration. The narration is back. See §5.

**5. A roadmap timeline is added** between beats 11 and 12 — four nodes on a drawn spine, the
shipped one solid and the three ahead of it hollow. See §8.

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

**These are the numbers after the silent-watch trim, and they are what ships.** The first pitch
render came in at 5,962 and was watched **without narration** — which is not how it ships, and
most of the added time exists to hold room for a narrator, so in silence much of it correctly
felt slow. The pass that produced the column below is one distinction applied fourteen times,
and it is stated here because it governs every number in §7 too:

- **Mechanism is dead time.** Chrome assembling, a camera travelling, a cursor crossing a panel,
  a surface still on screen after it has been clicked. No narrator fills any of that. Cut hard.
- **State change is where explanation lives.** Calibration breathing, a reading climbing, Ren
  replying, the descent in beat 11. Those read slow in silence and land correctly with a voice
  over them. **Not one read time in the film moves** — beat 3's lifted banner, beat 5's minute,
  beat 8's clock, turn 1, the typing at 15 c/s, turn 3's protected hold, beat 11's descent are
  all exactly as §7 argues for them.

| # | Beat | Authored | First render | **Ships** | Δ vs authored | trim |
|---|---|---|---|---|---|---|
| 1 | Cold open | 180 | 300 | **210** | +30 | −90 |
| 2 | Signup | 432 | 600 | **600** | +168 | 0 |
| 3 | Dashboard, first arrival | 120 | 300 | **300** | +180 | 0 |
| 4 | Camera consent gate | 120 | 270 | **270** | +150 | 0 |
| 5 | Calibration | 422 | 900 | **900** | +478 | 0 |
| 6 | "Later" | 36 | 60 | **60** | +24 | 0 |
| 7 | Working, calm | 72 | 240 | **240** | +168 | 0 |
| **7b–7e** | **False alarm — NEW** | — | 1,050 | **906** | +906 | −144 |
| 8 | The email | 184 | 330 | **330** | +146 | 0 |
| 9 | Confirmatory questionnaire | 76 | 240 | **240** | +164 | 0 |
| 10 | Ren | 310 | 660 | **598** | +288 | −62 |
| 11 | Return to calm | 234 | 450 | **368** | +134 | −82 |
| **R** | **Roadmap timeline — NEW** | — | 240 | **240** | +240 | 0 |
| 12 | Closing subtitle card | 90 | 90 | **90** | 0 | 0 |
| 13 | End card | 172 | 172 | **172** | 0 | 0 |
| — | tail hold | — | 60 | **60** | +60 | 0 |
| | **total** | | 5,962 | **5,584** | | **−378** |

**5,584 frames = 186.13s = 3:06.1.**

**The 5,900–6,100 window is retired, not breached.** It was derived from the brief's own target
band before the film existed, and it is not a constraint a cut can be held to once the cut has
been watched: 378 frames of mechanism do not become necessary because a number says so. What
replaced it is the rule above — remove what is dead and stop — and the film stopping at 3:06
rather than being trimmed toward any figure. There was no runtime target for this pass.

Beat 9's total does not move but its **segmentation** does: it now spends 14 output frames on a
push (§7 · beat 9) and 82 rather than 96 on the read that follows.

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
- **Beat 10 · 600 → 660 (20s → 22s), and 598 after the trim.** The typing, turn 1 and turn 3 keep
  every frame this argues for; the 62 that came back out are four camera and cursor legs (§7 ·
  beat 10). This pays a debt the launch sheet records twice and never
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
trim in Premiere. Cutting all 60 gives **5,524 frames, 3:04.1**, and nothing else moves.

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

## §6 · The false-alarm sequence · 7b–7e · 906 frames (30.2s)

Placed between beat 7 and beat 8, on the same surface and the same shot beat 7 lands on.

**The story:** he is concentrating hard on a difficult problem. He frowns at the screen. The
reading climbs. The confirmatory prompt fires. He answers that he is fine. It is dismissed and he
goes back to work calm. Then beat 8 happens and it is real.

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
| **7b** | 210 | 7.0 | `COMPOSITE`, static | he settles into `focused`. The reading is still calm. |
| **7c** | 300 | 10.0 | `COMPOSITE`, static | the climb: bloom drifts, stateline steps twice, trend walks up |
| **7d** | 201 | 6.7 | push to `BEAT9_PROMPT`, land, hold | the prompt fires and is read whole; the cursor goes to **"No, I'm okay"** |
| **7e** | 195 | 6.5 | pull back to `COMPOSITE`, hold | the prompt is gone. He works. The reading comes down on its own. |

**906, not 1,050, and all 144 come out of 7d and 7e's tail.** 7d's read hold goes 164 → 110; the
hold on the prompt's *absence* goes 60 → 15; and 7e gives back the 45 frames of settled tail it
would otherwise have gained for free once its descent moved earlier (6.4). 7b and 7c do not
change length at all — what changed inside 7c is *where* its two copy steps fall.

**7b · 210 frames.** Opens on the frame beat 7 ended on — same `COMPOSITE`, same static camera,
nothing cuts. He is calm and typing. Over f0–f60 the rig travels from beat 7's contented pose
into `focused`: brows drawing together and their inner ends dropping, mouth width narrowing, gaze
locking down. **This is the only thing that moves in 7b**, and it is deliberately a slow travel
rather than a snap, because a face arriving at concentration over two seconds reads as somebody
getting stuck on a problem, and a face snapping into it reads as a reaction to something. Nothing
has happened to him. The reading is unchanged at `at_ease` throughout — that is the point of
7b's length: the audience registers that he looks strained *and* the app is still saying
**"Looking calm"**, so the climb in 7c is caused by his face rather than announced
before it.

**7c · 300 frames.** Identical to beat 8's third act in every respect except that there is no
toast and no fall. One `level` scalar (L18) drives the bloom, the stateline and the trend's
right-hand end.

- f0–f39 — the bloom drifts meadow → mixed → amber on the component's own 1.3s ease. Let it
  drift, never snap.
- **f40** — stateline steps to **"Looking uneasy"** · "A bit of an edge lately. Maybe a
  slow breath." The trend's drawn ten walk to `calm ×5 + a little ×5` **on the same frame**,
  per L18.
- **f67** — stateline steps to **"Looking tense"** · "This has held a while. Serenify can
  check in when you're ready." Trend to `calm + a little ×4 + tense ×5`.
- f67–f300 — trend continues to `a little ×3 + tense ×7`. Amber holds.

**THE TWO STEPS WERE AT f120 AND f200 AND THE FIRST RENDER SHOWED WHY THAT IS A DEFECT.** The
bloom finishes drifting to amber at f39. With the copy not stepping until f120, **the film ran
81 frames — 2.7 seconds — of an amber orb under a stateline still reading "You're calm right
now"**, and 7e did the same in reverse (bloom from f45, copy at f120). That is not slow pacing,
it is the surface asserting two states at once, and it reads as a glitch because it is an
inconsistency.

L18 is what stops the *graph* disagreeing with the *words*; it says nothing about either
disagreeing with the **orb**, which runs on the component's own 1.3s CSS ease and is the largest
thing on screen. So the steps move inside that ease: f120 → **f40**, and the second moves forward
in proportion, 200 × 40/120 = **f67**. 7c's own 300 frames do not change. This came from the
sheet rather than from the build, which is why the correction is here and not only in the code.

**The copy, the bands and the thresholds are byte-identical to beat 8's.** What differs is the
*pacing* — 7c gives the climb 10 seconds where beat 8 gives it about 6.5 — and it differs because
in beat 8 the climb is intercut with a toast, a clock and a face falling, and here nothing else is
happening. That is the honest reason and it is also the useful one: the audience should feel the
difference between the two sequences without being able to name it, and the surfaces being
identical is what makes the feeling land on the *cause* rather than on the UI.

**7d · 201 frames.** The prompt fires. `ConfirmatoryPrompt` mounts at `PROMPT.panel`, in the
pinned right column, 32px below the viewfinder. It enters on the component's **own** slide — 24
world px over 0.2s (`notification.tsx:196-199`) — and that is a correction: the video's shared
`useToastIn` runs 0.42s over 28px, and at 2.1× the shipped duration the entrance read as a
defect. See 6.4a.

- f0–f36 — the camera pushes `COMPOSITE` → `BEAT9_PROMPT` (600.9 world px, option copy at
  10.5px on a phone).
- f36–f146 — **held, and read whole.** Title **"Checking in"**, body **"Your signals have looked
  tense for a little while. Is that how you're feeling?"**, and all three options:
  **"Yes, that's me"** / **"No, I'm okay"** / **"Maybe — talk about it"**. This is the audience's
  first sight of this surface. **110 frames, not 164** — it is not free, but 3.7 seconds is what
  it takes and 5.5 was more. **No focus ring** — see the launch sheet's beat 9: `:focus-visible`
  cannot fire on a mouse click and the film must not draw a state the product never shows a mouse
  user.
- f146–f182 — the pointer travels to `PROMPT.no`. Its hover opens on the frame the pointer
  arrives (a control acknowledges a cursor that has *reached* it), and the click lands **four
  frames later** — this film's own idiom.
- f186 — the click. `onFalseAlarm` fires.
- f186–f201 — the prompt **slides out** over the component's own 0.2s and is gone. Fifteen frames
  from the click to the pull-back, not sixty. See 6.4.

**7e · 195 frames.** The camera pulls back f0–f36 to `COMPOSITE` and does not move again.

- f0–f36 — the pull-back. He is already typing; he never stopped. **The cursor leaves with it**,
  on the frame the camera starts, rather than on a timer of its own 36 frames earlier.
- f45 — **the earliest frame at which anything about the reading may change.** Not before. See
  6.4. The floor is expressed in 7e's own frames and always was; 7e begins earlier now, so its
  absolute frame moves and the rule does not.
- f45–f135 — the bloom drifts amber → meadow on its own 1.3s ease; the `level` scalar walks down
  and the trend's tail walks with it; the stateline returns to **"Looking calm"** ·
  "Steady and settled — nothing to do." at **f75**, the same frame the trend crosses, and inside
  the bloom's drift for the reason 7c's steps moved.
- f135–f195 — settled. Nothing moves but his breath and the typing. The film's picture at 7e's
  last frame is the same picture beat 8's first frame opens on, which is what lets beat 8 join
  it with no cut at all. **Sixty frames, as originally specified** — moving the return earlier
  would otherwise have handed this tail 45 free frames, which is the trim pass undoing itself.

### 6.4 · The dismissal must not imply the model learns

**It does not learn, and the shipped component gives the film nothing to be tempted by.** Read
the handler:

    apps/web/lib/questionnaire/confirmatory-trigger.ts:424-427
      onFalseAlarm: () => {
        void finalize({ type: "answered", outcome: "false_alarm" });
        depsRef.current.armFalseAlarmNextSessionSuppression();
      },

`finalize()` sets `visible` false and persists the answer. **There is no toast, no banner, no
"thanks", no confirmation text, no state change on the monitoring surface at all** — searched
again on the second pass and confirmed: `monitoring-session.tsx` mounts no toast anywhere,
`armFalseAlarmNextSessionSuppression()` writes a `sessionStorage` key that nothing renders, and
`false_alarm` reaches no other surface in `apps/web`.

### But it is NOT a hard unmount, and that IS a shipped response

**This section stopped one call short of the answer.** `finalize()` flips `open`, and
`<Notification/>` wraps its content in an **`AnimatePresence`** whose desktop `exit` is
`{opacity: 0, x: 24}` on the component's own 0.2s (`notification.tsx:196-199`) — the exact mirror
of the entrance. The app's response to a dismissal is the prompt **sliding back out the way it
came in**. It is shipped, it is visible, and the film was depicting it as a cut.

So the film draws it, and doing so breaks none of the three prohibitions below. It is not an
acknowledgement of the **answer** — the identical exit plays for "Yes, that's me" and for a
session-end expiry — nothing in it could read as adaptation, and it touches no band, no threshold
and no trend. It is the prompt leaving. **This is the correct fix for the empty frames after the
click**, and it is why the absence hold could go to 15 rather than being padded back out.

### 6.4a · And the entrance was running at 2.1× the shipped duration

Reported as "the prompt glitches on mount", and it is worth recording what it was because it
looks like a rendering fault and is not one: two independent renders of the whole entrance are
**MSE 0.00**, so it is not the frame race §10 documents.

`notification.tsx:196-199` declares `x: 24` on `duration: 0.2`. The video's shared `useToastIn`
runs **0.42s over 28px** — one value with two sources, and the video's copy more than twice as
long. That matters here specifically because **a single alpha over a near-black ground does not
fade a dark panel and light type at the same apparent rate.** At opacity 0.17 the prompt's
`bg-surface` is invisible while `text-ink` is already a legible grey, so the title, the body and
the three option rows materialise **with no card, no border and no shadow under them** and the
panel appears afterwards, beneath type that is already there. At the shipped 0.2s that phase is
two or three frames and reads as an entrance; at 0.42s it is six or seven and reads as a defect.

The real prompt takes the real numbers. `useToastIn` is left alone: it drives beat 8's mail
toast, which is authored and has no component behind it, and beat 9, which is shared with the
launch cut and may not move.

### The three prohibitions

Stated because each is a thing somebody will want to add:

- **No acknowledgement of any kind.** No check, no fade-to-confirmed, no "got it". The
  temptation is real — a click with no visible response feels unfinished — and it is the wrong
  instinct here. What responds to the click is *the prompt going*, and 7d's last frames exist so
  that departure has room to register. **Fifteen frames, not sixty.** The 60 was over-specified:
  with six of them now carrying the shipped exit, the remaining nine are the beat of empty column
  the disappearance needs, and the pull-back begins from there rather than 45 frames later. Three
  things had been stacking — 60 frames of the prompt being gone, the cursor leaving 60 frames
  after the click, and only then a 36-frame pull-back — into about four seconds on empty space.
  The cursor now leaves *with* the pull-back.
- **No copy, glyph, motion or colour anywhere on screen that could read as adaptation.** No
  "learning", no "updated", no threshold moving visibly, no trend re-drawing its history, no
  progress toward anything.
- **Nothing about the reading may be tied to the click frame.** This is the subtle one. If the
  bloom starts drifting back on the frame he clicks, the film has depicted the answer *moving the
  model*, which is precisely the thing the sequence must not say. **The earliest permitted band
  movement is 7e f45 — 60 frames after the click**, with the pull-back finished and him visibly
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

**And it has to be re-solved a second time by the trim pass, for the same reason.** A cut that
gets shorter moves the line exactly as a cut that got longer did: 7b–7e lost 144 frames and beat
10 lost 62, so every readout downstream of them moves. The table below is the shipped one.

| | readout | frames |
|---|---|---|
| beat 7 | 47:12 → 47:20 | 240 |
| **7b–7e** | **47:20 → 47:50** | 906 |
| beat 8 | 47:50 → 48:01 | 330 |
| beat 9 | 48:01 → 48:09 | 240 |
| beat 10 | 48:09 → 48:29 | 598 — the chat draws no readout, and the launch cut already treats the session as continuing across it |
| beat 11 | 48:29 → … | 368 |

**And the toolbar clock survives it, which is the number that actually mattered.** 10:43 + 48:01
= 11:31:01, so beats 9 and 11 genuinely read **11:31** and say so. Beat 8 does not: it runs
11:30:50 → 11:31:01, and `BEAT8_CLOCK` — **the only shot in the film where the toolbar clock is
legible** — is up across output frames 30–106, which is 11:30:51 to 11:30:53. It reads **11:30**,
and the film's single piece of arithmetic (11:30, "by 12", *thirty minutes*) is untouched.
`COMPOSITE` and `BEAT9_OPTIONS` both frame from world y 156, the app header's own bottom, and the
drawn clock sits at y 58 — so beats 9 and 11 never have it in shot either way, and their 11:31 is
correctness rather than something the audience reads.

The three values are supplied through `PitchContext`, whose default is each beat's own launch-cut
constant, so **the launch cut's readout does not move by a frame.** This is L3 (time is
compressed throughout) applied once more, not a new liberty — but the arithmetic is now done
rather than asserted.

### 6.6 · And beat 9 must not read as a repeat

Covered in §7 under beat 9. The short version: it is shorter, it arrives in 14 frames rather than
36, and it is framed on the choice rather than on the question. (*"It opens already landed"* was
the first render's answer and is superseded — see §7 · beat 9 for why a hard punch-in reads as a
cut error rather than as a differentiation.)

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

### 1 · Cold open · 180 → 210 (+30, trimmed from 300)

Unchanged in structure: the lifted omnibox, `serenify.tech` typed, the lift settling home as the
page paints, the push to the hero block, the click on "Get started".

**After the authored motion:** the first render spent the +120 as **a slower ease on the lift and
the push**, on the grounds that a slow arrival at a live URL says *this is deployed* better than
a fast one and that the narrator's opening needs an unhurried picture under it.

**The first half of that is right and the second is not, and the silent watch is what separated
them.** A browser assembling itself and a camera travelling are the purest mechanism in the film:
nobody narrates them, and the picture they arrive at is what the narrator's opening needs, not
the arriving. So both moves go back to **roughly half** — the lift's travel and settle 100 → 50,
the push to the hero block 80 → 40, i.e. 0.44× → 0.88× and 0.43× → 0.85×, still slower than
authored but no longer a crawl.

**Both holds are untouched, and that is the whole point of halving the moves.** The lifted
omnibox keeps its 52 frames of `serenify.tech` being typed — a performed action at its own rate,
not mechanism — and the hero keeps its 68 (40 before the click, 28 through it). The headline
reads at 46.5px on a phone for exactly as long as it did.

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

### 7 · Working, calm · 72 → 240 (+168)

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

### 7b–7e · False alarm · 906 (NEW, trimmed from 1,050)

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
  *the one thing to watch in the whole pass*: whether "uneasy" → "tense" reads as easy to
  miss. The extra 92 frames put ~50 frames between the two copy changes instead of 22, which is
  the cheapest available answer to that risk. **The in-place emphasis still does not come back**
  — L15 removed it and the room it needs is the room the trend occupies.

**The trend's band crossings stay on the frames the copy steps on** (L18). If any frame above
moves, both move together, because they are one number.

### 9 · Confirmatory questionnaire · 76 → 240 (+164)

**This beat must not read as a repeat of 7d, and three things make sure of it.**

**1. It arrives in 14 frames rather than 36.** The first render had this open **already landed**
— no camera keys apart, straight into the tighter shot — on the reasoning that the audience has
seen this surface arrive once and watching it arrive again is the repeat.

**On screen that does not read as a differentiation. It reads as a cut error.** A hard punch-in
to a tighter framing is a mistake, not an edit, and nothing in the picture distinguishes the two.
So the beat gets a push, designed so that it cannot be confused with 7d's:

- **14 output frames against 7d's 36.** Fast enough that the two are not the same gesture at any
  speed of watching.
- **1.12× against 7d's 1.54×.** 7d travels `COMPOSITE` → `BEAT9_PROMPT`, 927 → 601 world px, on a
  surface that has just appeared. This is a settle onto a shot that is already essentially
  framed. **It does not re-establish**: the wider end is still inside the option group, so no
  frame of it shows the title or the body coming into view.
- **Its top edge is pinned and the extra 12% goes downward.** A shot centred on the same point
  and 12% larger moves that edge 12.5 world px *up*, into the body copy — which would open the
  beat on the very sliced line of type the note below exists to forbid. Pinning the top means the
  wider end shows no new type at all, only more of the page below the panel's own bottom border.
- It runs on **its own 1.000× segment** in the time map, so "14 frames" is fourteen frames of the
  film; inside the beat's opening read segment it would have played over 32.

**AND THE PROMPT IS ALREADY UP WHEN THE BEAT OPENS, WHICH IS WHAT "ALREADY LANDED" SHOULD HAVE
MEANT.** The tighter framing turned the component's f6 slide-in into **nineteen frames of empty
page**: the launch cut opens on `BEAT8_WIDE`, the whole composition, so a prompt sliding in at f6
arrives into a shot with a great deal else in it; the pitch cut opens framed on the option group,
where there is nothing else at all. The beat began on a near-black rectangle. So under the pitch
cut the prompt does not slide — beat 8's tail is 142 output frames of a static composite, the
prompt has had every opportunity to fire, and when the camera arrives it is up. **Playing its
entrance a second time is the actual repeat.** The launch cut keeps its own entrance to the
frame.

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

**3. It is shorter.** 240 frames against 7d's **201**, and the difference is still read time: 7d
holds 110 frames on the panel before the pointer sets off, beat 9 holds **96** (14 of push and
82 of hold). The margin narrowed when 7d's own read hold came down from 164 — which is fine,
because 1 and 2 are what carry this, and 7d earns its extra length by being the first sight of
the surface rather than by being long.

**After the authored motion:** f0–f14 the push, f14–f96 the hold, f96–f126 the pointer travels to
`PROMPT.yes`, the hover opens on arrival, the click lands four frames later at f130.
**f130–f240 is not dead** — it
is the navigation. `onConfirm` fires, the page navigates to `/app/chat?handoff=confirmatory_yes`,
and the camera begins its hand-over into beat 10 at speed (§5.3). The launch cut's 24 dead frames
after the click were dead because there was nothing after them; here there is a real transition
and it is performed rather than cut to.

### 10 · Ren · 310 → 598 (+288, trimmed from 660)

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

#### And the trim pass takes 62, none of it read time

**This beat is PARTLY DEFENDED and is not flattened.** It is the film's densest explanatory
stretch and the place a narrator has most to say, so every message's read time above stands
exactly as argued. What comes out is the four stretches in it that are neither reading nor
writing:

| | | |
|---|---|---|
| −20 | the opening | the panel's establishing hold and the move onto Ren's face, 106 → 86. Ren composing keeps his landing; the *camera getting there* stops taking 3.5s |
| −18 | the move to the working shot | plus the cursor crossing the panel to the composer, 70 → 52. Two mechanisms in one segment, neither of them looked at |
| −12 | the pointer's travel to send | 50 → 38. The hover on arrival and the click are inside the same segment and are unaffected — this is only the travel |
| −12 | the second typing indicator | 48 → 36, i.e. **back to the launch cut's own number.** The +12 above bought "enough to see the wave travel twice"; the launch sheet's cut to 36 was right on its own terms, and in silence the surplus reads as a wait |

**Untouched, and listed so the next pass does not reach for them:** turn 1's 60, the typing's 156
(15 c/s — *never sped to fit*), and turn 3's protected 170.

### 11 · Return to calm · 234 → 368 (+134, trimmed from 450)

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
  tail in Premiere are not restored as a tail**; the linger here is in front of the roadmap card.

**The recovery still skips `uneasy` because the stateline does** — the reading crosses
both thresholds inside one frame, so the graph is never in a band the copy is not showing.

#### The trim pass takes 82, from the move and from the tail

- **−28, the pull-out.** It is a camera move and it compresses like every other camera move in
  this pass: 78 → 50, i.e. 0.49× → 0.76×. **The shot it lands on is the payoff of the whole film
  and holds** — the descent below still runs its 136 frames at 1.000× — and the relief travelling
  into `easing` finishes inside the move exactly as it did.
- **−54, the linger.** 134 → 80. The film still **ends on a settle rather than on a cut**: 2.7
  seconds of a frame in which nothing moves but his breath, the nod and the drifting notes, which
  is the last thing the audience feels. It was the longest single hold in the film.

**The descent is not touched**, and that is the reason all 82 come out of the move and the tail.

#### And the music player's clock was changing speed twice

Reported as the timer and the scrubber glitching, and it is a different bug from the compositor
race `player.tsx` records and fixed — **that fix held**: two independent renders of the whole
window agree to MSE 0.00 on every frame but one.

The scrubber, its handle and the elapsed readout are one `progress` value, interpolated across
the beat's own f24–f70. That is right for every *animation* in a retimed beat and wrong for a
**clock**, because a position in a piece of music is a rate. The pitch cut runs f24–f42 at 0.90×,
f42–f60 at 0.31× and f60–f98 at 0.49×, so the track ran at **31× real time, then 10.7×, then
16.8×** — and the three-fold deceleration lands on f42, the exact frame the camera stops on the
window and the audience starts reading the numbers.

So the position is driven from the beat's own **output** frame at one constant, declared rate:
**10×**, which is the slowest rate at which the handle still visibly travels during the 18-frame
landing hold. At real time it would move about two pixels there and the window would read as
paused under a pause glyph, which is worse than a fast clock.

This is the launch sheet's `CLOCK` bug in its third form — one value with two sources, where the
second source is the time map itself — and the seam that fixes it (`retime.tsx` §
`BeatOutFrameContext`) is `null` in the launch cut, which never had the bug because it runs the
beat at one rate. **The session readout has the same shape and is deliberately not changed**: at
these rates it ticks once per 96 output frames rather than once per 30, which nobody counts, and
touching it would re-open §6.5's arithmetic for no visible gain.

### R · Roadmap timeline · 240 (NEW)

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
animates. If all 60 go, the film is 5,524 frames — 3:04.1 — and nothing else moves.

---

## §8 · The roadmap timeline · 240 frames (8s)

Between beat 11 and beat 12. **The most severable part of this cut — if it is dropped, drop it
cleanly**: remove the 240 frames entirely, the film becomes 5,344, and the frames come back from
beat 5's 5d and beat 10's turn-3 hold in that order. It has no dependency in either direction;
nothing else in the cut refers to it.

### The two-column text grid is rejected

The first version of this section specified three rows — `Next` / `Then` / `Then` — flush left in
a two-column grid, on the argument that a *list* rather than a centred sentence keeps it from
competing with beat 12's one claim. That argument is sound and the composition it produced is
not: **three rows of text is a slide**, and a slide eight seconds before the closing card is the
second of a pair whatever its alignment. It is deleted, not amended.

### A horizontal timeline. Four nodes. A drawn spine, left to right.

A timeline says *these are in an order and you are at the start of it* with its geometry, before
a word is read. That is the one thing this card exists to say, and it is the one thing three rows
of text could only assert.

### The state is carried by the drawing, not by colour

The obvious way to mark "shipped" against "coming" is colour, and **there is no colour
available**: meadow, amber and crimson all carry a band meaning in this product, foggy is Ren's
structural colour, and there is no red anywhere in this film. Spending any of them here would put
a reading on a card that is not about a reading. So the contrast is in the ink and the stroke,
and it is absolute rather than a shade:

- **Node 1 is solid, and its segment of the spine is solid.** It is shipped.
- **Nodes 2–4 are hollow, and their spine is broken** — a 6/10 dash at `CARD.muted`, 2px against
  the solid segment's 3px, at 0.5 opacity against 0.85.

A filled dot on a drawn line against three open rings on a dotted one needs no legend and no word.
That is the test this had to pass: **the card must not spend a line of copy explaining its own
notation.**

### The four nodes

    Now      Face — how strain shows in a face
    Next     Voice — strain in how something is said
    Then     Physiology — heart rate, breathing, skin conductance
    Then     Face, voice and body read as one signal

**Anchoring on the shipped modality is what makes the other three credible**, and it is the
reason node 1 exists. Three future nodes on their own are a wish list; three future nodes hanging
off a solid one the audience has just watched work for three minutes are a direction. `Face` is
also the modality the two-column version never mentioned at all.

**Row 4 must not depend on the reader counting anything.** An earlier draft said "all three",
which is ambiguous the moment row 3 names three signals of its own. It names the modalities.

**Row 3's label is `Physiology`, not `Physiological signals`** — measured, not guessed. At this
framing the longer label pushes the row to five wrapped lines and its block into the frame's
bottom edge. Taken as step (1) of the fallback order below: shorten the label before the em-dash
first, never shrink the type. The list after the dash is untouched.

### Unmistakably future tense, and this is a hard requirement

The `Now` / `Next` / `Then` / `Then` row carries it structurally, so no row can be read as a
shipped capability out of context — and node 1, the one that *is* a shipped capability, is the
one marked `Now`. **Three phrasings are banned outright:** any present-tense verb with Serenify
as its subject ("Serenify listens…"), any progressive ("we're building…", which reads as
in-flight and invites a "when"), and any claim of accuracy or improvement from the fusion. **The
rows name signals, not outcomes.**

### Tokens, type and framing — one decision, and it is arithmetic

Same ground (`CARD.field`, #0b0c0e), same ink, same face (Outfit), same weight (500), same
tracking (−0.01em) as beat 12 and the end card. **The 760 framing does not carry over**, and it
cannot: four columns is what forces the frame wider, and the frame is what sets the type size,
because the floor is a *phone-equivalent* number — `PHONE_PX(s, w) = s·422/w`.

| | |
|---|---|
| frame | **1040** world px, cx 600 · x 80–1120, y 63.5–648.5 |
| type | **35px world = 14.20px phone-equivalent** — over the 14px floor, and visibly under beat 12's 34px/18.88px |
| content | 4 columns × 235 + 3 gutters × 20 = 1000, x 100–1100, 20px clear each side |
| nodes | x 111, 366, 621, 876 · r 11 · spine y 290 |

The columns then have to be wide enough that no single word overflows one. 35px Outfit runs about
19px a character, so the longest unbroken word in the copy — `conductance`, 11 characters — needs
~212px against a 235px column. **That check is what decides whether a row keeps its wording**, and
it is the fallback order: (1) shorten the label before the em-dash, (2) shorten the list after it,
(3) never shrink the type.

The frame's vertical centre is placed on the **content's** — the tense markers' top edge at 200 to
the deepest column's last line at 512, so cy 356 — rather than on the world's. Centring on 379
left the block visibly top-weighted; placing a frame edge rather than deriving it is established
grammar here (`COMPOSITE`, `BEAT5_SUCCESS`, `BEAT9_OPTIONS`).

### The reveal is sequential, so the timeline is read in its own direction

A timeline that arrives whole is a diagram; one that draws itself left to right is a direction of
travel, and the direction is the content. Each node's spine segment **draws first** and the node
and its text land on the end of it, which is the order a line is actually drawn in.

| frame | |
|---|---|
| 0–12 | node 1 and its two lines. There is no segment before it |
| 24–42 | the solid segment draws; node 2 lands at 42 |
| 60–78 | the first broken segment draws; node 3 lands at 78 |
| 96–114 | the second broken segment draws; node 4 lands at 114 |
| 126–228 | settled. The whole timeline still, for 3.4s |
| 228–240 | out |

Entry and exit are the interstitials' own gesture — **a fade with eight pixels of rise**, 12
frames each way. Not the typewriter (reserved for domains), not the end card's wipe.

### This copy is AUTHORED, and that is declared here rather than blurred

Every other word in the film is verbatim from `apps/web` or from `lib/landing/copy.ts`. There is
no app copy about a roadmap, because a roadmap is not a product surface. This card is the film's
**second** authored element, after the one authored hover treatment on the chat send button — and,
like that one, it is declared where it lives. **It must not be mistaken for app copy in a later
pass and it must not be back-ported into `apps/web`.**

### And Hallmark is deliberately not invoked on it

`hallmark` is the routing rule for UI work in this repository and it is **wrong for this file**.
It is a web-page skill: it forbids re-drawn browser chrome, which beat 1 is built on, and its
token and theme systems fight this cut's locked film furniture. Running it here would fight the
edit. The card takes beat 12's and the end card's tokens unchanged, and the contrast is checked
by hand — `CARD.ink` on `CARD.field` ≈ 17:1, `CARD.muted` on `CARD.field` ≈ 8.9:1.

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
| frames rendered | 5,962 (the first render — the measurement predates the trim) |
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

### And at 5,584 frames the race is still there, so the cut is reconciled from three renders

`--concurrency=2` **reduces** the race; it does not close it. Three renders of the trimmed cut,
diffed pairwise frame by frame (`ffmpeg psnr`, per-frame `mse_avg`):

| | |
|---|---|
| median cross-render MSE | **0.00** — most of the film is bit-identical between runs |
| frames disagreeing beyond MSE 1.0, worst-of-three | **161 (2.88%)** |
| how many of those are structural rather than sub-pixel | **4** |

**Majority vote, then verified against stills**, which are the ground truth for the reason §10
already gives — a still renders one frame in a fresh page, so no wall-clock state accumulates:

| render | outlier frames | worst | verdict |
|---|---|---|---|
| r1 | 32 | 220.9 | wrong at f3103 (confirmed against the still: 334.7 vs 8.4) |
| **r2** | **49** | **22.2** | **correct on every structural frame. SHIPPED** |
| r3 | 80 | 2840.6 | wrong at f3499 and f3597 (2275.4 and 4278.0 against their stills) |

r2's own 49 outliers are all in the 1–22 band and cluster on **beat 11's punch-in and beat 1's
two compressed moves** — fast camera travel over bright type at high magnification, where a
sub-pixel slip produces a large delta and no visible artifact. The two catastrophic frames are
both in beat 8 and both belong to r3 alone.

**So: render three, diff them pairwise, take the majority, and confirm the disputed frames against
stills before shipping.** One render is not evidence of anything at this length.

**And the settle budget stays at 6 for both cuts, and the pitch cut renders at `--concurrency=2`.**
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

### From the first render, watched in silence

10. **§6.3 shipped a band/stateline desync and it came from this sheet, not from the build.** 7c's
    two copy steps were 81 frames after the bloom had finished drifting to amber and 7e's return
    was 75 frames after the descent began. **CORRECTED in §6.3** — the steps moved into the ease
    in both directions. L18 guarantees the graph and the words agree; nothing was guaranteeing
    either of them agreed with the **orb**, which is the largest thing on screen and runs on its
    own CSS transition. That gap is worth naming as a class, not just fixing as an instance.

11. **§6.4 read one call too shallow, and the app does respond to a dismissal.** `finalize()`
    flips `open`, and `<Notification/>`'s `AnimatePresence` plays a 0.2s slide-and-fade **exit**.
    **CORRECTED in §6.4** — it is shipped behaviour, it breaks none of the section's three
    prohibitions, and depicting it is what fixes the empty frames after the click properly rather
    than by trimming. Flagged as a method note: reading a handler is not the same as reading what
    the surface does when the handler's state change lands.

12. **`useToastIn` is not the `<Notification/>`'s numbers, despite its own comment saying so.**
    0.42s / 28px against the component's 0.2s / 24px. **CORRECTED for the real prompt only** —
    §6.4a — because the helper also drives beat 8's authored mail toast and beat 9, which is
    shared with the launch cut. The two remaining callers are a known divergence, recorded here
    rather than fixed, since changing them would change the launch film.

13. **A clock inside a retimed beat changes speed with the beat.** Beat 11's track position ran
    at 31× / 10.7× / 16.8× real time because it was authored in the beat's own frames. **BUILT** —
    `retime.tsx` § `BeatOutFrameContext`, `null` outside a cut that retimes beats. **The session
    readout has the same shape and is deliberately left alone** (§7 · beat 11): it ticks slowly
    rather than wrongly, nobody counts it, and touching it re-opens §6.5's arithmetic.

14. **Beat 9's "opens already landed" produced nineteen frames of empty page.** The prompt's own
    f6 entrance is invisible under a shot framed tight on it. **CORRECTED in §7 · beat 9** — under
    the pitch cut the prompt is up when the beat opens, and the beat arrives on a 14-frame push
    rather than on nothing. Both halves of that were a first render finding, not a preference.

15. **The 5,900–6,100 frame window is retired.** It predates the film existing and it cannot
    survive the film being watched: 378 frames of mechanism do not become necessary because a
    number says so. §4 records what replaced it. **No runtime target was set for the trim pass**,
    and the film stopping at 3:06.1 is where the dead time ran out rather than where a figure was.

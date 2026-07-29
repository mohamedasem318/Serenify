# Serenify — LinkedIn launch video · beat sheet v1

**Format:** 16:9, 1920×1080, ~60s. Silent-first — every beat must read with no audio. Egyptian Arabic VO is recorded last, over a locked cut.

**Pipeline:** real `apps/web` React components for every product screen. Drawn assets only for: the character, his facial expressions, the Gmail tab contents, the macOS notification, and the end card.

**Governing rule:** at 1920×1080 in a phone-sized feed, wide shots are illegible. **Every readable moment is a push-in.** Full-desktop wide shots exist only as brief establishing or transition frames.

**Continuity:** one browser window, one continuous "screen recording." Tabs switch; the frame never cuts away to a different device or context. One person throughout.

**The internal clock — every visible time must agree with this.** Signup ~10:20am. Calibration done ~10:40am. Monitoring session starts ~10:43am. The boss's email lands at **11:30am**, with the session timer reading **`47:12`**. That is why the welcome banner says "Good morning" and why the "later" card works. Any clock, timestamp or timer drawn anywhere in the video must sit on this line.

---

## Declared creative liberties

These are deliberate. Do not "fix" them toward fidelity.

| # | Liberty | Why |
|---|---|---|
| L1 | **Viewfinder is scaled up** from the app's 224×126px | At true size his face is a smudge on a phone. The emotional core of beat 8 requires a readable face. |
| L2 | **The deadline notification sits top-right**, adjacent to the viewfinder | Keeps notification and face in one push-in, so you watch his face fall *while the toast is up*. Correct for macOS anyway. |
| L2b | **The mail client and music player are generic, not Gmail and Spotify.** Billie Jean is named. | Mohamed's call. No audio, no lyrics, so naming the track carries effectively no risk, while drawn third-party UIs carry needless brand clutter. |
| L3 | **Time is compressed throughout.** The real flow is 10–15 minutes | 60s video. Non-negotiable. |
| L4 | **Session timer jumps to `47:12`** | Free storytelling — he's been heads-down a while. Communicates "this runs in the background all day." |
| L5 | **The OTP code path is shown, not the magic link** | The magic link is the primary path but it's one click that navigates away. The 6-digit code triggers the best animation in the product. *Mohamed — overrule this if you disagree; it's the one liberty I picked rather than asked about.* |
| L6 | **No `/onboarding` step** | `full_name` is captured at signup, so the bounce never fires in practice. Signup → `/app` directly. |

---

## Hard invariants

- **No red anywhere.** Attention = foggy. Stress = amber. Affirmative = meadow.
- **No numeric stress value, ever.** No percentage, no score, no gauge. The bloom carries no number.
- **The confirmatory questionnaire shows the TRUE-POSITIVE branch.** The landing hero shows the false alarm. This inversion is intentional.
- **Copy is verbatim** from the app. Typographic apostrophes (`’`) preserved. Where a beat is too short to read full copy, push in on a fragment — do not paraphrase.
- Several transitions in the real app are **full page reloads** (camera Permissions-Policy). Whether to show those honestly or smooth them is a greybox question, flagged below.

---

## Beats

### 1 · Cold open — `serenify.tech` · 0:00 – 0:04 (4s)

Browser window, real URL visible in the address bar. The landing page loads.

Hold the wide just long enough to register a real site at a real domain, then a slow push toward the hero. This beat's only job is *this is deployed*.

**Shot:** wide → slow push-in. **No text overlay.**

---

### 2 · Signup · 0:04 – 0:16 (12s)

The credibility spend. Mohamed chose this deliberately over a 4s montage.

| Sub-beat | Time | Content |
|---|---|---|
| 2a | 0:04–0:08 | Push-in on the 448px form column. Fields fill in sequence: `FULL NAME`, `EMAIL`, `PASSWORD`. As the password types, the live checklist lights meadow row by row — "At least 8 characters" → "Contains a letter" → "Contains a number" → collapses to **"Password looks good."** |
| 2b | 0:08–0:09 | The consent checkbox ticks. Push tight enough to read: **"I have read and agree to the Terms of Service and the Privacy Policy."** |
| 2c | 0:09–0:10 | **"Create account"** → **"Creating account…"** |
| 2d | 0:10–0:11 | The **"Check your email"** state. Register the heading; do not attempt the body copy. |
| 2e | 0:11–0:13 | **Tab switch to his mail.** Same window, new tab. The Serenify email lands in the inbox, unread, at the top. Push in and open it. Drawn asset — a generic mail client, not Gmail. |

**2e must show real email content, not a blurred placeholder.** The sender is Serenify, the subject and body are legible, and the 6-digit code is the thing the push-in lands on. **CC should pull the actual Supabase email-template copy from the repo** rather than inventing it — that template is real and shipped, and using it is free fidelity. Timestamp on the email: **10:21 AM** (see internal clock).

**⚠️ This beat has a job in beat 8.** The mail client needs one distinct, memorable visual signature — an app icon with a specific shape and colour, used consistently. Establish it clearly here. Beat 8's notification depends on the audience recognising that icon; see the note there.
| 2f | 0:13–0:16 | **Tab back to Serenify.** Six boxes fill. Then the verification choreography, at or near real speed. |

**2f is the hero moment of the whole signup section.** The real timings, from the recon:

- Halo sweep, box 1→6, 130ms each = **780ms**
- Hold **360ms**
- Merge — boxes slide edge-to-edge, borders melt, all six fill meadow, outer corners round to 28px, the row becomes one pill = **540ms**
- Check icon + the word **"Verified"** cross-fades in = **560ms**
- Pill holds fully opaque = **700ms**
- At 2080ms a muted line fades in below: **"Taking you in…"**

Total ~2.94s. **Play this close to real time.** It's the single most polished piece of motion in the product and compressing it wastes the best thing signup has.

**Shot:** locked-off tight on the OTP row for the full choreography. No camera move — let the animation carry it.

---

### 3 · Dashboard, first arrival · 0:16 – 0:20 (4s)

He lands on `/app`. Uncalibrated.

Brief wide to establish the shell — sticky header, wordmark, the 1152px column floating in wide gutters — then push in on the two things that matter:

- **Welcome banner:** "Good morning, [name]" · "A space to check in with yourself."
- **Calibration banner** (foggy-tinted): **"Stress detection isn’t active yet — it needs about a minute of calibration to know what your calm looks like."** with **"Set baseline"**

Note for greybox: the calibration banner really does *pop in* post-hydration with no transition. That may read as a glitch on video. If it does, fade it in.

**Ends on:** the click on **"Set baseline"**.

---

### 4 · Camera consent gate · 0:20 – 0:24 (4s)

~230 words. Unreadable at any speed. Do not try.

Establish the shape — the 56px circular camera badge, the heading **"Before the camera turns on"**, two bordered cards below — then push in on exactly one line and hold it long enough to read:

> **"Nothing is kept. There is no bucket, no table, and no file path where a clip lands."**

That single line is the privacy pitch. It does more work than the other 220 words combined.

**Ends on:** **"Allow camera and inference"**.

---

### 5 · Calibration · 0:24 – 0:34 (10s)

**This is where the character first appears.** Not beat 7 — here, in the green room, because that's where you genuinely first see yourself.

| Sub-beat | Time | Content |
|---|---|---|
| 5a | 0:24–0:26 | **Intro.** "Set your calm baseline" + the three icon rows (armchair / sun / clock). Push past them fast — they're texture, not information. Land on **"Turn on camera"**. |
| 5b | 0:26–0:29 | **Green room — first sight of him.** He settles into the 3:4 portrait framing target. The brackets are graphite. Then the gate clears: **brackets turn meadow, a meadow glow blooms, a small check appears top-centre.** Status line reads **"You’re all set — start when you’re ready."** He looks calm, mildly curious. |
| 5c | 0:29–0:30 | **Countdown.** 3 → 2 → 1, white numerals over the blurring preview. Compress — one second total, not three. |
| 5d | 0:30–0:32 | **Recording.** The breathing orb pulsing over his softened preview, label alternating **"Breathe in" / "Breathe out"**. The 6px meadow progress bar advancing beneath. The timer reading down from 1:00. **Show ~2s of a 60s process** — this is the most aggressive compression in the video and it's fine, the orb's rhythm sells the idea instantly. |
| 5e | 0:32–0:34 | **Success.** The bloom ripple, the check drawing itself, **"Your baseline is set"**. |

**Shot note for 5b:** this is the audience's first look at your protagonist's face. Give it a real hold. Everything in beats 7–11 depends on the audience having learned this face while it was calm.

---

### 6 · "Later" · 0:34 – 0:36 (2s)

Back on `/app`, calibration banner now gone. He clicks **"Start check-in"**.

Then the time jump. On-screen text — small, lower third, in the app's own type, not a title card:

> **later that morning**

**Open question for greybox:** whether this needs the text at all, or whether cutting straight to a session timer reading `47:12` communicates it on its own. Try both. The timer alone is more elegant if it reads.

---

### 7 · Working, at ease · 0:36 – 0:40 (4s)

The monitoring session, live and settled.

- The **bloom** pulsing meadow, centred in the stage
- Stateline: **"You're at ease right now"** · "Steady and settled — nothing to do."
- The session trend below, a steady meadow step-line
- Corner readout: **`Session · 47:12`**, ticking. Animate the seconds — it's a small liveness cue that costs nothing.
- The viewfinder (L1, enlarged), showing him **content and lightly smiling**, working

Wide enough to hold bloom, stateline and viewfinder together. This is the "before" — the audience needs it registered so the fall lands.

---

### 8 · The email · 0:40 – 0:46 (6s)

**The core beat. No cutaway, no cut.**

The notification slides in **top-right, adjacent to the viewfinder** (L2). Push in so the notification and his face share the frame.

**⚠️ Misread risk, and it's the one real hazard in this beat.** A generic notification appearing beside the Serenify viewfinder can read as *Serenify notifying him* — which would invert the entire meaning of the scene. The disambiguation is the **mail app icon established in beat 2e**: same shape, same colour, clearly the app we already watched him use. If greybox shows any ambiguity here, fix it by making the icon larger and more prominent, not by moving the toast — the adjacency is load-bearing (L2).

**The toast carries real, legible content.** It is from his boss, and it is a deadline. Something in the shape of:

> **Mail** · now
> **Ahmed Hassan**
> Deadline moved up — need the report by 12

The push-in must make that readable. **The menu-bar clock reads `11:30 AM`** — so the audience does the arithmetic themselves and lands on *thirty minutes*. Nobody needs to be told it's bad news; the two numbers do it.

Sequencing matters here: let the **toast land and be read first**, then his face reacts, then the bloom moves. The order is what makes it cause-and-effect rather than three things happening at once.

Then, in one continuous shot with the toast still up:

1. He reads it. **His face falls.**
2. The **bloom drifts** meadow → mixed → amber. The real transition is 1.3s ease, so a band change *drifts rather than snaps* — keep that, it's the honest behaviour and it looks better.
3. The stateline changes: **"You're a little tense"** · "A bit of an edge lately. Maybe a slow breath."
4. Then further: **"You're feeling tense"** · "This has held a while. Serenify can check in when you're ready."
5. The trend line below climbs and recolours.

**Do not rush this.** Six seconds is the largest single allocation in the video and it's correct — this beat is the entire product thesis in one shot.

---

### 9 · Confirmatory questionnaire · 0:46 – 0:50 (4s)

The sticky confirmatory prompt appears beside the stage. He answers — **and confirms the stress is real.**

**This is the true-positive branch.** The landing page hero deliberately shows the false-alarm branch. That inversion is intentional and must not be reconciled.

I don't have the questionnaire's actual copy — the recon didn't cover it. **Greybox this beat with placeholder text and get CC to pull the verbatim copy before the real render.**

---

### 10 · Ren · 0:50 – 0:57 (7s)

The chat opens. **A real three-turn exchange, each message legible.**

Ren's drawn avatar (PR #221) in the **warm** state — the genuinely distinct eye shape, not a scaled `idle`. This is the only place in the video where Ren's face is on screen long enough to be read, so use the strongest state available.

The exchange, in shape (exact wording to be written, not lifted — this surface doesn't exist yet):

| Turn | Who | Content |
|---|---|---|
| 1 | **Ren** | Opens gently. Asks what's going on — not "how are you feeling," something with less clinical distance. |
| 2 | **Him** | Complains. Short, human, typed fast. The deadline, the thirty minutes. |
| 3 | **Ren** | Suggests putting on Billie Jean — **because it knows he likes MJ.** |

**Turn 3 is the beat that sells the product** and it needs to land as *personal*, not generic. The whole difference between Serenify and a wellness app that says "try deep breathing" is that Ren knows this specific person. If the audience reads turn 3 as a canned suggestion, the beat is dead. Whatever the final wording, it must make clear that Ren knew this about him already.

**Pacing:** messages appear one at a time with a real beat between them, not all at once. ~2s each. Push in on turn 3 and hold.

**Dependency:** the recommendations surface is `014-recommendations` and does not exist. This copy is written for the video. Keep it plausible against what 014 will plausibly ship — don't put a UI on screen that the product will never have.

---

### 11 · Return to ease · 0:57 – 1:03 (6s)

He acts on it. In order:

1. **Opens a music player**, plays the track. Generic app, drawn. **The track is named on screen: Billie Jean, Michael Jackson.** That naming is the point — it's the evidence Ren knew him. Brief; a couple of seconds, no lingering on the interface.
2. **Puts headphones on.**
3. **Music notes drift around him** in the viewfinder. He starts moving with it — small, a head nod, a shoulder. Not a dance number.

**No audio plays.** This is animation only; the VO track is Arabic narration and the cut must work silent regardless.

Meanwhile, on the Serenify surface:

- The bloom drifts amber → meadow (1.3s ease — let it drift, don't snap)
- Stateline returns to **"You're at ease right now"** · "Steady and settled — nothing to do."
- The trend line's tail walks back down

His face settles. **Not the same expression as beat 7** — quieter, relieved, a bit amused at himself.

---

### 12 · End card · 1:03 – 1:08 (5s)

The wordmark, then:

> **take care of yourself**
> **serenify.tech**

Hold. This is where the VO lands its last line, so leave room in the cut.

---

## Running total: ~68s

Over the 40–60s target by roughly eight seconds, all of it added by the expanded Ren exchange and the Spotify resolution. **Do not trim on paper — trim in greybox**, where you can actually feel what's slow.

**Most likely trim candidates, in order:**

1. Beat 2 signup, 12s → 9s. Tighten 2a form-filling and 2e Gmail; leave 2f's OTP choreography alone.
2. Beat 5 calibration, 10s → 8s. 5a intro can lose a second, 5d recording can lose one.
3. Beat 11, 6s → 5s. The Spotify sub-beat is the compressible part, not the easing.
4. Beat 12 end card, 5s → 4s.

**Protect at all costs:** beat 8 (6s), beat 10's turn 3, and the 5b first-sight-of-face hold. Those three are the video.

---

## Open questions for greybox

- Does the "later that morning" text earn its place, or does the `47:12` timer do it alone?
- Do the real full-page reloads (`<a href>` / `window.location.replace`) read as broken on video, or as honest? They're real; showing them is more faithful, but a hard white flash mid-video may just look like a mistake.
- Does the calibration banner's un-transitioned pop-in read as a glitch?
- Beat 9 needs the questionnaire's verbatim copy — not yet recon'd.
- Beat 10's three-turn exchange is written for the video; `014-recommendations` doesn't exist. Keep the UI plausible against what 014 will actually ship.
- Beat 10 turn 3 must read as *personal knowledge*, not a canned tip. If greybox shows it reading generic, that's a copy problem to fix before art.
- Does the mail app icon established in 2e survive the ~25 seconds to beat 8 as a recognisable signature? Greybox will show it.

---

## Third-party brands — decided

**Mail client and music player are generic. Billie Jean and Michael Jackson are named on screen. No audio, no lyrics.** Mohamed's call, made 2026-07-29.

The reasoning: naming a track with no audio and no lyrics carries effectively no risk, and the naming is doing real narrative work — it's the proof Ren knew his taste. Drawn Gmail and Spotify interfaces, by contrast, add brand clutter and buy nothing the story needs.

The one cost is that generic UI can't disambiguate itself, which is why beat 2e now has to establish a mail icon that beat 8 can lean on. See the warning in beat 8.

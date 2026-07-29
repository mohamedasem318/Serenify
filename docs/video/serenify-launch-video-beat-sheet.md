# Serenify — LinkedIn launch video · beat sheet v1

**Format:** 16:9, 1920×1080, ~60s. Silent-first — every beat must read with no audio. Egyptian Arabic VO is recorded last, over a locked cut.

**Render viewport:** the product is rendered at a **1200px-wide viewport** and the whole
desktop is scaled **1.6×** to fill the 1920×1080 output (L7). Not a 1920px browser with
384px of dead gutter each side.

**Pipeline:** real `apps/web` React components for every product screen. Drawn assets only for: the character, his facial expressions, the Gmail tab contents, the macOS notification, and the end card.

**Governing rule:** at 1920×1080 in a phone-sized feed, wide shots are illegible. **Every readable moment is a push-in.** Full-desktop wide shots exist only as brief establishing or transition frames.

**Framing rule:** a push-in **lands on a whole element** — a card, a panel, a message, a
button — with all four edges inside the frame and margin around it. Landing mid-layout,
so the shot holds its target plus slices of the elements above and below, reads as a crop
of something bigger rather than as a composed shot. If two adjacent elements both matter,
frame both entirely or use two moves. **One exception:** full-bleed furniture — the public
nav, the app header, the omnibox, the dashboard banners, the page background — spans the
viewport by design and may run off the left and right edges. 16:9 cannot hold a 1152×86
banner whole *and* magnify it. What must never bleed is a content element, and a sliced
line of *text* is always a failure.

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
| L7 | **The product is rendered at a 1200px viewport, scaled 1.6× to 1920×1080** | `apps/web` uses no `xl:`/`2xl:` utilities at all — its highest breakpoint is `lg:` (1024px), plus one custom `min-[880px]` on the dashboard grid — so every viewport ≥1024px is the identical layout. The content column is `max-w-6xl` (1152) inside `sm:px-6` (24), so it hits its designed cap at exactly 1200. That makes 1200 the *smallest* viewport at which the column is full width: maximum content, zero layout compromise, 1.6× of free magnification. At 1920 the column filled ~60% of frame; at 1200 it fills ~96%. |
| L8 | **Ren's avatar is drawn much larger than the app draws it** | `RenAvatar` defaults to 34px and its call sites use 38 and 54. Beat 10 is the only place in the video where Ren's face is on screen long enough to be read, and at true size it is a smudge on a phone. Same category as L1. |
| L9 | **Ren gets a typing indicator, which the app does not have** | Needed to make the `thinking` state legible as a state rather than as dead air. The video depicts a feature that will be built later. **Decided — this is not a fidelity defect and must not be "fixed".** |

---

## Hard invariants

- **No red anywhere.** Attention = foggy. Stress = amber. Affirmative = meadow.
- **No numeric stress value, ever.** No percentage, no score, no gauge. The bloom carries no number.
- **The confirmatory questionnaire shows the TRUE-POSITIVE branch.** The landing hero shows the false alarm. This inversion is intentional.
- **Copy is verbatim** from the app. Typographic apostrophes (`’`) preserved. Where a beat is too short to read full copy, push in on a fragment — do not paraphrase.
- Several transitions in the real app are **full page reloads** (camera Permissions-Policy). Whether to show those honestly or smooth them is a greybox question, flagged below.

---

## Beats

### 1 · Cold open — `serenify.tech` · 0:00 – 0:05 (5s)

**A blank new tab.** The URL is **typed into the address bar**, and the landing page loads.
The difference between "a website exists" and "someone goes to it" — and only the second is
worth the time. This beat's only job is *this is deployed*.

Then a push toward the hero, and the beat **ends on a click of the landing page's own
"Get started" CTA**, which is what carries us into beat 2. No cut: the
one-continuous-recording continuity holds and the primary CTA gets on screen for free.

**Shot:** blank tab → omnibox while the URL types → page paints → push to the hero block →
click through. **No text overlay.**

**Cost:** 4s → 5s. Four actions where the original had one.

**Known limit:** the omnibox is 1080px wide inside a 1200px viewport, so under the framing
rule the tightest shot on it is barely a push. The typed domain lands at roughly 5–8px on a
phone — the *action* reads, the characters are recognised rather than read. Fixing that
needs either a crop of the omnibox (breaking the framing rule) or a chrome type-scale
liberty. Not taken.

---

### 2 · Signup · 0:05 – 0:18 (13s)

The credibility spend. Mohamed chose this deliberately over a 4s montage.

| Sub-beat | Time | Content |
|---|---|---|
| 2a | 0:05–0:09 | Establish the whole 512px signup card, then push in on the **field group** (labels + three fields + checklist) as one complete element. Fields fill in sequence: `FULL NAME`, `EMAIL`, `PASSWORD`. As the password types, the live checklist lights meadow row by row — "At least 8 characters" → "Contains a letter" → "Contains a number" → collapses to **"Password looks good."** |
| 2b | 0:09–0:10 | The consent checkbox ticks. Land on the consent row: **"I have read and agree to the Terms of Service and the Privacy Policy."** |
| 2c | 0:10–0:11 | **"Create account"** → **"Creating account…"** |
| 2d | 0:11–0:12 | The **"Check your email"** state. Register the heading; do not attempt the body copy. |
| 2e | 0:12–0:15 | **Tab switch to his mail.** Same window, new tab. The Serenify email lands in the inbox, unread, at the top. Two landings: the **unread list row** (sender, subject, `10:21 AM`), then the **whole rendered email**, held with a slow push that ends tighter. Drawn asset — a generic mail client, not Gmail. |

**2e must show real email content, not a blurred placeholder.** It reads as a real email in
a real client: sender, subject, timestamp, body, code. The copy AND the type scale come from
`supabase/templates/confirmation.html` — 520px card, 30px headline, 16px body, 25px code at
4px tracking — not from invention. Generic in *branding* (L2b), never in content. Timestamp
on the email: **10:21 AM** (see internal clock). **Cost: 2s → 3s**, for the two landings.

*A third landing on the code block alone was built and dropped: at any framing tight enough
to enlarge the code, the frame edge cut the body line above it. The whole-card landing
already renders the code legibly, so "the push-in lands on the code" is honoured by where the
move ends rather than by cropping to it.*

**⚠️ This beat has a job in beat 8.** The mail client needs one distinct, memorable visual signature — an app icon with a specific shape and colour, used consistently. Establish it clearly here. Beat 8's notification depends on the audience recognising that icon; see the note there.
| 2f | 0:15–0:18 | **Tab back to Serenify.** Six boxes fill. Then the verification choreography, at or near real speed. |

**2f is the hero moment of the whole signup section.** The real timings, from the recon:

- Halo sweep, box 1→6, 130ms each = **780ms**
- Hold **360ms**
- Merge — boxes slide edge-to-edge, borders melt, all six fill meadow, outer corners round to 28px, the row becomes one pill = **540ms**
- Check icon + the word **"Verified"** cross-fades in = **560ms**
- Pill holds fully opaque = **700ms**
- At 2080ms a muted line fades in below: **"Taking you in…"**

Total ~2.94s. **Play this close to real time.** It's the single most polished piece of motion in the product and compressing it wastes the best thing signup has.

**Two things the recon left out, both now settled against `components/ui/auth/otp-boxes.tsx`:**

- 2f is 3s and the choreography is 2.94s, so there is no room to enter the digits first. They
  land **on** the halo sweep — which is what the product does anyway, since the halo tracks
  each arriving digit.
- **The digits clear ON the merge, not after it.** The component applies `text-transparent`
  on the *same* state flip that fills the boxes, with a 500ms colour transition, so the digits
  fade out across the 540ms merge and there is never a frame where they sit inside a filled
  pill. There is no gap in the shipped component.

**Shot:** locked-off tight on the OTP row for the full choreography. No camera move — let the animation carry it.

---

### 3 · Dashboard, first arrival · 0:18 – 0:22 (4s)

He lands on `/app`. Uncalibrated.

Brief wide to establish the shell — sticky header, wordmark, the 1152px column floating in wide gutters — then push in on the two things that matter:

- **Welcome banner:** "Good morning, [name]" · "A space to check in with yourself."
- **Calibration banner** (foggy-tinted): **"Stress detection isn’t active yet — it needs about a minute of calibration to know what your calm looks like."** with **"Set baseline"**

Note for greybox: the calibration banner really does *pop in* post-hydration with no transition. That may read as a glitch on video. If it does, fade it in. **Settled: it does — at 30fps an instant appearance reads as a dropped frame. Faded over 6 frames.**

**⚠️ This beat has no push-in, and cannot have one.** Both banners are full-bleed — 1152 wide
inside a 1200 viewport — so the tightest framing that holds either of them whole IS the full
frame. There is nowhere to push. The camera does what is left: a small vertical reposition to
centre both banners. Copy stays **left-aligned**, as the app has it.

The consequence is that the calibration sentence is not readable on a phone. It is `text-sm`
(14px, the app's own size), which at full frame lands at about 5px. The audience gets the
banner's shape and the **"Set baseline"** button; the sentence is recognised as a sentence,
not read. Reading it would need a type-scale liberty or a crop — **neither taken; this is a
sheet-level decision, not a greybox one.**

**Ends on:** the click on **"Set baseline"**.

---

### 4 · Camera consent gate · 0:22 – 0:26 (4s)

~230 words. Unreadable at any speed. Do not try.

Establish the shape — the 56px circular camera badge, the heading **"Before the camera turns on"**, two bordered cards below — then push in on exactly one line and hold it long enough to read:

> **"Nothing is kept. There is no bucket, no table, and no file path where a clip lands."**

That single line is the privacy pitch. It does more work than the other 220 words combined.

**The framing rule costs this beat nothing.** At 1200 the gate's cards are 552 wide, so one
landing holds the key line's card AND the button, both complete, with the card above entirely
out of frame. **Still 4s.** (At a 1920 viewport the cards were 840 wide and this needed two
moves.) The gate is laid out as page-level content rather than inside one tall outer card: a
500px-tall container cannot be framed whole at any useful zoom, so wrapping it in one would
guarantee a cropped element in every shot.

**Ends on:** **"Allow camera and inference"**.

---

### 5 · Calibration · 0:26 – 0:36 (10s)

**This is where the character first appears.** Not beat 7 — here, in the green room, because that's where you genuinely first see yourself.

| Sub-beat | Time | Content |
|---|---|---|
| 5a | 0:26–0:28 | **Intro.** "Set your calm baseline" + the three icon rows (armchair / sun / clock). Push past them fast — they're texture, not information. Land on **"Turn on camera"**. |
| 5b | 0:28–0:31 | **Green room — first sight of him.** He settles into the 3:4 portrait framing target. The brackets are graphite. Then the gate clears: **brackets turn meadow, a meadow glow blooms, a small check appears top-centre.** Status line reads **"You’re all set — start when you’re ready."** He looks calm, mildly curious. |
| 5c | 0:31–0:32 | **Countdown.** 3 → 2 → 1, white numerals over the blurring preview. Compress — one second total, not three. |
| 5d | 0:32–0:34 | **Recording.** The breathing orb pulsing over his softened preview, label alternating **"Breathe in" / "Breathe out"**. The 6px meadow progress bar advancing beneath. The timer reading down from 1:00. **Show ~2s of a 60s process** — this is the most aggressive compression in the video and it's fine, the orb's rhythm sells the idea instantly. |
| 5e | 0:34–0:36 | **Success.** The bloom ripple, the check drawing itself, **"Your baseline is set"**. |

**Shot note for 5b:** this is the audience's first look at your protagonist's face. Give it a real hold. Everything in beats 7–11 depends on the audience having learned this face while it was calm.

**Framing note:** the preview and the status line beneath it are framed **together**, both
complete. That caps the preview at a **240×320** portrait target (same 3:4 ratio) — at 320×426
the composite forces the camera out far enough that the face and the status line both stop
being readable. Ratio and framing target are unchanged; only the on-screen size is smaller.

---

### 6 · "Later" · 0:36 – 0:38 (2s)

Back on `/app`, calibration banner now gone. He clicks **"Start check-in"**.

Then the time jump. On-screen text:

> **later that morning**

**Settled — the text stays, and it is set LOUD.** Both variants were built and scrubbed. Small,
low-contrast, lower-third, in the app's own type was easy to miss entirely, which defeats the
only thing the line exists to do; and the `47:12` timer alone does not read as a jump. It is now
44px, ink-on-page, centred in the lower third of the *frame* rather than the bottom of the page.
This is **not** a caption system — on-screen text gets a proper treatment in a later pass, once
framing has settled.

**Shot:** locked on the full frame. Any tighter framing slices the welcome banner's copy at the
left edge, and at full frame the 44px line still lands at ~15px on a phone.

---

### 7 · Working, at ease · 0:38 – 0:42 (4s)

The monitoring session, live and settled.

- The **bloom** pulsing meadow, centred in the stage
- Stateline: **"You're at ease right now"** · "Steady and settled — nothing to do."
- The session trend below, a steady meadow step-line
- Corner readout: **`Session · 47:12`**, ticking. Animate the seconds — it's a small liveness cue that costs nothing.
- The viewfinder (L1, enlarged), showing him **content and lightly smiling**, working

Wide enough to hold bloom, stateline and viewfinder together. This is the "before" — the audience needs it registered so the fall lands.

**⚠️ The stateline's SUB-LINE does not read, and at this framing it cannot.** The head is
`text-3xl` (30px) and now lands at ~13px on a phone — comfortably legible, and a big
improvement on the 1920 viewport, where it was ~7px. But the sub is `text-base` (16px), and
holding all three elements means framing ~1036px of world, at which 16px is ~6px on a phone.
Reading it needs its own landing on the stateline block (400 wide, so a ~470 framing puts the
sub at ~14px) — **a second move and roughly 1.5s more.** Not taken; the beat is built as
written. This is the open decision on beat 7.

---

### 8 · The email · 0:42 – 0:48 (6s)

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

### 9 · Confirmatory questionnaire · 0:48 – 0:51 (3s)

The sticky confirmatory prompt appears beside the stage. He answers — **and confirms the stress is real.**

**This is the true-positive branch.** The landing page hero deliberately shows the false-alarm branch. That inversion is intentional and must not be reconciled.

**RESOLVED — the copy exists and is signed off.** `apps/web/components/questionnaire/confirmatory-prompt.tsx`:
title **"Checking in"**, body **"Your signals have looked tense for a little while. Is that how
you're feeling?"**, options **"Yes, that's me" / "No, I'm okay" / "Maybe — talk about it"**. He
picks the first. Nothing to recon.

**Cost: 4s → 3s.** The read is quick and 4s sat on a read the audience had finished two seconds
earlier. The prompt lands, then the click follows.

---

### 10 · Ren · 0:51 – 0:58 (7s)

The chat opens. **A real three-turn exchange, each message legible.**

Ren's drawn avatar (PR #221), **enlarged (L8)** and **in frame for the entire exchange** — every
landing is a union of the avatar and the message being read, so the avatar never leaves. It is a
character drawn specifically for this; letting the camera follow the messages and drop it after
turn 1 wastes it.

**All four states are timed** (labelled grey placeholders in greybox; the art comes later):

| State | When |
|---|---|
| `idle` | at rest, before the exchange opens |
| `attentive` | while he types his complaint |
| `thinking` | while Ren composes the suggestion — **with a typing indicator the app does not have (L9)** |
| `warm` | turn 3 delivered, held through beat 11 |

The exchange, in shape (exact wording to be written, not lifted — this surface doesn't exist yet):

| Turn | Who | Content |
|---|---|---|
| 1 | **Ren** | Opens gently. Asks what's going on — not "how are you feeling," something with less clinical distance. |
| 2 | **Him** | Complains. Short, human, typed fast. The deadline, the thirty minutes. |
| 3 | **Ren** | Suggests putting on Billie Jean — **because it knows he likes MJ.** |

**Turn 3 is the beat that sells the product** and it needs to land as *personal*, not generic. The whole difference between Serenify and a wellness app that says "try deep breathing" is that Ren knows this specific person. If the audience reads turn 3 as a canned suggestion, the beat is dead. Whatever the final wording, it must make clear that Ren knew this about him already.

**Pacing:** messages appear one at a time with a real beat between them, not all at once. ~2s each. Push in on turn 3 and hold.

**Camera correction:** the camera **moves on every turn**, not only on turn 3. At a framing wide
enough to hold the whole thread, 16px chat text is well under phone legibility, so turns 1 and 2
would be unreadable. It settles on each message as it arrives and pushes further on turn 3. A
change to the shot plan, not to the beat.

**Dependency:** the recommendations surface is `014-recommendations` and does not exist. This copy is written for the video. Keep it plausible against what 014 will plausibly ship — don't put a UI on screen that the product will never have.

---

### 11 · Return to ease · 0:58 – 1:04 (6s)

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

### 12 · End card · 1:04 – 1:09 (5s)

The wordmark, then:

> **take care of yourself**
> **serenify.tech**

Hold. This is where the VO lands its last line, so leave room in the cut.

---

## Running total: ~69s

Over the 40–60s target by roughly nine seconds, all of it added by the expanded Ren exchange and the Spotify resolution. **Do not trim on paper — trim in greybox**, where you can actually feel what's slow.

**Changes since the first greybox** (net +1s on 68s): beat 1 **4s → 5s** (arriving at the site
and clicking through is four actions, not one); 2e **2s → 3s** (the email needs two landings
under the framing rule); beat 9 **4s → 3s** (it was sitting on a finished read). Beat 4 was
expected to need a second move and does not — the narrower viewport made one framing enough.

**Most likely trim candidates, in order:**

1. Beat 2 signup, 13s → 10s. Tighten 2a form-filling and 2e; leave 2f's OTP choreography alone.
2. Beat 5 calibration, 10s → 8s. 5a intro can lose a second, 5d recording can lose one.
3. Beat 11, 6s → 5s. The Spotify sub-beat is the compressible part, not the easing.
4. Beat 12 end card, 5s → 4s.

**Protect at all costs:** beat 8 (6s), beat 10's turn 3, and the 5b first-sight-of-face hold. Those three are the video.

---

## Open questions for greybox

**Answered:**

- ~~Does the "later that morning" text earn its place?~~ **Yes, but only when it is loud.** See beat 6.
- ~~Does the calibration banner's un-transitioned pop-in read as a glitch?~~ **Yes.** Faded over 6 frames.
- ~~Beat 9 needs the questionnaire's verbatim copy.~~ **It already existed.** See beat 9.

**Still open:**

- **Beat 7's stateline sub-line is unreadable** at any framing that holds bloom, stateline and
  viewfinder together. Give it its own landing (+~1.5s) or accept it? See beat 7.
- **Beat 3's calibration sentence is unreadable** — `text-sm` in a full-bleed banner, so the beat
  has no push-in available at all. Accept, or take a type-scale liberty? See beat 3.
- **Beat 1's typed URL is only recognised, not read**, for the same full-bleed reason.
- Do the real full-page reloads (`<a href>` / `window.location.replace`) read as broken on video, or as honest? They're real; showing them is more faithful, but a hard white flash mid-video may just look like a mistake.
- Beat 10's three-turn exchange is written for the video; `014-recommendations` doesn't exist. Keep the UI plausible against what 014 will actually ship.
- Beat 10 turn 3 must read as *personal knowledge*, not a canned tip. If greybox shows it reading generic, that's a copy problem to fix before art.
- Does the mail app icon established in 2e survive the ~25 seconds to beat 8 as a recognisable signature? Greybox will show it.

---

## Third-party brands — decided

**Mail client and music player are generic. Billie Jean and Michael Jackson are named on screen. No audio, no lyrics.** Mohamed's call, made 2026-07-29.

The reasoning: naming a track with no audio and no lyrics carries effectively no risk, and the naming is doing real narrative work — it's the proof Ren knew his taste. Drawn Gmail and Spotify interfaces, by contrast, add brand clutter and buy nothing the story needs.

The one cost is that generic UI can't disambiguate itself, which is why beat 2e now has to establish a mail icon that beat 8 can lean on. See the warning in beat 8.

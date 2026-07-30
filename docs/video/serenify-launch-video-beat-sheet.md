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

**The line, resolved to every instance.** With a clock on screen (L11) this stopped being
ignorable: `10:43 + 47:12 = 11:30:12`, so **beats 7 through 11 all read 11:30** — they are
~26s of screen time inside one minute of story time. The drift was in the clocks, not the
timer: beat 7 read 11:29, beat 10 read 11:31 and beat 11 read 11:33 against session values
that all said 11:30. The full line is 10:20 (beats 1–2) → 10:21 (2e, the mail lands) →
10:23 (3) → 10:24 (4) → 10:25–10:26 (5) → **10:43 (6, the session begins)** → **11:30
(7–11)**. Session readouts run `47:12` at beat 7 and tick continuously from there.

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
| L10 | **The travelling lift** — an element detaches from its layout, **travels** to centre frame at a narrower measure, is read, and settles back where it belongs | Some elements cannot be made legible by any camera move, and the reason is geometry: a 1152×86 banner in a 1200 viewport cannot be held whole *and* magnified in a 16:9 frame, so the tightest shot on it is the full frame. The lift stages the element instead of the shot. Content and type sizes stay real — the calibration banner is still `text-sm` — only position and measure are staged. **Used in exactly two places: beat 1's address bar and beat 3's calibration banner.** A third candidate gets reported rather than built. (Beat 7's stateline used to count against this cap; it is a different device — see L12 — and no longer does.) |
| L11 | **A clock in the browser toolbar**, right-aligned at the omnibox row's end, at twice the chrome's own type size | Beat 8's payoff is arithmetic the audience does unaided — the clock says 11:30, the boss says "by 12", nobody says *thirty minutes*. With no legible clock there is no arithmetic and no payoff, so a clock is load-bearing and must exist **from beat 1** (one continuous recording cannot grow chrome halfway through). The honest place is the macOS menu bar, but a 24px bar holds ~16px of type — ~6px on a phone in a wide shot — so it would have to grow (page height, which L7's whole argument forbids spending) *and* beat 8's push-in would have to reach world y 0, widening 590 → ~711 and dropping the toast's own subject line to ~8px. The toolbar costs **zero page height** and widens beat 8's push-in by only ~4%. No real browser draws a clock there; that is the entire cost. **It is plain — no pulse, flash, tint or animation beyond the time changing.** Emphasis would convert a discovery into an instruction, and there is no colour available anyway: amber and meadow both carry band meaning. |
| L12 | **The in-place emphasis** — the stateline block grows 1.65× where it stands, is read, and settles. Nothing travels, the camera does not move | Holding bloom + stateline + viewfinder together means framing ~1096px of world, at which the app's `text-base` (16px) sub is ~6px on a phone. A separate landing on the block was priced at ~1.5s; this is **free**, because camera travel is what costs time. **It is a rule, not a budget** — see the invariant below. |

---

## Hard invariants

- **NO CUTS INSIDE A BEAT.** The video is one continuous screen recording, and that is an
  invariant, not an aspiration. The camera moves, holds, and moves again.
  - Moving between two parts of the same screen is a **move**, not a cut. Pan, or pull out
    and push back in. Never a jump.
  - Where the app **animates** between states, show the animation. The signup form →
    "Check your email" change happens in the product; show it happening rather than cutting
    to the result.
  - **Tab operations are performed, not cut to.** Clicking the new-tab button, navigating,
    landing — the actions are visible.
  - **Clicks and their consequences share a shot** wherever the app keeps them on the same
    screen.
  - This is expensive, and the cost is paid rather than dodged. A long camera travel either
    takes time or reads as a whip-pan; where it takes time, the beat gets the time. Never
    reintroduce a cut to protect a duration.
- **THE IN-PLACE EMPHASIS FIRES ON EVERY STATELINE COPY CHANGE (L12).** Beat 7 ("You're at
  ease right now"), beat 8 (→ "a little tense" → "feeling tense"), beat 11 (back to "at
  ease"). The audience should learn that when the block moves, the reading changed;
  repetition is what turns the device from a flourish into grammar.
  - **No yo-yo.** Beat 8's two copy changes land seconds apart, so the block goes up
    **once** and stays up across both, with the copy changing while it is raised. Never
    grow, settle, and grow again.
  - **It must never cover the bloom.** Beat 7's job is to plant bloom, stateline and
    viewfinder together as the "before". So the block grows *downward* from its own top
    edge rather than about its centre, and the reading card was relaid out to make the room
    below: the card is 40px taller and the trend sits 76px lower.
- **No red anywhere.** Attention = foggy. Stress = amber. Affirmative = meadow.
- **No numeric stress value, ever.** No percentage, no score, no gauge. The bloom carries no number.
- **The confirmatory questionnaire shows the TRUE-POSITIVE branch.** The landing hero shows the false alarm. This inversion is intentional.
- **Copy is verbatim** from the app. Typographic apostrophes (`’`) preserved. Where a beat is too short to read full copy, push in on a fragment — do not paraphrase.
- Several transitions in the real app are **full page reloads** (camera Permissions-Policy). Whether to show those honestly or smooth them is a greybox question, flagged below.

---

## Beats

### 1 · Cold open — `serenify.tech` · 0:00 – 0:06 (6s)

**The address bar opens the film, lifted (L10)** — and this is the model for the other two
lifts. It starts alone at centre frame, large: 440px wide instead of the 1080 it really is.
`serenify.tech` is typed into it. Then it **travels up and settles into its real position** in
the browser chrome as the page loads, and the camera pulls out with it. The video's first
action is a person deciding to go somewhere. This beat's only job is *this is deployed*.

Then a push toward the hero, and the beat **ends on a click of the landing page's own
"Get started" CTA**, which is what carries us into beat 2. No cut.

**Shot:** lifted address bar → typing → the lift settles home as the page paints → push to
the hero block → click through. **No text overlay.**

**Cost:** 5s → 6s. The lift is a staged move with a settle at the end of it.

**RESOLVED — the ~5px typed domain.** Lifted, the omnibox frames at 500 and its real 14px
reads at about 12px on a phone. No crop, no type-scale liberty.

---

### 2 · Signup · 0:06 – 0:21.6 (15.6s)

The credibility spend. Mohamed chose this deliberately over a 4s montage.

**ONE TAKE.** The sub-beats below are phases of a single continuous shot, not separate shots.
There is no cut anywhere in this beat.

| Sub-beat | Time | Content |
|---|---|---|
| 2a | 0:06–0:10 | Establish the whole 512px signup card, then push in on the **field group** (labels + three fields + checklist) as one complete element. Fields fill in sequence: `FULL NAME`, `EMAIL`, `PASSWORD`. As the password types, the live checklist lights meadow row by row — "At least 8 characters" → "Contains a letter" → "Contains a number" → collapses to **"Password looks good."** |
| 2b–2c | 0:10–0:12 | **A PAN down** from the password field and its checklist to the consent row and the button — not a cut. The consent checkbox ticks and **"Create account"** → **"Creating account…"** is pressed **in the same shot**. |
| 2d | 0:12–0:13 | The **"Check your email"** state, reached by **showing the transition** rather than cutting to it: the card's height eases to the shorter state while the two contents cross-fade. Register the heading; do not attempt the body copy. |
| 2e | 0:13–0:19 | **His mail, as performed actions.** A **new tab is opened** (the button is clicked), the provider is **navigated to** (the URL appears in the omnibox), the page **loads**, the unread email is there, it is **clicked open**, and the code is shown. Two landings: the unread list row (sender, subject, `10:21 AM`), then the whole rendered email with a slow push that ends tighter. Then a **performed tab switch back** to Serenify. Drawn asset — a generic mail client, not Gmail. |

**2e must show real email content, not a blurred placeholder.** It reads as a real email in
a real client: sender, subject, timestamp, body, code. The copy AND the type scale come from
`supabase/templates/confirmation.html` — 520px card, 30px headline, 16px body, 25px code at
4px tracking — not from invention. Generic in *branding* (L2b), never in content. Timestamp
on the email: **10:21 AM** (see internal clock).

**Cost: beat 2 goes 13s → 16s, and it is the invariant's biggest bill.** Opening a tab,
typing a URL, waiting for a page and clicking a message open used to be five cuts; performed,
they are about three seconds. A cut back to Serenify after the code was explicitly allowed and
turned out not to be needed — the tab click costs half a second.

*A third landing on the code block alone was built and dropped: at any framing tight enough
to enlarge the code, the frame edge cut the body line above it. The whole-card landing
already renders the code legibly, so "the push-in lands on the code" is honoured by where the
move ends rather than by cropping to it.*

**⚠️ This beat has a job in beat 8.** The mail client needs one distinct, memorable visual signature — an app icon with a specific shape and colour, used consistently. Establish it clearly here. Beat 8's notification depends on the audience recognising that icon; see the note there.
| 2f | 0:19–0:22 | **Back on Serenify.** A **wide hold** on the verify screen first, so the audience sees which screen it is on, then in on the OTP row. Six boxes fill, then the verification choreography, at or near real speed. |

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
- **The merged pill has no seams, and the fix is the component's own.** `meltTogether()` slides
  the boxes to a **1.5px overlap**, not to abutment — six same-colour fills that merely touch
  expose a hairline of page background at fractional widths and high DPR. Dropping the borders
  is not enough; abutting rects antialias against each other. Overlap by 1.5px and a seam is
  impossible.

**Shot:** locked-off tight on the OTP row for the full choreography. No camera move — let the animation carry it.

**Do not dress the greybox verify screen.** It reads bland and it should — the real page
brings the heading, the body copy, the halo sweep and the meadow fills. The wide hold before
the OTP row was shortened by 10 frames instead (−0.4s on the beat), which is the right lever:
shorten the wait, never fill it with furniture that is not shipping.

---

### 3 · Dashboard, first arrival · 0:21.6 – 0:25.6 (4s)

He lands on `/app`. Uncalibrated.

**Arrives by pulling out, not by cutting.** After "Taking you in…" the camera pulls back from
the OTP row and the dashboard is simply what is there when it gets wide. Then the two things
that matter:

- **Welcome banner:** "Good morning, [name]" · "A space to check in with yourself."
- **Calibration banner** (foggy-tinted): **"Stress detection isn’t active yet — it needs about a minute of calibration to know what your calm looks like."** with **"Set baseline"**

Note for greybox: the calibration banner really does *pop in* post-hydration with no transition. That may read as a glitch on video. If it does, fade it in. **Settled: it does — at 30fps an instant appearance reads as a dropped frame. Faded over 6 frames.**

**The calibration banner takes the travelling lift (L10).** It is full-bleed — 1152 wide
inside a 1200 viewport — so no camera move can magnify it, and at the full frame its `text-sm`
(14px) copy lands at about 5px on a phone. Lifted, it detaches, travels to a **520px measure**
at centre frame where the camera *can* frame it tightly, is read **at its real 14px**, and
settles back. The page washes back behind it while it is up. Copy stays **left-aligned**, as
the app has it.

**It is a ROW in both states.** The real banner is a row with the button inside it, and drawing
it as a column meant its own contents overflowed the seated 80px banner top and bottom and
crossed its edge in the wide shot. Row seated, row lifted: text left, button right, both inside
the bounds. Flex does the reflow, so there is no layout flip mid-travel either.

**RESOLVED:** the revision-2 note that this beat had no push-in available and no fix short of a
type-scale liberty. The lift needs neither.

**Cost:** 5s → **4s**. The lift works and it stays, but it was spending about a second more
than the beat can afford. The 20-word sentence was never going to be fully read whatever the
hold — the lift buys legibility, not reading time — so the travel and the hold are both
tighter, and the beat reads as "calibration is required, he clicks" without lingering.

**Ends on:** the click on **"Set baseline"**.

---

### 4 · Camera consent gate · 0:25.6 – 0:30.6 (5s)

~230 words. Unreadable at any speed. Do not try.

**The page is SCROLLED, because the real page does not fit.** At 1200×675 the gate is ~890px of
page — a badge, a heading, ~230 words across two bordered cards, and the CTA — in a 583px
viewport. Showing it scrolled is the honest behaviour, and it reinforces what the copy is
saying: this is long because it matters. **Cost: 4s → 5s**, all of it the scroll.

Establish the shape — the circular camera badge, the heading **"Before the camera turns on"**, two bordered cards below — then scroll, then land on exactly one line and hold it long enough to read:

> **"Nothing is kept. There is no bucket, no table, and no file path where a clip lands."**

That single line is the privacy pitch. It does more work than the other 220 words combined.

**The framing rule costs this beat nothing.** At 1200 the gate's cards are 552 wide, so one
landing holds the key line's card AND the button, both complete, with the card above entirely
out of frame. (At a 1920 viewport the cards were 840 wide and this needed two
moves.) The gate is laid out as page-level content rather than inside one tall outer card: a
500px-tall container cannot be framed whole at any useful zoom, so wrapping it in one would
guarantee a cropped element in every shot.

**Ends on:** **"Allow camera and inference"**.

---

### 5 · Calibration · 0:30.6 – 0:43 (12.4s)

**This is where the character first appears.** Not beat 7 — here, in the green room, because that's where you genuinely first see yourself.

**ONE TAKE**, and it now runs all the way to the dashboard. **Cost: 10s → 12s → 12.4s** — the
uploading line is ~1.3s and the success state plus its click is ~2.7s, offset a little by 5a
getting simpler; the last 0.4s is reading time for the success copy (see 5f).

| Sub-beat | Time | Content |
|---|---|---|
| 5a | 0:32–0:34 | **Intro, and it STAYS WIDE.** "Set your calm baseline" + the three icon rows (armchair / sun / clock). The rows are short and the whole screen reads without magnification, so there is no push-in — the old one onto **"Turn on camera"** was buying nothing. Ends on the click. |
| 5b | 0:34–0:37 | **Green room — first sight of him.** He settles into the 3:4 portrait framing target. The brackets are graphite. Then the gate clears: **brackets turn meadow, a meadow glow blooms, a small check appears top-centre.** Status line reads **"You’re all set — start when you’re ready."** He looks calm, mildly curious. |
| 5c | 0:37–0:38 | **Countdown.** 3 → 2 → 1, white numerals over the blurring preview. Compress — one second total, not three. |
| 5d | 0:38–0:40 | **Recording.** The breathing orb pulsing over his softened preview, label alternating **"Breathe in" / "Breathe out"**. The 6px meadow progress bar advancing beneath. The timer reading down from 1:00. **Show ~2s of a 60s process** — this is the most aggressive compression in the video and it's fine, the orb's rhythm sells the idea instantly. |
| 5e | 0:38.6–0:40 | **Uploading.** The capture stage is **replaced** by the line, verbatim from `components/anchor/anchor-recorder.tsx`: **"Setting your baseline — one calm moment…"** |
| 5f | 0:40–0:43 | **The camera PULLS OUT, then he clicks.** The bloom ripple, the check drawing itself, and the real success state from `components/anchor/success-state.tsx`: **"Your baseline is set"** (`text-3xl sm:text-4xl`) · "We’ve learned what calm looks like for you. You can update it anytime from your account." · the **"Back to home"** button. All three are in frame, all four edges inside it, *before* the click. Then he clicks, and lands on the dashboard. Beat 6 continues from that frame. |

**5e/5f corrected.** The earlier version covered the viewfinder with a success state and then cut
to the dashboard, skipping the uploading line, the real success copy and the click. All three are
part of the chain and the click is a real action.

**5f's framing corrected too.** The success state used to appear eight frames *before* the
pull-out began, so its own payoff played cropped for about a second and the click followed 0.7s
after the camera finally landed. The order is now: the line resolves → the camera pulls out to
hold the whole state → it is read → he clicks. The +0.4s is reading time for 16 words at 16px.

**Shot note for 5b:** this is the audience's first look at your protagonist's face. Give it a real hold. Everything in beats 7–11 depends on the audience having learned this face while it was calm.

**Framing note:** the preview and the status line beneath it are framed **together**, both
complete. That caps the preview at a **240×320** portrait target (same 3:4 ratio) — at 320×426
the composite forces the camera out far enough that the face and the status line both stop
being readable. Ratio and framing target are unchanged; only the on-screen size is smaller.

---

### 6 · "Later" · 0:43 – 0:45 (2s)

Continues straight from beat 5, which now lands on the dashboard itself. The calibration banner
is gone — that absence is the beat's visible content — and he clicks **"Start check-in"**.

**The "later that morning" text is GONE.** No replacement.

**The time jump is DECIDED, and it is out of scope.** The toolbar clock (L11) reads 10:43 here
and 11:30 in beat 7, and the session timer reads `47:12`, so the information is on screen and
consistent — but it will still play as continuous time and that is fine. "He calibrated, he
worked a while, an email came" is what the audience takes away and it is correct. Do not spend
anything on making the jump read.

**Shot:** locked on the full frame.

---

### 7 · Working, at ease · 0:45 – 0:49 (4s)

The monitoring session, live and settled.

- The **bloom** pulsing meadow, centred in the stage
- Stateline: **"You're at ease right now"** · "Steady and settled — nothing to do."
- The session trend below, a steady meadow step-line
- Corner readout: **`Session · 47:12`**, ticking. Animate the seconds — it's a small liveness cue that costs nothing.
- The viewfinder (L1, enlarged), showing him **content and lightly smiling**, working

Wide enough to hold bloom, stateline and viewfinder together. This is the "before" — the audience needs it registered so the fall lands.

**The first firing of the in-place emphasis (L12), and it costs nothing.** Holding bloom +
stateline + viewfinder together means framing ~1096px of world, at which the app's `text-base`
(16px) sub is ~6px on a phone. The alternative — its own landing on the block — was priced at
~1.5s. The emphasis is free because it needs **no camera travel**: the block grows **1.65×**
where it stands while the camera holds the composite, putting the 30px head at ~19px and the
16px sub at ~10px. The rise and the settle both fit inside the 4s the beat already had.

**It settles HERE rather than handing the raised block to beat 8.** The intent was to carry it
across the join, but beat 8's push-in frames from world x 708 and the raised block's right edge
is at x 800 — a raised block put 92px of panel and a sliced word inside the video's single most
important shot. The framing does not allow the join, so the join is not forced; beat 8 raises its
own, once, covering both of its copy changes. That is the constraint that matters.

**RESOLVED:** the revision-2 open decision on beat 7's sub-line.

---

### 8 · The email · 0:49 – 0:55 (6s)

**The core beat. No cutaway, no cut.**

The notification slides in **top-right, adjacent to the viewfinder** (L2). Push in so the notification and his face share the frame.

**The toast and the viewfinder share an x and a width.** That relationship IS L2 — you watch his
face fall *while the toast is up* — so it is a layout constraint, not a preference. It was briefly
broken by widening the toast to fit the boss's subject line; both are 320 wide at the same x now,
and the reading card was narrowed to 700 to make room.

**⚠️ Misread risk, and it's the one real hazard in this beat.** A generic notification appearing beside the Serenify viewfinder can read as *Serenify notifying him* — which would invert the entire meaning of the scene. The disambiguation is the **mail app icon established in beat 2e**: same shape, same colour, clearly the app we already watched him use. If greybox shows any ambiguity here, fix it by making the icon larger and more prominent, not by moving the toast — the adjacency is load-bearing (L2).

**The toast carries real, legible content.** It is from his boss, and it is a deadline. Something in the shape of:

> **Mail** · now
> **Ahmed Hassan**
> Deadline moved up — need the report by 12

The push-in must make that readable. **The clock reads `11:30 AM` and is IN THE PUSH-IN** (L11) — so the audience does the arithmetic themselves and lands on *thirty minutes*. Nobody needs to be told it's bad news; the two numbers do it. The clock, the toast and the viewfinder share a right edge at world x 1176, so the push-in frames one vertical stack rather than three unrelated things.

**The three-way framing question, and what it cost.** The push-in must hold the notification and
his face (L2) and the emphasis rule wants the stateline in frame when its copy changes. **No
single framing does both**, and the reason is geometry rather than craft: the block sits at world
x 270–670 and the clock/toast/viewfinder stack at x 856–1176, so a shot holding all three spans
906px — 2.0× against the wide shot's 1.75×, barely a push-in, with the toast's subject line at
~6px on a phone. The beat's own key text would become unreadable to keep a device on screen.

So it is split across the one continuous move the beat already had: **tight** holds clock + toast
+ face and is where the toast is *read*; **wide** holds the whole card, the viewfinder and the
toast still up, and is where the stateline changes twice under one raise. What was given up: at
the wide framing the toast is present but not readable. That is the right thing to lose — it was
read seconds earlier at 3.1×, and after that its only job is to still be up while the reading
falls.

Sequencing matters here: let the **toast land and be read first**, then his face reacts, then the bloom moves. The order is what makes it cause-and-effect rather than three things happening at once.

Then, in one continuous shot with the toast still up:

1. He reads it. **His face falls.**
2. The **bloom drifts** meadow → mixed → amber. The real transition is 1.3s ease, so a band change *drifts rather than snaps* — keep that, it's the honest behaviour and it looks better.
3. The stateline changes: **"You're a little tense"** · "A bit of an edge lately. Maybe a slow breath."
4. Then further: **"You're feeling tense"** · "This has held a while. Serenify can check in when you're ready."
   — **both under ONE raise of the emphasis** (L12). It goes up as the camera lands wide, both
   readings change while it is up, and it settles once. No settle-and-relift between them.
5. The trend line below climbs and recolours.

**Do not rush this.** Six seconds is the largest single allocation in the video and it's correct — this beat is the entire product thesis in one shot.

---

### 9 · Confirmatory questionnaire · 0:55 – 0:58 (3s)

The sticky confirmatory prompt appears beside the stage. He answers — **and confirms the stress is real.**

**This is the true-positive branch.** The landing page hero deliberately shows the false-alarm branch. That inversion is intentional and must not be reconciled.

**RESOLVED — the copy exists and is signed off.** `apps/web/components/questionnaire/confirmatory-prompt.tsx`:
title **"Checking in"**, body **"Your signals have looked tense for a little while. Is that how
you're feeling?"**, options **"Yes, that's me" / "No, I'm okay" / "Maybe — talk about it"**. He
picks the first. Nothing to recon.

**Cost: 4s → 3s.** The read is quick and 4s sat on a read the audience had finished two seconds
earlier. The prompt lands, then the click follows.

---

### 10 · Ren · 0:58 – 1:05 (7s)

The chat opens. **A real three-turn exchange, each message legible.**

Ren's drawn avatar (PR #221), **enlarged (L8)** and **in frame for the entire exchange** — every
landing is a union of the avatar and the message being read, so the avatar never leaves. It is a
character drawn specifically for this; letting the camera follow the messages and drop it after
turn 1 wastes it.

**It is a CHAT AVATAR, attached to Ren's own bubbles.** A single enlarged circle floating between
the two bubbles belongs to neither, and leaves it unclear which side of the conversation is Ren —
the one thing this beat cannot afford. Anchored to each Ren bubble, the app's real conventions do
their normal job (`components/chat/chat-shell.tsx`): Ren is `self-start`, bordered `bg-surface`,
`rounded-bl-sm`; he is `self-end`, filled `bg-foggy`, `rounded-br-sm`; both `text-[15px]`,
`max-w-[74%]`. The squared bottom-left corner on Ren's bubbles is exactly where the avatar sits,
so the pairing reads without help. Ownership must be unambiguous at a glance.

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

### 11 · Return to ease · 1:05 – 1:12 (7s)

He acts on it. In order:

1. **Opens a music player**, plays the track. Generic app, drawn. **The track is named on screen: Billie Jean, Michael Jackson.** That naming is the point — it's the evidence Ren knew him. Brief; a couple of seconds, no lingering on the interface.
2. **Puts headphones on.**
3. **Music notes drift around him** in the viewfinder. He starts moving with it — small, a head nod, a shoulder. Not a dance number.

**No audio plays.** This is animation only; the VO track is Arabic narration and the cut must work silent regardless.

Then, **after the head nod, THE CAMERA PULLS OUT AND HOLDS.** That pull-out is the beat's payoff
and it was missing: the move used to begin two-thirds of the way in and arrive on the very last
frame, so it never landed and never held, and everything that resolves resolved off screen. It now
lands with 50 frames still to run, and all three of these happen in that wide shot, in causal
order:

- The bloom drifts amber → meadow (1.3s ease — let it drift, don't snap)
- Stateline returns to **"You're at ease right now"** · "Steady and settled — nothing to do."
  — the third firing of the emphasis (L12)
- **The trend line's tail walks back down.** This is the thing the beat exists to show.

His face settles. **Not the same expression as beat 7** — quieter, relieved, a bit amused at himself.

**Framing note:** the push-in on the viewfinder sits **wide**, not tight. The headphones, the
drifting notes and his head nod all need room; cropping to the face loses the thing that makes the
beat work.

**Cost: 6s → 7s.** The music player gives back ~0.4s — the track name reads in well under two
seconds at that framing — and the payoff takes 1.4s.

---

### 12 · The closing subtitle card · 1:12 – 1:15 (3s) — NEW

A short card between the demo resolving and the wordmark reveal.

**What it is for.** The reading came back down because *he was asked and he answered.* The
confirmatory step is the thesis of the whole project — the model does not decide alone — and the
video demonstrates it across beats 8, 9 and 11 without ever naming it. This names it, once, as the
last idea the audience leaves with.

**Two constraints on the line:**

- **The video shows only the true-positive path.** The landing page shows both branches; this
  card cannot lean on the landing page's framing without implying a branch the video never
  showed. Nothing that turns on the false alarm.
- **It is its own beat, not a line inside the end card.** The end card already runs three timed
  events plus a hold; a fourth makes it a wall of text.

**The copy is a PLACEHOLDER at the right length** (`CLOSING_LINE` in the greybox `copy.ts`).
Candidates were proposed in the revision-4 report; Mohamed picks one. Deliberately **not** typed
on — the end card types twice and a third typing effect in eight seconds is a tic. Framed at 760,
the same as the end card, so the two read as one closing movement.

---

### 13 · End card · 1:15 – 1:21 (6s)

**A sequence, not a static frame.** Three timed events:

1. a **reveal animation** for the Serenify wordmark
2. then **"take care of yourself"** types on
3. then **"serenify.tech"** types on

Then hold — **and the hold is a second longer** (5s → 6s). This is where the VO lands its last
line, so the hold is room in the cut rather than dead air.

The wordmark's real animation gets designed later; greybox it as a placeholder and time the
sequence. Typing rather than fading puts a readable pace on the two lines and gives the VO
something to land against.

---

## Running total: ~81s

Well over the 40–60s target. The 77s→81s overrun is the **ending** — beat 11 finally landing its
pull-out, and the new closing card — rather than the no-cut invariant that produced the 69s→77s
one. **Do not trim on paper — trim in greybox**, where you can actually feel what's slow.

**+4s across this revision**, itemised:

| Beat | Was | Now | What changed |
|---|---|---|---|
| 2 · signup | 16s | **15.6s** | −0.4s. The wide hold on the sparse verify screen, shortened rather than filled |
| 3 · dashboard | 5s | **4s** | −1s. The travelling lift tightened; 20 words were never going to be read either way |
| 5 · calibration | 12s | **12.4s** | +0.4s. Reading time for a success state that is no longer cropped |
| 11 · return to ease | 6s | **7s** | +1s. The pull-out lands and holds, so the trend's descent is on screen |
| 12 · closing card | — | **3s** | NEW. The thesis, named once |
| 13 · end card | 5s | **6s** | +1s on the hold after "serenify.tech" |

Beat 1's corrected address-bar radii, beat 3's row-shaped banner, the clock (L11), the emphasis
rule (L12) and its three firings, and the relaid-out reading card all cost **nothing**.

**Trim candidates, in order:**

1. Beat 2, 15.6s → 12s. The performed mail sequence is where the fat is; the OTP choreography is not.
2. Beat 5, 12.4s → 10.5s. 5d recording can lose a second and 5f's hold can lose half of one.
3. Beat 13 end card, 6s → 4.5s.
4. Beat 11, 7s → 6.5s. The music-player sub-beat, not the easing and not the pull-out.

**Protect at all costs:** beat 8 (6s), beat 10's turn 3, the 5b first-sight-of-face hold, and
beat 11's wide hold. Those four are the video.

---

## Open questions for greybox

**Answered:**

- ~~Does the "later that morning" text earn its place?~~ **Yes, but only when it is loud.** See beat 6.
- ~~Does the calibration banner's un-transitioned pop-in read as a glitch?~~ **Yes.** Faded over 6 frames.
- ~~Beat 9 needs the questionnaire's verbatim copy.~~ **It already existed.** See beat 9.
- ~~Beat 7's stateline sub-line is unreadable.~~ **Fixed by the lift (L10), for free.** See beat 7.
- ~~Beat 3's calibration sentence is unreadable.~~ **Fixed by the lift.** No type-scale liberty. See beat 3.
- ~~Beat 1's typed URL is only recognised, not read.~~ **Fixed by the lift.** See beat 1.
- ~~Does the time jump read at all now that "later that morning" is gone?~~ **No, and that is
  decided.** Out of scope; see beat 6.
- ~~Does beat 3's 1.5s hold read a 20-word sentence?~~ **No, and it does not need to.** The lift
  buys legibility, not reading time; the beat was shortened instead. See beat 3.
- ~~Beat 8's punchline has no clock to do arithmetic against.~~ **The clock exists from beat 1 and
  is in the push-in.** See L11 and beat 8.

**Still open:**

- **Which closing line?** Beat 12 ships a placeholder. Candidates are in the revision-4 report; one
  gets picked and lands next revision.
- **Does the closing card land or stall the ending?** Three seconds of held text between the demo
  resolving and the wordmark is either the last idea or a speed bump. Judge it in this pass.
- **Is 81s acceptable, and if not, what goes?** See the trim list above.
- Do the real full-page reloads (`<a href>` / `window.location.replace`) read as broken on video, or as honest? They're real; showing them is more faithful, but a hard white flash mid-video may just look like a mistake.
- Beat 10's three-turn exchange is written for the video; `014-recommendations` doesn't exist. Keep the UI plausible against what 014 will actually ship.
- Beat 10 turn 3 must read as *personal knowledge*, not a canned tip. If greybox shows it reading generic, that's a copy problem to fix before art.
- Does the mail app icon established in 2e survive the ~25 seconds to beat 8 as a recognisable signature? Greybox will show it.

---

## Third-party brands — decided

**Mail client and music player are generic. Billie Jean and Michael Jackson are named on screen. No audio, no lyrics.** Mohamed's call, made 2026-07-29.

The reasoning: naming a track with no audio and no lyrics carries effectively no risk, and the naming is doing real narrative work — it's the proof Ren knew his taste. Drawn Gmail and Spotify interfaces, by contrast, add brand clutter and buy nothing the story needs.

The one cost is that generic UI can't disambiguate itself, which is why beat 2e now has to establish a mail icon that beat 8 can lean on. See the warning in beat 8.

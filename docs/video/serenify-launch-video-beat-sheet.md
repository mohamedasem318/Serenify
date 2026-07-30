# Serenify — LinkedIn launch video · beat sheet v1

**Format:** 16:9, 1920×1080, ~60s. Silent-first — every beat must read with no audio. Egyptian Arabic VO is recorded last, over a locked cut.

**Render viewport:** the product is rendered at a **1200px-wide viewport** and the whole
desktop is scaled **1.6×** to fill the 1920×1080 output (L7). Not a 1920px browser with
384px of dead gutter each side.

**Pipeline:** real `apps/web` React components for every product screen. Drawn assets only for: the character, the Gmail tab contents, the macOS notification, and the end card.

**The character is a RIG, not a set of drawings** — and the art brief is therefore **one**
neutral head and shoulders rather than five expressions that all have to read as the same
person. See "The character rig" below. Cross-expression consistency is the thing that burned
the wordmark across four attempts, and the rig removes the need for it.

**The character's art has landed** (2026-07-30): a stripped Avataaars base, MIT, with the
rig's authored primitives drawn over it, an authored torso under it and an office backdrop
behind it. Everything else inside the viewfinder — headphones, drifting notes — is authored
too.

**EVERY PRODUCT SURFACE IN THE FILM IS A SHIPPED COMPONENT.** The landing hero and public
navbar, the signup fields and their live password checklist, the consent acknowledgement, the
OTP boxes and their whole 2.94s merge, the dashboard's two banners, the camera gate, the
calibration flow, the monitoring stage, the confirmatory prompt, Ren's chat, and the wordmark on
the end card. What is still drawn is the film's **non-Serenify furniture** — the browser chrome,
the mail client, the music player, the notification — and that is deliberate; the assets pass
owns it.

**THE FILM IS DARK, AND THE PRODUCT SURFACES ARE REAL COMPONENTS.** `apps/web` has had a
designed dark mode from the start — a full token swap under `:root.dark` — so this is the app's
own theme rather than an approximation, and **no Serenify surface in any beat lacks a genuine
dark variant.** The monitoring page, the calibration flow, the confirmatory prompt and Ren's
chat are now the real components, in dark, framed against measured geometry. The non-Serenify
furniture — browser chrome, the mail notification, the two closing cards — has no dark version
to inherit and was authored; it carries **its own token block, deliberately decoupled from the
app's palette**, because a browser is not part of Serenify and must not move when the product's
palette does.

**Framing is now measured, not fitted.** `video/src/SwapProbe.tsx` renders the real components
at the real 1200px world and prints their bounding boxes; `video/src/app/geometry.ts` holds
those numbers and `framing.ts` derives every shot from them. Three consecutive revisions logged
crop complaints and all three traced to framing tuned against greybox rectangles. That is what
this pass ends.

**AND THE FILM SETS IN THE APP'S OWN TYPEFACE.** `apps/web` gets Inter and Outfit from
`next/font/google`, which is a build-time mechanism with no counterpart in a Remotion bundle —
so `--font-sans` and `--font-display` resolved to nothing and **every real component silently
fell back to `system-ui`**. That single fact is most of why the film read as greybox even on the
beats that were already using real components: the components were real and the letters were
not. `video/src/fonts.ts` registers both families under exactly the names `globals.css` asks
for, each behind its own `delayRender` handle, so a frame cannot be screenshotted before the
bytes are in. Nothing overrides a token; the app's typography becomes correct by the families
existing. The authored furniture takes **Inter** (a browser is not Serenify, so it does not wear
Outfit — that rule is intact) and **Geist Mono** for the omnibox and the clock.

**Every interaction has a visible cause.** A cursor travels to each control and clicks it, with
the component's response following the click — `video/src/app/pointer.tsx`. The component pass
had lost it, and the film read as a sequence of screenshots of software rather than as someone
using it; the confirmatory prompt was the clearest case, where a focus ring arrived on "Yes,
that's me" with nothing touching it.

What remains unfinished is listed in **the deferred register** at the end of this file.

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
| L1 | **Viewfinder is scaled up** from the app's 224×126px to 320×181 | At true size his face is a smudge on a phone. The emotional core of beat 8 requires a readable face. **Measured against the real component (2026-07-30): it grows from its TOP-LEFT.** The real viewfinder is an `absolute … z-10` overlay inside the stage card and its left edge sits at world x 743 against the bloom's right at 744; the bloom's gradient is fully opaque out to x 669, so growing from the top-right — its anchor in the app — covers the bloom's solid core, and beat 7's whole job is to plant bloom, stateline and viewfinder together. Growing from the top-left spends the enlargement on the empty page beside the card instead. It also has to be parented one level out of the card, which carries `overflow-hidden`. |
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
| L12 | **The in-place emphasis** — the stateline block grows **1.25×** where it stands, is read, and settles. Nothing travels, the camera does not move | A separate landing on the block was priced at ~1.5s; this is **free**, because camera travel is what costs time. **It is a rule, not a budget** — see the invariant below. **The factor fell from 1.65× at the component swap, and that is register item 3 resolving.** 1.65 was derived against a composite framing of ~1096 world px, where the sub lands at 6.5px on a phone. The real composite is **760** — the real viewfinder sits inside the stage card rather than 300px to its right, so the union is far tighter — and at 760 the sub already lands at 9.4px. The factor needed for legibility alone is 1.064×, which is not a device. 1.25× is set by two measured clearances instead: the block grows downward from its own top edge (so the bloom is untouchable by construction) and finishes 11.1px clear of the real Pause/End controls, with the sub at 11.8px. At 1.65× it would run through the controls and out of the frame. The device survives as grammar; only its amplitude yields. |
| L14 | **The monitoring surface is REARRANGED for the film** — viewfinder to the right, the bloom with its stateline and the trend to the left, as the greybox had it. **Pass B builds this; nothing in Pass A implements it.** | The real dashboard puts the top of the bloom and the bottom of the trend **664.2px apart in a 519px viewport**, so they cannot share a frame at any scroll and at any framing — 145px short. The component pass resolved it with a travelling camera at the moment beat 11 should be settling, which is the one place in the film a camera move is most expensive. Rearranging the columns is a knowing departure from the app's real layout, taken because the alternative is a camera move where the beat wants stillness. **It also buys back the two things Pass A had to concede.** Beat 8's `tense` stateline wraps to two lines, and a two-line block cannot take L12's 1.25× raise at this layout without either leaving the viewport or landing on the Pause/End controls — the arithmetic is scroll-invariant, so the emphasis yields to ~1.01× on that one copy. And beat 4's privacy line and its CTA miss sharing a frame by 11.8px. Both are the same shortage of vertical room, and a column layout is what has it. |
| L13 | **The character's face is AUTHORED, not drawn** — features are primitives driven by numbers, over one generated head, with an authored torso behind it | The rig has to produce a *fall* and a *nod*, and neither can come out of cross-fading finished drawings. Authoring the features also collapses the art brief from five consistent expressions to one neutral head, which is the risk that actually matters. See "The character rig". |

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
  - **The movement must be CAUSED by the change, not merely near it.** This is what regressed:
    beat 8 raised at f142, eight frames *before* its first copy change and while the camera was
    still arriving, then never settled — one movement, attached to nothing, and the second
    change carried none at all. Beat 11 did the same eight frames early. Each raise now begins
    **on** its copy change. A raise that precedes the change teaches the audience the opposite
    of the rule.
  - **No yo-yo.** Beat 8's two copy changes land seconds apart, so the block goes up
    **once** and settles once. Never grow, settle, and grow again.
  - **AND THE AMPLITUDE IS CAPPED BY THE ROOM THAT EXISTS.** L12's 1.25× was derived against a
    ONE-LINE sub. `tense`'s sub is 62 characters at `max-w-[42ch]` and wraps to **two**, and a
    two-line block cannot be raised here without either leaving the viewport or landing on the
    Pause/End controls — the raised bottom is 20.75px below the controls' top at *every* scroll,
    so no scroll fixes it. `emphasisCapFor()` re-derives the factor per copy: 1.25× for one
    line, ~1.01× for two. **The collapse IS the second firing** — beat 8 raises on its first
    change and the block settles as the second lands, so both carry movement and nothing
    yo-yos. It also fixed a defect the emphasis merely made worse: the two-line `tense` sub was
    being sliced by the page viewport *at rest*, which is why `SCROLL.monitor` moved 32 → 40.
    **Getting the raise back on `tense` is L14's job.**
  - **It must never cover the bloom.** Beat 7's job is to plant bloom, stateline and
    viewfinder together as the "before". So the block grows *downward* from its own top
    edge rather than about its centre, and the reading card was relaid out to make the room
    below: the card is 40px taller and the trend sits 76px lower.
- **EXPRESSIONS ARE TRANSFORMS ON SEPARABLE PARTS, NEVER DRAWINGS CROSS-FADED.** Beat 8 needs
  the face to *fall* and beat 11 needs a nod; a cross-fade between two finished drawings
  produces neither — on a face it reads as a jump cut. An expression is a vector of numbers,
  and every transition is an interpolation between two points in that space. Same model as
  Ren's avatar. See "The character rig".
- **HE NEVER STOPS WORKING.** In beats 7, 8 and 11 he is typing. He stops
  once, to read the email, and resumes in beat 11 *while* the reading comes down. Carried by
  the shoulders' typing motion, the nod, the drifting notes and the trend's descent — the two
  drawn hands that used to say it are cut; see "The character rig". This is not
  a flourish: without it beat 11 reads as the stress app telling an employee to listen to
  music instead of doing an urgent report, which is the worst available misreading and the
  audience is managers.
- **No red anywhere.** Attention = foggy. Stress = amber. Affirmative = meadow.
- **No numeric stress value, ever.** No percentage, no score, no gauge. The bloom carries no number.
- **The confirmatory questionnaire shows the TRUE-POSITIVE branch.** The landing hero shows the false alarm. This inversion is intentional.
- **Copy is verbatim** from the app. Typographic apostrophes (`’`) preserved. Where a beat is too short to read full copy, push in on a fragment — do not paraphrase.
- Several transitions in the real app are **full page reloads** (camera Permissions-Policy). Whether to show those honestly or smooth them is a greybox question, flagged below.

---

## The character rig

**De-risked 2026-07-30, with no art.** Two risks were travelling under one name — whether a rig
can produce the motion the beats require, and whether we can get good consistent art — and the
second was making the first look frightening. The first is now settled: a face made of
primitives **does** carry beat 8's fall, at the real timings, at phone size, in the cut. Studio
composition `CharacterRig` under `Spikes` is the bench; `video/src/greybox/rig.tsx` is the rig.

**And the art landed the same day, onto the unchanged rig.** The thirteen-number decomposition,
the named expressions and the interpolations are exactly as they were built; what changed is the
drawing underneath them. The base is a stripped [getavataaars.com](https://getavataaars.com)
export — **MIT**, Pablo Stanley — at `viewBox 0 0 264 280`, transparent, keeping skull, hair,
ears, neck, nose and a `#25557C` crew neck, and shipping with **no brows, eyes or mouth**
because the rig draws those. Provenance, the licence text and the measured landmark table are
in `video/src/greybox/character/NOTICE.md`; the decision is in `docs/DECISIONS.md`.

**The primitives follow Avataaars' grammar, not the crude rig's, and this is the constraint
that mattered most.** Avataaars has **no sclera** — every facial feature in that system is
`#000000` at a fill opacity, and `Eyes/Default` is two filled r-6 circles and nothing else. The
crude rig drew large white eyeballs with small dark pupils; porting that design onto the new
base would have produced the same cartoon on better art, which is the one outcome that makes
the swap pointless. So the brows are filled leaves (pointed at both ends, thickest in the
middle) rather than stroked lines, the mouth is a filled crescent, and an eye is a dark iris
**clipped by its lids** — `Eyes/Default` when open, `Eyes/Squint` when narrowed, the same shape
at two values, so it interpolates. The Avataaars expression presets were used as **shape
reference only**; they are discrete drawings and cross-fading them is exactly the jump cut the
rig exists to prevent.

**The character is sized against the viewfinder's inner box, never against absolute values.**
The rig picks a framing window in the base's own coordinates and hands it to an SVG viewBox, so
the same component fills the 16:9 viewfinder and beat 5's 3:4 portrait preview with no second
set of numbers — and will re-fit whatever inner box the real component turns out to have.

Two corrections to the handover notes, both load-bearing: **the ears exist** (baked into the
skin path, centres at (71, 117) and (193, 117), five pixels *below* the eye line — headphones
hung on the eye line ride visibly high), and **the shoulders needed authoring rather than a
scale transform**, since scaling the shirt scales its crew neck with it and gives him a boat
neck.

**The shoulders are anthropometric, not compositional**, and that is the fix for a pair that
spanned the whole framing window on a nearly flat arc — a distant horizon rather than a pair of
shoulders. Two numbers, both taken from a body rather than from the frame: a **span of 2.7 head
widths** (the skull is 112 units wide, so the shoulders are 300 across) and **49 units of drop**
from the collar corners to the acromion over 116 of run, about 23°. Below that the outline turns
down into the upper arm and leaves frame. The consequence is deliberate and is not a regression:
at a framing where
the head fills two thirds of the height, real shoulders occupy about 70% of the width and a
band of room shows at each bottom corner. They run off both edges only where the crop is
narrower than they are — beat 5's 3:4 preview, which is what a portrait crop should do. The
outline traces the shirt's **own neckline**, control point for control point, so the authored
torso and the base meet along the crew neck with no seam to hide.

**An expression is a vector, not a picture.** Thirteen numbers — brow height, brow inner-end
angle, eye aperture, lid drop, gaze, mouth curvature, mouth width, mouth openness, mouth skew,
head tilt, head sink, shoulder slump, breath rate — and each named expression is a point in that
space. Transitions are interpolations, which is the only way a *fall* and a *nod* exist at all.
Expressions are keyframed exactly as camera shots are.

| Part | What it carries |
|---|---|
| head | the nod, the sink, the tilt |
| brows | the fall, more than anything else does |
| eyes | aperture, and the blink at rest |
| pupils | gaze — down at the keyboard when he is working |
| mouth | one curvature scalar, plus width, openness and skew |
| shoulders | slump, and the typing motion |
| headphones | an overlay on the ears, beat 11 only |

The hair, the ears and the neck are **not** animated. They come from the base, and the ears are
where the headphones attach — the cups sit on the measured centres, and the **band crosses the
crown**, above the hairline. It used to cross the fringe most of a forehead lower, which from
the front reads as a band across his face; the framing window gained twelve units of headroom
to buy the room. They are also **muted grey, not near-black**: at black they were the highest
contrast object in the frame, on the one beat where the relief is supposed to land on his face.

**The hands are cut.** There were two, at the bottom edge, alternating. Widely separated blobs
read as detached objects rather than as forearms; they are below legibility at the wide
composites where beat 11 actually resolves; and narrowing the shoulders did not rescue them, it
moved them onto his chest. **"He never stops working" is unaffected as an invariant** — it is
carried by the shoulders' typing motion, the head nod, the drifting notes and the trend walking
back down while the music plays. It also removes a smaller wrong thing: hands at a keyboard
during a *calibration*, where the instruction is to sit still for a baseline.

**What the head must provide** — the art brief, and the delivered base meets every line of it:

- **One drawing. Neutral expression, mouth closed, eyes open, front on**, at the framing a
  webcam gives: head and shoulders, head filling ~66% of frame height, shoulders at human
  proportion across ~70% of the width. Nothing below the chest.
- **Separable layers, and this is the load-bearing requirement.** The face's *features* are not
  drawn: the delivered art supplies **skull, hair, ears, neck, shoulders/clothing** as separate
  regions, and the rig draws brows, eyes, pupils and mouth over them. A head delivered with its
  features baked in cannot be posed and is not usable.
- **A flat skin region large enough to host the features** across the eye band (roughly the
  middle third of the head's height) and the mouth band (lower third), free of texture, shading
  gradients or drawn detail in those two zones. Shading elsewhere is fine.
- **Transparent background.** The office backdrop composites behind it and is **authored in
  code, not sourced** — unDraw was the fallback and was not needed, so no third-party licence
  entry was incurred. In the wide composites the whole viewfinder is about 123 × 69px on a
  phone, so it has to read as "an office" at very low fidelity, where any real detail becomes
  noise behind the character. It is **static** and it never animates. Two requirements on it,
  both of which the first version failed:
  - **Office-coded, not room-coded.** A wall, a mid-height band, a large field below it and a
    framed picture reads as **headboard and mattress** — every element was generic-room, and
    generic-room defaults to bedroom. It is now three things that only exist in a workplace: a
    **window with venetian blinds** running off the top edge, the **back of a monitor** on its
    stand running off the right, and a **desk line** low in the frame. A picture frame does no
    work here; it hangs in any room ever built.
  - **It has to recede**, because at the tight framing it was competing with the face and the
    face has to win. Muted warm neutrals at 6–11% saturation, the whole palette inside ten
    points of lightness so no edge in it is stronger than the hair's or the shirt's — and
    everything except the wall is **blurred**, which is what a webcam does to a background two
    metres back. Depth of field, not a softening effect. **No red, no saturated green, no
    amber**, because those three carry band meaning in this product and a backdrop wearing one
    looks like it is asserting a reading.
- Landmarks the rig needs to line up against: **eye-line height, inter-pupil distance, mouth
  centre, chin, ear centres** (the headphones attach there). Any consistent proportion works;
  the rig scales to it.

**Tracing risk — retired, never paid.** The flag assumed a raster illustration that `potrace`
would have to posterise and trace once per colour, registering the layers against each other.
The base arrived as **vector** with its regions already separate, so there was nothing to
trace. The argument the flag rested on still held up though: the parts that had to be crisp and
separable are the parts the rig draws.

**Two adjustments the base needed**, both flagged in the handover and both applied: the nose's
`fill-opacity` was raised from **0.16 to 0.27** (against the mouth's 0.7 it was four times
fainter and did not read), and the shoulders were replaced by the authored torso above.

**One facial-coding error, found and fixed.** `tense` used to be brows *down and drawn
together* over a flat pressed mouth — which is the **anger** configuration, and it read as
anger. The direction of the inner brow is the whole difference: inner ends raised is sadness
and worry, inner ends pulled down is anger. `tense` is now the **same shape as `dismayed`, one
degree deeper** — inner ends still raised and slightly higher, corners further down, the jaw
closing as the shock settles into a held state, eyes a fraction wider, head lower, shoulders
sinking twice as far. That gives beat 8 two readable intensities of one emotion under its two
stateline steps, so the face escalates alongside the UI instead of leaving it to the copy, and
the travel between them is a settle rather than a second fall. **`tense` must never use lowered
inner brows.**

**Face size, measured rather than estimated.** At beat 8's tight framing (615px of world, the
composition's tightest) his head is **~80px crown-to-chin on a 422px phone**. Head size is set
by the framing window's height against the viewfinder's, not by the shoulders, so narrowing
them cost nothing; the twelve units of headroom the headphone band needed cost about 2%. The
lever if it ever has to be bought back is **L1's viewfinder size**, and only against a measured
figure.

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

**The page is the real landing page**, and the shot follows it: the greybox's centred 640-wide
block does not exist at any viewport ≥ 1024, so the beat frames the measured **copy column**
(510 wide at x 64, headline at 67.2px) rather than the gap between two columns. The frame is
shifted left so `<StoryCard/>` stays out of it — at the centred position it caught 64px of the
card including a sliced line of its narration, and a sliced line of text is always a failure.
What it gives up on the left is page background the camera's own backdrop matches exactly.

**And the omnibox reads.** Its text was `OS.label` — recessive by design for a URL nobody reads,
which is the wrong treatment for the one URL in the film the audience watches being typed. While
lifted it takes `OS.clock`, the one furniture value allowed to clear the ramp's lightness band,
in Geist Mono; seated afterwards it drops back to `OS.label`. That is the same treatment a
browser gives a focused versus an unfocused address bar.

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

**⚠️ THE READING PANE MUST BE EMPTY UNTIL THE MESSAGE IS CLICKED.** The beat is "he opens the
email and finds the code", and a click that reveals something already on screen reveals
nothing. The greybox currently shows a ghost of the message body before the click. **This is a
requirement on the drawn mail client, which does not exist yet — it is recorded here and the
greybox ghost is deliberately not fixed**, since the asset that fixes it is a page-level drawn
asset and goes with the components pass. Applies here and again at beat 8. Deferred register,
item 1.

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

~~**Do not dress the greybox verify screen.**~~ **There is no greybox verify screen.** It is the
real "Check your email" state with the real OTP panel inside it — the heading, the helper text,
the `Code for …` line, the boxes, the pill and the reserved slot the muted note fades into. The
note about not dressing it was correct while it was drawn and is now moot; the shortened wide
hold stands.

**THE BEAT SCROLLS, BECAUSE THE FORM DOES.** The `(auth)` column is **818.5 tall in a 583px
viewport**, so the consent row and the submit button are genuinely below the fold and the 2b–2c
pan travels to them behind a page scroll of 145. That number is bounded on both sides and
neither bound is taste: below ~135 the submit's own bottom edge is still under the fold and the
pan lands on a sliced control; above ~150 the "Already have an account?" footnote rises into the
viewport and is sliced by it.

---

### 3 · Dashboard, first arrival · 0:21.6 – 0:25.6 (4s)

He lands on `/app`. Uncalibrated.

**Arrives by pulling out, not by cutting.** After "Taking you in…" the camera pulls back from
the OTP row and the dashboard is simply what is there when it gets wide. Then the two things
that matter:

- **Welcome banner:** "Good morning, [name]" · "A space to check in with yourself." **The
  greeting is generated, not written** — `<WelcomeBanner/>` derives "Good morning" from the hour
  and the first name from `fullName`, so the beat passes a fixed `now` of 10:23 and the component
  produces "Good morning, Youssef" itself. The internal clock and the greeting can no longer
  disagree, because only one of them is a string.
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

### 4 · Camera consent gate · 0:25.6 – 0:31.6 (6s)

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

**⚠️ THE FRAMING NOTE ABOVE IS WRONG, AND THE REAL COMPONENT IS WHAT SHOWED IT.** "One landing
holds the key line's card AND the button" rests on the privacy pitch being in the card nearest
the CTA. It is not. It is `CAMERA_GATE_WHAT_HAPPENS[2]` — **the third bullet of the FIRST card**,
"What happens to the video", 550px further up the page. The greybox drew it in the last card
because that is what this sheet said; the first render after the swap landed squarely on "What
declining changes", which is a real card, correctly rendered, and the wrong one.

**And the two miss sharing a frame by 11.8px.** Key-line top to Allow's bottom is 594.8 against
a 583px viewport. It is the closest near-miss in the film and it is still a miss — no scroll
closes it. So the beat takes **two landings inside its one continuous move**: the key line
alone at 566 world px, where its 17px copy reads at 12.7px on a phone, then a scroll-and-pull
onto both controls for the click. That is this sheet's own remedy for this class of problem,
applied once more.

**Cost: 5s → 6s**, and it is the second landing. The beat had five seconds for four events on
the assumption the last two shared a frame. **The vertical room L14 buys back is what would
collapse this to one landing again.**

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
| 5d | 0:38–0:40 | **Recording.** The breathing orb pulsing over his softened preview, label alternating **"Breathe in" / "Breathe out"**. The 6px meadow progress bar advancing beneath. **Show ~2s of a 60s process** — this is the most aggressive compression in the video and it's fine, the orb's rhythm sells the idea instantly. |

**5d WAS SHOWING THE ACCESSIBILITY VARIANT AND CALLING IT THE PRODUCT.** The label read
**"Breathe gently"**, which is not invented copy — it is `STATIC_LABEL` in
`components/anchor/breathing-guide.tsx:32`, what a user who has asked their OS for less motion
sees (FR-032). The reduced-motion shim that lets every component render frame-exact had picked
it, and with it the discs held perfectly still. The shipped full-motion orb scales its discs
`[0.84, 1.12, 0.84]` on an 8s loop and **alternates the pacer every four seconds**, which is
what this row asked for all along and what the greybox showed. Both are re-authored from the
frame on the component's own numbers.

**Two more things this found in the same place.** The breath was being applied to the WRONG
element — the monitoring bloom's 6.5s loop was scaling the whole 512×288 preview box, feed,
character and framing brackets together, while the orb sat still; two components' motions had
been crossed. And **the capture progress bar was missing entirely**: `anchor-recorder.tsx:628`
renders `<CaptureProgressBar/>` hugging the preview, this reproduction of the layout had dropped
it, and the mm:ss readout lives in the controls card *outside* 5d's framing (FR-031 keeps status
words off the raw video) — so nothing on screen said time was passing and the beat cut to
"Setting your baseline…" out of nowhere. The bar is back, and it is the real component.

**The orb's PERIOD is the one thing staged.** The timer and the bar take the beat's 30×
compression directly, because a counter running fast reads as a counter running fast. The breath
cannot: at 30× the discs flutter four times a second and the pacer strobes, which is the one
thing on screen that would contradict the word "calm". At the real 8s cycle a 2s window shows a
quarter of one breath and the label never changes, so the pacer's whole nature is invisible. So
the cycle is the length of the window — **one complete breath, in and out, inside the compressed
minute**. Shape, amplitude, easing and copy are all the component's; only the period is staged.
| 5e | 0:38.6–0:40 | **Uploading.** The capture stage is **replaced** by the line, verbatim from `components/anchor/anchor-recorder.tsx`: **"Setting your baseline — one calm moment…"** |
| 5f | 0:40–0:43 | **The camera PULLS OUT, then he clicks.** The bloom ripple, the check drawing itself, and the real success state from `components/anchor/success-state.tsx`: **"Your baseline is set"** (`text-3xl sm:text-4xl`) · "We’ve learned what calm looks like for you. You can update it anytime from your account." · the **"Back to home"** button. All three are in frame, all four edges inside it, *before* the click. Then he clicks, and lands on the dashboard. Beat 6 continues from that frame. |

**5e/5f corrected.** The earlier version covered the viewfinder with a success state and then cut
to the dashboard, skipping the uploading line, the real success copy and the click. All three are
part of the chain and the click is a real action.

**5f's framing corrected too.** The success state used to appear eight frames *before* the
pull-out began, so its own payoff played cropped for about a second and the click followed 0.7s
after the camera finally landed. The order is now: the line resolves → the camera pulls out to
hold the whole state → it is read → he clicks. The +0.4s is reading time for 16 words at 16px.

**AND THE PUNCHED-IN READ IS EXPLAINED — register item 4, done.** It is one number. The
component measures **448 × 346.9**, and its ripple (`components/anchor/success-state.tsx:30-36`)
scales a `size-24` badge to **2.1**, reaching (96 × 2.1 − 96) / 2 = **52.8px past the badge on
every side**. The badge sits only 24px below the component's own top edge, so **the ripple
crosses that edge by 28.8px**. Every previous framing measured the component and cropped the
ripple, so the payoff played with its own bloom clipped by the frame — which looks exactly like a
shot that is too tight, because it is one. The shot now frames the component grown by the
ripple's real overshoot on all four sides.

**Shot note for 5b:** this is the audience's first look at your protagonist's face. Give it a real hold. Everything in beats 7–11 depends on the audience having learned this face while it was calm.

**THE PREVIEW IS 16:9, AND THE LIBERTY IS RETIRED.** Register item 5, done. The real component
is a full-width **`aspect-video`** box — **512 × 288** in its `max-w-lg` column
(`components/anchor/anchor-recorder.tsx:570,578`) — with a **3:4 bracket guide floating inside
it** at **168.5 × 224.6** (`components/anchor/framing-overlay.tsx:82`, `aspect-[3/4] h-[78%]`).
The *bracket target* was always genuinely 3:4, so 5b was faithful to it; the *box* never was.

**The old framing note is gone with it.** It capped the preview at 240 wide so the preview and
the status line could be held together; at the real 512 that cap is meaningless, and the
composite is governed by the real green-room card below the box instead.

**And the change lands the centering nudge harder, for a measurable reason.** The bracket target
is only **33% of the box's width**, so where he sits in frame is now a visible fact about the
shot rather than an inset inside a portrait box his face already filled.

---

### 6 · "Later" · 0:43 – 0:45 (2s)

Continues straight from beat 5, which now lands on the dashboard itself. The calibration banner
is gone — that absence is the beat's visible content — and he clicks **"Start check-in"**.

**It is the SAME component as beat 3 with one flag off**, which is what makes the absence read:
the `space-y-10` column closes up and everything below the missing banner moves up by 126,
exactly as the product does when `has_anchor` flips. A separately-drawn "beat 6 dashboard" could
not have produced that, and would have drifted from beat 3 the first time either was touched.

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
- The viewfinder (L1, enlarged), showing him **content and lightly smiling**, working — gaze
  down at the keyboard, shoulders carrying the typing. This is the face beat 8 has to fall
  *from*, so it is held rather than played.

Wide enough to hold bloom, stateline and viewfinder together. This is the "before" — the audience needs it registered so the fall lands.

**The first firing of the in-place emphasis (L12), and it costs nothing.** The emphasis is free
because it needs **no camera travel**: the block grows where it stands while the camera holds
the composite. The rise and the settle both fit inside the 4s the beat already had.

**THE REAL COMPONENTS MADE THIS SHOT TIGHTER, AND EVERYTHING FOLLOWS FROM THAT.** The greybox
framed ~1096 world px because it drew the viewfinder as a separate 320-wide panel 300px to the
right of a 700-wide card. The real viewfinder is an overlay INSIDE the stage card, so the union
of bloom + stateline + viewfinder is far tighter and the composite is **760** — a 1.58× push-in
rather than a 1.09× one. Measured consequences, all improvements:

- the 17px sub lands at **9.4px** on a phone instead of 6.5px, and **11.8px** raised
- **the emphasis therefore yields, 1.65× → 1.25×** (register item 3; see L12 for the arithmetic)
- his head is **~66px** on a phone here, against the ~50px this sheet recorded
- **the layout is the product's own** — register item 2. Nothing is padded: the card is
  `min-h-[480px] … px-10 pb-10 pt-16`, the bloom is `sm:size-72` (288, where the greybox drew
  148), and the real `mt-6` puts 24px between the bloom's bottom and the stateline's top. The
  emphasis grows downward from that top edge, so it cannot reach the bloom by construction
  rather than by arrangement.

**The page sits scrolled 32px, and that is the page's behaviour rather than a device.** The real
monitoring page is ~973px tall below the chrome against a 583px viewport, so it scrolls in the
product too. 32 is the intersection of two measured constraints: below it the stateline's sub is
clipped by the viewport bottom, above it the sticky header swallows the `Session · 47:12`
readout.

**It settles HERE rather than handing the raised block to beat 8.** The intent was to carry it
across the join, but beat 8's push-in frames from world x 708 and the raised block's right edge
is at x 800 — a raised block put 92px of panel and a sliced word inside the video's single most
important shot. The framing does not allow the join, so the join is not forced; beat 8 raises its
own, once, covering both of its copy changes. That is the constraint that matters.

**RESOLVED:** the revision-2 open decision on beat 7's sub-line.

---

### 8 · The email · 0:49 – 0:55.7 (6.7s)

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
single framing does both**, and the reason is geometry rather than craft. So it is split across
the one continuous move the beat already had. What is given up: at the wide framing the toast is
present but not readable. That is the right thing to lose — it was read seconds earlier at 4.2×,
and after that its only job is to still be up while the reading falls.

**AND THE SPLIT GAINED A THIRD POSITION AT THE COMPONENT SWAP.** Measured, and it is the one
framing the real geometry forced. A single tight shot holding clock + toast + face is **794.7**
world px wide, at which his head lands at **63px** on a phone — against the ~80px the register
accepted and the ~100px this sheet quotes for the fall. The cause is pure geometry:

    the clock is browser chrome at            y  58
    the real viewfinder is a card overlay at  y 277   (the greybox drew it at y 200)

Any shot holding both spans 399px of height and 16:9 charges ~795px of width for it. Those 77px
are the whole difference, and they exist because the real page has a 64px app header, a 32px main
pad, a 44px readout row and the card's own 64px `pt-16` above the viewfinder.

**So the beat takes three landings instead of two — still one continuous move, still no cut**,
which is this sheet's own remedy for this class of problem applied once more:

| | frames | width | what it holds | what reads |
|---|---|---|---|---|
| **clock** | f30–f68 | 460 | clock + toast | clock at **25.7px**, subject at **12.8px** |
| **face** | f80–f118 | 565 | toast still up + his face | **THE FALL**, head at **88.7px** |
| **wide** | f150 on | — | the whole card, viewfinder, toast | both stateline changes, one raise |

It is strictly better than the greybox on both numbers the beat cares about: **the clock reads at
25.7px instead of ~19, and the face falls at 88.7px instead of ~80.** The clock, the toast and
the viewfinder still share a right edge — **1063** rather than 1176, because the real viewfinder
cannot reach 1176 without covering the bloom, so the stack moved rather than the viewfinder.

Sequencing matters here: let the **toast land and be read first**, then his face reacts, then the bloom moves. The order is what makes it cause-and-effect rather than three things happening at once.

Then, in one continuous shot with the toast still up:

1. He reads it. **His face falls** — 16 frames of continuous travel through the whole pose
   vector at once, and **it happens at the TIGHT framing**, where his head is ~100px on a phone.
   He also stops typing here, and does not start again until beat 11.
2. The **bloom drifts** meadow → mixed → amber. The real transition is 1.3s ease, so a band change *drifts rather than snaps* — keep that, it's the honest behaviour and it looks better.
3. The stateline changes: **"You're a little tense"** · "A bit of an edge lately. Maybe a slow breath."
4. Then further: **"You're feeling tense"** · "This has held a while. Serenify can check in when you're ready."
5. The trend line below climbs and recolours.

**THE ESCALATION WAS TWENTY FRAMES LATE AND THE DRIFT WAS OFF SCREEN.** Both defects were the
same thing twice — *the reading changed while nobody could see it*:

- The drift ran f104–f143, and the bloom does not enter the frame until the camera has widened
  to about f128. The audience met an already-amber bloom, and "let it drift, don't snap" was
  being spent behind a tight shot. It begins at **f116** now and its last two thirds play in
  frame.
- The stateline changed at f150 and f176 while this sheet, and the beat's own header, both said
  f130 and f156. The code had drifted twenty frames later than the plan, which put a dead second
  between the fall settling and anything else moving. The changes land at **f138 and f164** —
  f138 being the earliest the stateline is genuinely inside the widening frame, checked against
  the camera rather than assumed.

**The emphasis fires on the first change and settles as the second lands.** The previous cut
raised it at f142, before the first change and during the camera's arrival, and never settled —
so neither change carried movement. It still goes up **once** and never grows twice; what
changed is that the settle is now doing work rather than being skipped. The `tense` copy's
two-line sub is why the settle is available at all — see the invariant and L14.

**Do not rush this.** It is the largest single allocation in the video and it's correct — this beat is the entire product thesis in one shot.

**Cost: 6s → 6.7s, and the character rig is what found it.** The camera used to arrive tight and
begin pulling out immediately, so by the time the face fell the shot was already ~930px wide and
his head was ~45px on a phone: the fifteen most important frames in the video were playing at the
width where a face reads least. It was invisible while the face was a labelled grey box. The tight
framing now **holds** through the fall, and the extra 20 frames are what keeps the second stateline
change readable rather than paying for the fall out of it.

---

### 9 · Confirmatory questionnaire · 0:55.7 – 0:58.7 (3s)

The sticky confirmatory prompt appears beside the stage. He answers — **and confirms the stress is real.**

**This is the true-positive branch.** The landing page hero deliberately shows the false-alarm branch. That inversion is intentional and must not be reconciled.

**He clicks it, and the click has a cause now.** A focus ring arriving on "Yes, that's me" with
nothing touching it reads as a stray keyboard focus rather than as a person deciding, which
inverts the one beat whose entire subject is *he was asked and he answered*. The pointer travels
to the option and presses it.

It is drawn in SCREEN space, outside the camera, and that is forced rather than chosen:
`<Notification/>` portals to `document.body` and is `fixed right-4 … bottom-[…]`
(`notification.tsx:186`), so it resolves against the 1920×1080 output frame and is outside the
camera's transform entirely — a wrapper cannot move it, because the portal escapes the wrapper.
**That is also why the prompt sits bottom-right of the frame regardless of where the camera is
looking**, which is the known framing complaint; Pass B owns it. What is fixed here is only that
the click has a cause.

**RESOLVED — the copy exists and is signed off.** `apps/web/components/questionnaire/confirmatory-prompt.tsx`:
title **"Checking in"**, body **"Your signals have looked tense for a little while. Is that how
you're feeling?"**, options **"Yes, that's me" / "No, I'm okay" / "Maybe — talk about it"**. He
picks the first. Nothing to recon.

**Cost: 4s → 3s.** The read is quick and 4s sat on a read the audience had finished two seconds
earlier. The prompt lands, then the click follows.

---

### 10 · Ren · 0:58.7 – 1:05.7 (7s)

The chat opens. **A real three-turn exchange, each message legible.**

Ren's drawn avatar (PR #221), **enlarged (L8)** and **in frame for the entire exchange** — every
landing is a union of the avatar and the message being read, so the avatar never leaves. It is a
character drawn specifically for this; letting the camera follow the messages and drop it after
turn 1 wastes it.

**THE AVATAR IS IN THE CONVERSATION HEADER, NOT ON THE BUBBLES — corrected against the real
component.** This sheet asked for it anchored to each Ren bubble, reasoning that the squared
`rounded-bl-sm` corner is where it would sit. **The real surface does not work that way**:
`<RenAvatar/>` lives in the conversation header beside the name and "here to listen"
(`components/chat/chat-shell.tsx:385`), and the bubbles carry no avatar at all.

That is better for this beat, not worse. The header is on screen for the **entire** exchange by
construction, so L8's enlargement is never lost after turn 1 — which is the requirement the
bubble-anchoring was trying to meet. And ownership stops depending on a pairing the audience has
to infer: the header states "Ren" in words, and the bubbles keep the app's own conventions —
Ren `self-start`, bordered `bg-surface`, `rounded-bl-sm`; he `self-end`, filled `bg-foggy`,
`rounded-br-sm`; both `text-[15px]`, `max-w-[74%]`. Ownership is unambiguous at a glance because
it is written down, not drawn.

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
| 2 | **Him** | Complains. Short, human, **and it TYPES ON**. The deadline, the thirty minutes. |
| 3 | **Ren** | Suggests putting on Billie Jean — **because it knows he likes MJ.** |

**Turn 3 is the beat that sells the product** and it needs to land as *personal*, not generic. The whole difference between Serenify and a wellness app that says "try deep breathing" is that Ren knows this specific person. If the audience reads turn 3 as a canned suggestion, the beat is dead. Whatever the final wording, it must make clear that Ren knew this about him already.

**HIS MESSAGE IS PERFORMED IN THE COMPOSER — RESTRUCTURED.** It used to type directly into a
bubble that did not exist yet, and the text bled out of it. The bleed was a symptom; the real
problem was that **the beat showed the result of an action instead of the action**, which is the
one thing the one-take invariant exists to prevent and the same note this sheet already applies
to tabs, clicks and scrolls everywhere else. So the beat does what a person does:

    f36   the cursor moves to the composer at the bottom
    f48   he types THERE, into the real textarea — 35 characters at ~20 c/s
    f100  he hits send
    f104  the bubble appears, sized by the real component to its own content
    f116  Ren shows the typing indicator (L9)
    f150  Ren replies

Two defects resolve as side effects, both because a real bubble sizes to its content: **the bleed
is gone**, and so is **the over-tall reply bubble**. Neither was ever a text-fitting problem;
both were drawn boxes with guessed widths.

And it earns something the old staging could not: this is the one moment in the film where he
acts through *language* rather than through a click, and the beat now **shows** that instead of
asserting it. Ren keeps the typing-indicator-then-message treatment (L9). The human types; the AI
thinks, then speaks.

**His message stays short — that constraint is unchanged and load-bearing.** 35 characters, ~1.7s
at ~20 c/s. Never speed the typing to fit; shorten the line.

**TURN 2 HAS TO CARRY THE SITUATION, AND "boss moved it to 12. thirty minutes" DID NOT.** At 35
characters it was pure callback: *it* has no antecedent on screen, so the line only parses for
someone still holding the toast in their head from forty seconds earlier. In a feed, at phone
size, they are not. The beat's job is that the audience understands the stakes from **this**
message — the report, the new deadline, and how little time is left — without going back to the
notification.

It is 49 characters: **"boss moved the report to 12. i have thirty minutes"**. Still lower case,
still no punctuation he would not type in a hurry. It runs f40–f98 — 58 frames, ~25 characters a
second, which is faster than ~20 c/s **and is the point**: he is hurried, and this is the one
moment in the film where the hurry is his own behaviour rather than something the UI is telling
us. Every character still gets more than two frames, so it is typing and not a blur.

The rule this sheet actually carries is *never speed the typing to fit a line the beat cannot
afford*. This one it can: the typing window opened four frames earlier, the send moved two, and
**turn 3's hold is untouched at 60 frames.**

**Pacing:** messages appear one at a time with a real beat between them, not all at once. ~2s each. Push in on turn 3 and hold. The typed turn pushed Ren's `thinking` window and turn 3's arrival about twelve frames later each; **turn 3's hold got longer, not shorter**, since the sheet says to protect it at all costs and it was never the place to find frames.

**Camera correction:** the camera **moves on every turn**, not only on turn 3. At a framing wide
enough to hold the whole thread, 16px chat text is well under phone legibility, so turns 1 and 2
would be unreadable. It settles on each message as it arrives and pushes further on turn 3. A
change to the shot plan, not to the beat.

**Dependency:** the recommendations surface is `014-recommendations` and does not exist. This copy is written for the video. Keep it plausible against what 014 will plausibly ship — don't put a UI on screen that the product will never have.

---

### 11 · Return to ease · 1:05.7 – 1:13.5 (7.8s)

He acts on it. In order:

1. **Opens a music player**, plays the track — and **he presses play**, with a cursor on the
   transport. Without a hand on it the sequence reads as the app doing it to him, which is the
   exact inversion this beat is staged to prevent. Generic app, drawn. **The track is named on
   screen: Billie Jean, Michael Jackson.** That naming is the point — it's the evidence Ren knew
   him. Brief; a couple of seconds, no lingering on the interface.

   **The player sits ABOVE the viewfinder, and that was a plain z-order bug.** It was layered
   between the page and the viewfinder, so a window he had just opened had a webcam feed punched
   through its corner — which reads as a rendering fault rather than as depth, because nothing
   in an operating system behaves that way. `<Viewfinder/>` is `z-10` inside the stage and the
   overlay layer carried no stacking of its own, so the two competed on DOM order in a shared
   context. The player is 80 now: above the viewfinder and the app header alike, below the
   pointer, because a cursor is above every window.
2. **Puts headphones on** — and goes straight back to the keyboard.
3. **Music notes drift around him** in the viewfinder. He starts moving with it — small, a head nod on the beat, a shoulder. Not a dance number.

**HE EASES *OVER* THE WORK, NOT INSTEAD OF IT.** The beat used to end with him relaxed and the
deadline untouched, and there is a reading available — particularly for the managers this post is
aimed at — where the stress app told an employee to listen to music instead of doing the urgent
report. The clock says 11:30 and the deadline is 12. So **he never leaves the keyboard**: he is
typing again from the moment the player closes, all the way through the nod, the drift and the
recovery. The nod and the notes stay — they are the point of the beat. What changed is that he
does not stop.

**No audio plays.** This is animation only; the VO track is Arabic narration and the cut must work silent regardless.

Then, **after the head nod, THE CAMERA PULLS OUT AND HOLDS.** That pull-out is the beat's payoff
and it was missing: the move used to begin two-thirds of the way in and arrive on the very last
frame, so it never landed and never held, and everything that resolves resolved off screen. It now
lands with 54 frames still to run.

**THE THREE THINGS CANNOT SHARE ONE STATIC FRAME, AND THAT WAS MEASURED.** At the real geometry:

    bloom top → trend bottom            664.2 px
    viewport below the sticky header    519.0 px
                                        ─────────
                                        145 px short, at every scroll and every framing

No camera move buys page height, and padding the layout until it fits is exactly what register
item 2 exists to undo — the greybox only ever fitted because it drew a 476-tall card where the
product has a 607.7-tall one. (A further 32px separates the stateline from the trend's plot, so
even those two cannot be held together; the header is `sticky top-0` and cannot be scrolled away.)

**So the causal ORDER survives and the single static shot does not.** The bloom drifts and the
stateline returns while both are framed; then the camera pulls out AND the page scrolls, in one
continuous move, landing on the trend card whole for the descent. That is this sheet's own order
with the camera following the story instead of waiting for it, and **the closing linger lands on
the trend**, which is the thing the beat exists to show. The returned stateline is read at
18.6px on a phone in the shot before the move. No cut.

In causal order:

- The bloom drifts amber → meadow (1.3s ease — let it drift, don't snap)
- Stateline returns to **"You're at ease right now"** · "Steady and settled — nothing to do."
  — the third firing of the emphasis (L12)
- **The trend line's tail walks back down.** This is the thing the beat exists to show.

His face settles. **Not the same expression as beat 7** — quieter, relieved, a bit amused at himself.

**The relief lands BEFORE the pull-out, and this was checked rather than assumed.** The
expression finishes its travel into `easing` at f104; the camera does not begin pulling out
until f130. So there are 26 frames — about 0.9s — of settled relief held at the tight
headphones framing, where the head is ~120px on a phone, before the shot opens up. The nod
starts at f108, after the relief has landed. The staging is correct as built and needs nothing.

**Framing note:** the push-in on the viewfinder sits **wide**, not tight. The headphones, the
drifting notes and his head nod all need room; cropping to the face loses the thing that makes the
beat work.

**AND IT LINGERS ON THE FINAL READING.** The last thing on the page that travels is the emphasis
settling at f214, which leaves twenty frames — two thirds of a second — where nothing is moving
but his breath and the nod. Beat 12 is the film's thesis and it lands better arriving out of a
settled frame than out of a settling one. **This is the only timing change in the viewfinder
pass.**

**Cost: 6s → 7.8s.** The music player gives back ~0.4s — the track name reads in well under two
seconds at that framing — the payoff takes 1.4s and the linger 0.8s.

---

### 12 · The closing subtitle card · 1:13.5 – 1:16.5 (3s)

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

**The line, DECIDED 2026-07-30:**

> **A detection is a question, not a verdict.**

Verbatim from `lib/landing/copy.ts` `NEVER_CARD_DECIDE_BODY`. It satisfies both constraints: it is
a claim about how a reading is *treated*, which is exactly what beat 9 showed, so it implies no
branch the video did not.

**"Nothing moved until he answered." was REJECTED, and not on taste.** A great deal visibly moves
before he answers — the bloom drifts to amber, the stateline changes twice, the trend line climbs —
and the audience watches all of it in the thirty seconds before the questionnaire appears, so the
line reads as contradicted by the footage. It works as landing-page copy, where "moved" means *no
action was taken*; it does not survive being placed after a graph the audience just watched climb.
Do not reconsider it.

Deliberately **not** typed on — the end card types twice and a third typing effect in eight seconds
is a tic. Framed at 760, the same as the end card, so the two read as one closing movement.

---

### 13 · End card · 1:16.5 – 1:21.0 (4.5s)

**A sequence, not a static frame.** Three timed events:

1. a **reveal animation** for the Serenify wordmark — unchanged
2. then **"take care of yourself"** *appears*. It no longer types
3. then **`serenify.tech` derives from the wordmark**: the wordmark duplicates on screen, the
   copy shrinks and travels down to the domain line, and only **`.tech`** types in after it

Then hold. This is where the VO lands its last line, so the hold is room in the cut rather than
dead air.

**This makes the typewriter *mean* something.** All three elements used to type, which made
typing the card's house style rather than a gesture. Now the only thing that types in the whole
card is a **domain** — and beat 1 opens the film by typing a domain into an omnibox. The film
is bookended by the same action: the things a person types.

That is also why "take care of yourself" stopped typing. It is the sentimental line and it
should not be competing with a mechanical effect, so it fades up with a short rise. A wipe was
the alternative and was rejected for being the same *kind* of effect — the point is to isolate
the typewriter, and a wipe would have left three mechanical reveals inside eight seconds.

**The duplicate travels BEHIND the line, dipped to under half opacity in transit.** Its path
from the wordmark to the domain row is almost vertical and the line sits across the middle of
it; drawn in front and fully opaque it blanked half of "take care of yourself" for most of the
move.

**Permission to fall back, and it is one flag.** The duplicate-and-derive move is charming
described, it could be fussy on screen, and it is the last thing the audience sees. `DERIVE` in
`Beat13EndCard.tsx` reverts to typing `serenify.tech` whole, which is exactly the previous
treatment. Two things to watch: whether the travel reads as *derivation* or as a stray box
moving, and whether the two-colour seren/ify split survives at domain size — **the second
cannot be judged yet**, because the wordmark is still a grey placeholder here and its real
animation gets designed later.

**THE TYPING IS FASTER, THE HOLD IS NOT. Cost: 6s → 4.5s.** The typing was what felt slow: the
reveal took 1.53s and the two lines typed at ~13 and ~12 characters a second, which is a deliberate
pace at best and a stall at worst. All 1.5s came out of the typing. The reveal is 1.0s, and now
that only `.tech` types there are five characters left to spend it on — they run ~12 c/s, which
is slower per character than the old lines and still much shorter, because a five-character
suffix typed at speed reads as a glitch rather than as typing. The hold after the domain lands is
**unchanged** at ~1.13s, including the second added in revision 4 — that is where the VO lands
and it is not what feels slow.

---

## Running total: ~82.0s

Still well over the 40–60s target. **Do not trim on paper — trim in greybox**, where you can
actually feel what's slow.

**±0.0s across the component pass.** Every change in it is geometry, colour or staging, and none
of it moved a duration:

| What changed | Cost |
|---|---|
| Dark mode, everywhere | nothing |
| The component swap (beats 5, 7, 8, 9, 10, 11) | nothing |
| Beat 8 gaining a third landing inside its existing move | nothing — the move was already there |
| Beat 11's pull-out becoming a pull-out-and-scroll | nothing — same move, same frames |
| Beat 10's restructure into the composer | nothing — the typing was already 52 frames |
| The emphasis yielding 1.65× → 1.25× | nothing |

The previous revision's +0.8s (beat 11's closing linger) stands and is unchanged.

**+1.0s across the completion pass, and all of it is beat 4's second landing.** The privacy
pitch is in the first consent card rather than the last, and it misses sharing a frame with the
CTA by 11.8px, so the beat needs two landings inside its one continuous move. Everything else in
the pass changed what is on screen without changing how long anything is on screen for:

| What changed | Cost |
|---|---|
| The real typeface, everywhere | nothing |
| Beats 1, 2, 3, 6, 12, 13 swapped to real components | nothing |
| The OTP merge, frame-addressed at real speed | nothing — the 2.94s was already budgeted |
| The cursor, on every interaction | nothing — the clicks were already timed |
| The emphasis retimed onto its copy changes | nothing |
| Beat 8's escalation pulled 12 frames earlier | nothing — it tightened dead time, it did not add any |
| Beat 4 gaining a second landing | **+1.0s** |

**Trim candidates, in order:**

1. Beat 2, 15.6s → 12s. The performed mail sequence is where the fat is; the OTP choreography is not.
2. Beat 5, 12.4s → 10.5s. 5d recording can lose a second and 5f's hold can lose half of one.
3. Beat 4, 5s → 4s. The scroll can move faster than it does.

Beat 11 has come **off** this list. The music-player sub-beat is still the only fat in it, but the
beat now ends on a deliberate linger and trimming there would take the linger with it.

**Protect at all costs:** beat 8 (6.7s, and specifically its tight hold), beat 10's turn 3, the 5b
first-sight-of-face hold, and beat 11's wide hold and its closing linger. Those four are the video.

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
- ~~Which closing line?~~ **Decided: "A detection is a question, not a verdict."** See beat 12.
- ~~Can a rig produce the motion the beats require, and can a face of primitives fall
  convincingly?~~ **Yes to both, and it is retired with no art.** See "The character rig".
- ~~Beat 11 could read as the app telling an employee to skip an urgent report.~~ **Restaged: he
  never leaves the keyboard.** See beat 11 and the invariant.
- ~~Does the generated head arrive with separable regions?~~ **Yes.** Vector, not raster, with
  skull, hair, ears, neck and clothing already separate and the features absent entirely. The
  one way the brief could have come back unusable did not happen.
- ~~Does the rig read at the wide composite framing, and does beat 11's recovery need its own
  closer moment?~~ **It reads, and no.** The "~22px of head" this question was built on was
  stale — it predates the rig filling the viewfinder rather than a box inside it. The head is
  **~50px** on a phone at the composite and content-versus-not reads clearly. And beat 11
  already has its closer moment: the relief lands and holds at the tight headphones framing
  (~120px of head) for 26 frames before the pull-out begins. Checked, not assumed.

- ~~Was the shoulder proportion right?~~ **No, and it is fixed.** They spanned about five head
  widths on a flat arc and read as a distant horizon. Now 2.7 head widths with a real slope. See
  "The character rig".
- ~~Do the hands earn their place?~~ **No. Cut.** See "The character rig".
- ~~Does the office backdrop read as an office?~~ **It did not — it read as a bedroom**, and it
  competed with the face. Rebuilt around a blinded window, a monitor back and a desk line, and
  blurred. See the art brief.
- ~~Does `tense` read as the emotion it is meant to be?~~ **No. It read as anger**, and that was a
  facial-coding error rather than a matter of taste. It is now escalated dismay. See "The
  character rig".
- ~~Does any Serenify surface lack a genuine dark variant?~~ **No — not one.** `apps/web`'s dark
  mode is a full token swap under `:root.dark` and every component the film uses reads its
  colour from tokens; there is no hardcoded light value in any of them. One latent oddity was
  found and is NOT a video problem: the monitor viewfinder's placeholder is `bg-ink/80`
  (`components/monitor/viewfinder.tsx:55`), and `--color-ink` swaps to near-WHITE in dark, so the
  letterbox behind the feed is a light panel rather than a dark one. It is invisible in the film
  (the character fills the box) and invisible in the product whenever the feed covers it. Logged
  for the backlog, not fixed here — the video does not modify `apps/web`.
- ~~Does the viewfinder become a bright rectangle in a dark page, and is that wrong?~~ **It does,
  and it is right — but the backdrop needed re-tinting.** A bright feed in a dark page is exactly
  what a webcam looks like. What did not survive the swap is the relationship *inside* the
  viewfinder: the office backdrop's wall was tuned at **L 78 and the skin sits at L 78**, so
  against dark chrome the whole rectangle read as one bright slab with the face fighting its own
  background. The ramp dropped ~15 points (wall to **L 61**) and saturation came down from ~8% to
  ~6% — at the old chroma it read distinctly tan against cool dark chrome. The face is the
  brightest thing in frame again, which is the brief that backdrop has always had.
- ~~Do the headphones still read now that the face is the brightest thing in frame?~~ **Yes**, and
  the re-tint is what protects it. They were brought down to muted grey to stop competing with
  the face; with the backdrop now 17 points below the skin, the cups sit between the two rather
  than against the top of the range. The contrast relationship inverted, and the fix was the
  backdrop rather than the headphones — moving them back up would have undone the previous pass.

**Still open:**

- **Does the closing card land or stall the ending?** Three seconds of held text between the demo
  resolving and the wordmark is either the last idea or a speed bump. Judge it in this pass.
- **Is 81.0s acceptable, and if not, what goes?** See the trim list above.
- **Does the face need to be bigger?** It is **~80px crown-to-chin on a phone** at beat 8's tight
  framing — measured off a render, not estimated. The fall reads clearly there, so nothing was
  done about it. Head size is set by the framing window against the viewfinder's height, so the
  narrower shoulders cost nothing and the headphone band's headroom cost about 2%. The lever if it
  ever needs buying back is L1's viewfinder size (320×180 today), not the framing window — and it
  should be re-checked against the real component before it is pulled (deferred register, item 6).
- **Does beat 13's duplicate-and-derive move sell on screen?** See beat 13; `DERIVE` reverts it.
  **Half of this is now answerable and the answer is yes:** the mark is the real `<Wordmark/>`,
  so the two-colour `seren`/`ify` split is on screen at domain size and it holds. What is still
  a judgement call is whether the travel reads as *derivation* or as a word moving.
- **The protagonist is Youssef Kamal, and the film was calling him Mohamed Asem.** Every
  `<Header/>` in the second half was mounted with the repo owner's name, so the avatar read
  **MA** for twenty-five seconds while the man in the viewfinder was someone else. `deriveInitials`
  reads straight off `fullName`, so naming him correctly is the whole fix — there is no initials
  string to keep in sync. It is one constant now (`PROTAGONIST` in `copy.ts`), which is what stops
  the same leak reaching the next surface someone mounts.
- Do the real full-page reloads (`<a href>` / `window.location.replace`) read as broken on video, or as honest? They're real; showing them is more faithful, but a hard white flash mid-video may just look like a mistake.
- Beat 10's three-turn exchange is written for the video; `014-recommendations` doesn't exist. Keep the UI plausible against what 014 will actually ship.
- Beat 10 turn 3 must read as *personal knowledge*, not a canned tip. If greybox shows it reading generic, that's a copy problem to fix before art.
- Does the mail app icon established in 2e survive the ~25 seconds to beat 8 as a recognisable signature? Greybox will show it.

---

## The deferred register

**What is deliberately unfinished, so that nothing depends on being remembered.** Each entry is a
requirement plus the reason it is not built yet. Recording these *is* the work; none of them is to
be started from this list.

**Deferred to the component pass** — when the greybox page is replaced by real `apps/web`
components:

1. **The mail client's reading pane must be empty until the message is clicked.** A ghost of the
   body is visible beforehand, which leaves the click nothing to reveal. Applies at **beat 2 and
   beat 8**. The mail client is a drawn asset that does not exist yet, so this is a requirement on
   that asset — do not patch the greybox.
2. ~~**Un-pad the dashboard layout.**~~ **DONE (component pass).** The monitoring surface renders
   the product's own spacing — `max-w-3xl` (768, not 700), `min-h-[480px] … px-10 pb-10 pt-16`,
   `sm:size-72` bloom (288, not 148), the readout as a row above the card rather than a corner
   overlay, and the viewfinder as an overlay inside the card rather than a panel to its right.
   Nothing is padded, and **the emphasis is what yielded** — see item 3.
3. ~~**The stateline emphasis must not overlap the bloom.**~~ **DONE.** It cannot, by
   construction rather than by arrangement: it grows downward from the block's own top edge, so
   its top never moves and the real `mt-6` between the bloom and the stateline is untouchable.
   The emphasis yielded from **1.65× to 1.25×**, set by two measured clearances (11.1px above the
   real Pause/End controls, and inside the frame's bottom edge). See L12 for the arithmetic. The
   layout did not move.
4. ~~**Frame the calibration success state against real geometry, ripple extent included.**~~
   **DONE, and the cause was one number.** The ripple scales a 96px badge to 2.1 — 52.8px past
   the badge on every side — and the badge sits 24px below the component's top edge, so the
   ripple crosses it by **28.8px**. Every previous framing measured the component and cropped the
   ripple. See beat 5.
5. ~~**The calibration viewfinder becomes 16:9.**~~ **DONE.** The box is 512 × 288 `aspect-video`;
   the 3:4 bracket guide floats inside it at 168.5 × 224.6. The take is reframed, and the
   centring nudge lands harder for a measurable reason — the bracket target is only 33% of the
   box's width. The stale liberty lived in beat 5's framing note and **that note is deleted**;
   there was no row in the liberties table to remove.
6. ~~**Re-check beat 8's face size after the swap.**~~ **CLOSED — re-checked and better.** The
   fall now plays at **88.7px** on a phone, against the ~80px that was accepted. L1 is unchanged
   at 320×181; only the direction it grows from moved (see L1).
7. **Beat 11's page half — the trend descent is DONE, the music player stays a stand-in.** The
   trend is the real `<SessionTrend/>`: the tail walks back down in meadow while the climbed
   history stays put, which is the thing the beat exists to show. The player remains a stand-in
   by design, now in dark-mode grey rather than light-mode grey sitting in a dark film.

7b. ~~**Beats 1, 2, 3, 4, 6, 12 and 13 are still greybox.**~~ **DONE (completion pass).** Every
   product surface in the film is now a shipped component. Beat 1 is `<PublicNavbar/>` +
   `<Hero/>` (which brings `<StoryCard/>` with it); beat 2 is `<Field/>`,
   `<PasswordRequirements/>`, `<TermsAcknowledgementField/>`, `<Wordmark/>` and `<OtpBoxes/>`;
   beats 3 and 6 are `<WelcomeBanner/>` + `<CalibrationBanner/>`; beat 4 is
   `<CameraConsentGate/>`. Beats 12 and 13 are authored and finished — see item 8.

   **Four things the real components contradicted, all now in `geometry.ts`:**

   - **The landing hero is TWO COLUMNS at this world** (`hero.tsx:48` is `flex-col lg:flex-row`,
     and 1200 is well past `lg`), its headline is **67.2px** rather than 40, and its copy column
     is 510 wide beside a 510-wide story card. The greybox's centred 640-wide block exists at no
     viewport ≥ 1024.
   - **There is no signup card and no public navbar on `/signup`.** `app/(auth)/layout.tsx` says
     it outright — "no card chrome — the page IS the surface" — and the `(auth)` shell is a
     `max-w-md` column with the wordmark and the theme toggle, nothing else. The column is
     **818.5 tall in a 583px viewport**, so the beat scrolls to its own submit button.
   - **The greybox's password was twelve bullet characters**, which satisfy "at least 8" and fail
     both "contains a letter" and "contains a number" — so the real checklist sat permanently
     two-thirds unlit and 48px taller than its collapsed state, and pushed the submit button
     through the fold. It is a real password now, chosen so the list collapses on the last
     keystroke.
   - **Beat 4's privacy line is in the FIRST card**, not the last. See beat 4.

   ~~**One of these carries a known blocker.**~~ **CLOSED — the OTP merge is frame-addressed.**
   The obstacle was never the timers; every component in this film had timers. It was that this
   one expresses state through `useState` and motion through CSS transitions, so there was no
   prop to drive and no declared value in the markup to interpolate. The answer is the same
   technique one level deeper: **the static variant has to be asked for.**
   `playSuccess()`'s reduced-motion branch (`otp-boxes.tsx:174`) is not a degradation but a
   *synchronous end state* — `meltTogether()`, then `{lit: 6, merged: true, pill: true, instant:
   true}` in one commit — and `instant` is the flag that strips the component's own
   `duration-500` classes. It is also the only state in which the pill's contents (the check
   glyph and the word) exist in the DOM at all. From there every value is re-authored per frame
   as `color-mix()` of the app's own tokens: the halo sweep, the meadow fills, the corner radii,
   the digits clearing, the pill's fade.

   **And the 1.5px overlap turned out to be derivable rather than measurable.** `meltTogether()`
   measures the row and writes an absolute offset per box, which cannot be re-run per frame
   without a `delayRender` round trip on every frame. It does not need to be: working the
   arithmetic through, `translateX(i) = (gap + 1.5) · (2.5 − i)` — **the box width cancels
   completely.** At this world the gap is 8, so the offsets are ±23.75, ±14.25, ±4.75, symmetric
   about the centre. Confirmed against the probe: box 0 at x 424, box 5 at x 724, a 60px step.
   The overlap is inside that expression, and it is why the step is 9.5 rather than 8.

**Open and unanswered, older than this pass:**

8. **On-screen text has no treatment** — still open for CAPTIONS and any on-screen text the film
   might gain. *(A reference video existed for this, was misread, and Mohamed asked to scratch it.
   Do not resurface it.)* **The two closing cards are no longer part of this item:** they were
   finished in the completion pass and are the film's only authored type. Beat 12 is Outfit at
   500 with `-0.01em`, not bold system-sans; beat 13's mark is the **real `<Wordmark/>`**,
   revealed by a clip rather than a fill, so what arrives is the mark itself and the two-colour
   `seren`/`ify` split is finally judgeable at domain size. Both now sit on `CARD.field`
   (#0b0c0e), three points below the app's own page — the signal `furniture.ts` designed to say
   "we have stepped outside the product" and which the beats had never actually spent.
9. **Should Ren stop blinking while a reading is Tense?** Raised three sessions ago, never
   answered.
10. **Do Ren's `attentive` and `thinking` states need properly drawn eyes?** They are `idle`'s eyes
    scaled. At the enlarged avatar size (L8), held for seconds, that may become visible in a way it
    is not in the app.

---

---

## The assets pass — recorded now, not built

The next pass draws the mail client, the music player, the notification and album art. Two things
are written down here so they are not built wrong later. **Neither is to be started from this
list.**

**ALBUM ART MUST BE ORIGINAL.** Song titles and an artist's name on screen are decided and stay
(L2b) — the naming is the evidence Ren knew him, and with no audio and no lyrics it carries
effectively no risk. **An actual album cover does not.** It is a copyrighted image, and
reproducing one in a promotional video on a public post is a materially different exposure from
naming a track. Authored abstract cover art costs nothing, removes the question entirely, and can
be matched to the film's palette. **No reproduction or near-reproduction of a real album sleeve** —
not redrawn, not "inspired by", not recoloured.

**THESE ASSETS NEED PERSONALITY, NOT WIREFRAMES.** They are the film's only non-Serenify surfaces,
and a labelled grey rectangle beside a real product component reads as unfinished in a way it
never did when everything was grey. They should feel like real software someone actually uses —
in dark, sitting inside the film's palette, with the specificity that implies: a mail client with a
sender list and a real reading pane, a player with a transport that looks like it works. They take
their values from the furniture token block, which is deliberately decoupled from the app's palette
(a browser and a mail client are not part of Serenify and must not move when its tokens do).

---

## Third-party brands — decided

**Mail client and music player are generic. Billie Jean and Michael Jackson are named on screen. No audio, no lyrics.** Mohamed's call, made 2026-07-29.

The reasoning: naming a track with no audio and no lyrics carries effectively no risk, and the naming is doing real narrative work — it's the proof Ren knew his taste. Drawn Gmail and Spotify interfaces, by contrast, add brand clutter and buy nothing the story needs.

The one cost is that generic UI can't disambiguate itself, which is why beat 2e now has to establish a mail icon that beat 8 can lean on. See the warning in beat 8.

# Serenify — LinkedIn launch video · beat sheet v1

**Format:** 16:9, 1920×1080, ~60s. Silent-first — every beat must read with no audio. ~~Egyptian Arabic VO is recorded last, over a locked cut.~~

**THE VO IS DROPPED, SO ON-SCREEN TEXT IS THE FILM'S ONLY NARRATION (2026-08-04).** LinkedIn
autoplays muted, and a film whose narration is in a soundtrack nobody hears has no narration. It
goes on **cards** rather than as an overlay — see "The four interstitial cards" below for the three
reasons, the copy and the placement argument. "Silent-first" stops being a discipline and becomes
the only mode; nothing in the film may now depend on something being *said*.

**Render viewport:** the product is rendered at a **1200px-wide viewport** and the whole
desktop is scaled **1.6×** to fill the 1920×1080 output (L7). Not a 1920px browser with
384px of dead gutter each side.

**Pipeline:** real `apps/web` React components for every product screen. Drawn assets only for: the character, the browser chrome, the mail client, the music player and its album art, the macOS notification, and the end card. All of them are built — none is a stand-in.

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
OTP boxes and their whole 2.94s merge, the dashboard's two banners and its cards, the camera gate, the
calibration flow, the monitoring stage, the confirmatory prompt, Ren's chat, and the wordmark on
the end card. What is drawn is the film's **non-Serenify furniture** — the browser chrome, the
mail client, the music player, the notification — and **that furniture is now built rather than
stood in for.** A three-pane mail client with somebody's actual inbox in it, a transport with
real glyphs and a scrubber, original album art, and a macOS Sonoma banner with vibrancy in it.
Nothing in the film is a labelled grey rectangle any more. See "The assets pass" below.

**THE FILM IS DARK, AND THE PRODUCT SURFACES ARE REAL COMPONENTS.** `apps/web` has had a
designed dark mode from the start — a full token swap under `:root.dark` — so this is the app's
own theme rather than an approximation, and **no Serenify surface in any beat lacks a genuine
dark variant.** The monitoring page, the calibration flow, the confirmatory prompt and Ren's
chat are now the real components, in dark, framed against measured geometry. The non-Serenify
furniture — browser chrome, the mail notification, the two closing cards — has no dark version
to inherit and was authored; it carries **its own token block, deliberately decoupled from the
app's palette**, because a browser is not part of Serenify and must not move when the product's
palette does.

**Framing is measured, not fitted.** `video/src/SwapProbe.tsx` renders the real components
at the real 1200px world and prints their bounding boxes; `video/src/app/geometry.ts` holds
those numbers and `framing.ts` derives every shot from them. Three consecutive revisions logged
crop complaints and all three traced to framing tuned against greybox rectangles.

**A MEASURED NUMBER IS ONLY AS GOOD AS WHAT WAS ON THE PAGE WHEN IT WAS TAKEN, AND TWO OF THEM
WERE NOT.** The discipline is right and it is not self-verifying, which is the thing to carry
forward rather than the two bugs:

- **THREE BLOCKS WERE 64px TOO HIGH — `HOME`, `GATE`, and beat 10's chat rects.** Each was probed
  **without the sticky `<Header/>` mounted**, so each recorded a page that does not exist, and 64
  is `HEADER_H` exactly. `RAW.*` was probed *with* it, and the two kinds sat in the same file
  looking equally authoritative. The symptoms did not look like bad rects: a cursor drawing above
  its button, and a landing arriving mid-layout with body copy sliced top and bottom.
- **`CLOCK` disagreed with where the clock is actually drawn.** `geometry.ts` had it at x 923 and
  `shell.tsx` drew it at x 1036, so `BEAT8_CLOCK` framed a rectangle the clock is not in and the
  film's single most important number rendered as **"11:30 A"**, the M sliced off — in the shot
  whose entire purpose is that the audience subtracts it from "by 12". Nothing measured this: the
  rect was *derived* from a stated relationship ("the clock shares the stack's right edge") that
  the drawn furniture never implemented.
- **`SUCCESS_FRAMED`'s x came from the wrong element.** It grew the rect from the *badge* on both
  axes, so its centre sat at 723.2 against the component's 600 — and beat 5f's key is
  `shot(600, …)`, so the camera arrived 123px right of the thing it was framing. The ripple only
  escapes on the **top** edge; horizontally it stays inside the component, so the badge has no
  business in the x arithmetic. "The success state sits left of frame and the camera pans further
  left" was one wrong axis in one derived rect.
- **`RAW.statelineSub` recorded the `at_ease` width for all three copies.** The `tense` sub is the
  only one that wraps, and a wrapped paragraph fills its box rather than shrink-wrapping: **430
  wide, not 287.6.** Every horizontal framing number in the file descended from the smaller
  number, so the film's most important reading was cropped by 51px at rest in beats 8 and 9.

So the rule gains a second half. **Measure against the page the film actually renders; measure the
worst case rather than the case that happened to be on screen; and check that the drawn furniture
agrees with the rect that claims to describe it.** A number in `geometry.ts` is a claim about the
render, and a claim is checkable — by rendering a still and looking at it, which is what found all
five of these and none of which a probe would have caught on its own.

**AND A COMPONENT THAT MEASURES ITSELF IS THE SAME PROBLEM WITH NOBODY TO BLAME.** `measure-patch.ts`
exists because `getBoundingClientRect()` returns **screen** pixels, so the camera's CSS scale leaks
into any component that sizes itself from its own box — which is how beat 11's trend once came out
three times too wide with its descending tail off the plot. The patch divided out `CAMERA.zoom`.
**It did not divide out the trend's own scale wrapper**, and that second factor was in the chain
the whole time: `<SessionTrend/>` measured `720 × 0.4167 = 300` and drew a **300-wide SVG inside a
720-wide box**. The gutters collapsed to their minimums, `plotWidth` was 192 instead of 520,
`capByLegibility` **silently dropped a window**, and 58% of the card was empty to the right of the
line. Predicted gridline edge 594px into the crop; measured on the render, **595**. Nothing about
it looked like a bug — a graph drawn small inside its card looks like a design decision, and the
symptom was reported as *the series is too short*, which it never was.

The general rule gains its fourth form, and it is the one that generalises furthest: **a value the
film addresses by frame must have exactly one source — and a value a component derives from its own
geometry must be measured in the space the film draws in, not the space it screenshots in.** Every
scale between an element and the camera is part of that chain. The wrapper declares itself with
`data-measure-scale` now and the patch walks up from the element being measured, so a second scale
cannot be forgotten the way the first one was.

**AND THE FILM SETS IN THE APP'S OWN TYPEFACE.** `apps/web` gets Inter and Outfit from
`next/font/google`, which is a build-time mechanism with no counterpart in a Remotion bundle —
so `--font-sans` and `--font-display` resolved to nothing and **every real component silently
fell back to `system-ui`**. That single fact is most of why the film read as greybox even on the
beats that were already using real components: the components were real and the letters were
not. `video/src/fonts.ts` registers both families under exactly the names `globals.css` asks
for, each behind its own `delayRender` handle, so a frame cannot be screenshotted before the
bytes are in. Nothing overrides a token; the app's typography becomes correct by the families
existing. The authored furniture takes **Inter** (a browser is not Serenify, so it does not wear
Outfit — that rule is intact), and **that includes the omnibox and the clock.**

**THE OMNIBOX AND THE CLOCK WERE GEIST MONO, AND THAT WAS THE RIGHT INSTINCT ANSWERED WRONG.**
The premise was sound — an address bar and a ticking clock want stable digit widths — but the
conclusion does not follow from it. **No mainstream browser sets its omnibox in a monospace
face.** Chrome, Safari and Firefox all use the system UI font, and a monospaced address bar is
one of the clearest tells of a browser that was *drawn* — which is the one thing this chrome
cannot afford to be, since its whole job is to be unremarkable enough to read as the audience's
own machine. The instinct underneath is unaffected and intact: a browser is not Serenify, so it
must not wear Outfit. The mistake was answering "not the product's face" with a face no browser
uses instead of the face every browser uses. Both are **Inter** (`OS_FONT`) now with **tabular
figures** (`OS_TABULAR`) — the digit-width argument met properly, as a numerals problem rather
than a typeface problem, which is what a browser actually does and costs a font-feature
declaration rather than a second family. The clock's tracking comes in 0.4 to hold the
fixed-width right-aligned box; it stays plain, un-tinted and un-animated (L11).

**`OS_MONO` is now used by nothing in the film, and it is kept deliberately** — still loaded for
the probe compositions — so that nobody has to re-derive "which mono, and why" later.

**Every interaction has a visible cause.** A cursor travels to each control and clicks it, with
the component's response following the click — `video/src/app/pointer.tsx`. The component pass
had lost it, and the film read as a sequence of screenshots of software rather than as someone
using it; the confirmatory prompt was the clearest case, where a focus ring arrived on "Yes,
that's me" with nothing touching it.

**AND THE CURSOR WAS TWICE THE SIZE OF A CURSOR.** It was 26 × 34 world px. A real macOS arrow
is about **12 × 19 points**, and at a 1200px world standing in for a desktop screen that is the
size to use — it is now **13 × 20**, in the macOS shape rather than the Windows one (narrower,
straight-cut tail), light fill over a dark outline because every surface it crosses in this film
is dark. The click ring scaled with it, **52px → 26px** in diameter: a 52px ring around a 19px
arrow is a target reticle, not a click. The worst case before the change was beat 9's 3.4×
push-in, which drew a **90px arrow over a 320px prompt**.

**THREE CLICK TARGETS WERE WRONG AND ONE OF THEM GENUINELY MISSED.** Beat 10's send is the one
that missed: both its waypoints were hand-typed, the send button is 44px wide starting at x 879,
and the pointer was aiming at **x 872 — seven pixels outside the left edge of the control it was
pressing**. It is measured now (`geometry.ts` § CHAT, probed against the real `<ChatShell/>`).
Beat 2's new-tab button (which was hitting the top-left corner of a 22 × 22 target), beat 2's
tab switch and beat 2's mail row are re-centred on the same principle. Beat 6's was a different
and larger failure — see beat 6.

**AND THE ARROW WAS NOT DRAWN ON ITS OWN CLICK POINT.** The sprite is a `0 0 13 20` viewBox whose
tip is at path coordinate **(1, 1)**, and it was rendered as a plain flow child of the
`left: x; top: y` wrapper — so the click coordinate landed on the SVG's **(0, 0) corner**, one
glyph-unit up and left of the tip, and the click ring was concentric with the sprite's box rather
than with the point being pressed. A cursor has a *hotspot*; this one did not have one. The SVG is
offset by `−TIP` now and its transform origin is the tip, so the arrow's point sits exactly on the
coordinate — one fix, every click in the film, including the ones nobody has looked at.

**THAT WAS ONLY HALF OF IT, AND THE OTHER HALF IS WHY THE SYMPTOM SURVIVED THE FIX.** The pointer
drew visibly above **Set baseline** and **Start check-in** by far more than one glyph-unit, and the
cause is that **every rect in `geometry.ts`'s `HOME` block was 64px too high** — probed without the
sticky `<Header/>` mounted, unlike `RAW.*`, whose own note says it was measured with it. The
authed page is `VIEWPORT_Y` 92 + `HEADER_H` 64 + `MAIN_PT` 32 = **content top 188**, and
`calibrationBanner.y` read **124**: 92 + 32, the header's exact height missing. Every value in the
block is +64 now, and the set stays internally consistent at the new offset.

**What made this hard to see is worth stating, because it will happen again.** The hover fired
correctly on the button while the click missed it, and that combination *looks* like proof that the
coordinate is right and only the drawing is wrong. It is not proof of anything:
`hover.tsx` addresses the DOM by **CSS selector** and never reads a coordinate, so a correct hover
beside a missed click is not a contradiction — it is the signature of a bad rect. **A hover cannot
corroborate a position.** The two bugs wore the same face and only one of them was in the cursor.

**`:HOVER` CAN NEVER FIRE IN A REMOTION RENDER, BECAUSE A RENDER HAS NO POINTER.** This is an
invariant-level fact about the medium rather than a bug in any beat: **every `hover:` utility in
`apps/web` is dead code inside this film**, and no amount of correct component usage brings it
back. A cursor that travels to a control and presses it while the control never acknowledges it
is the same class of defect as a click with no cause. So the rules are re-declared and gated on
**the frame** instead of on a pointer, using exactly the technique `motion.tsx` uses for
animation — `video/src/app/hover.tsx`. Every treatment is **transcribed** from `button.tsx`'s
variant table and cited, never invented, and each is a function of t, so a `bg-meadow/10` wash
at t is genuinely that wash at 10·t% and the intermediate frames are colours the browser would
have interpolated.

**And the transition property decides the shape of the move.** `transition-colors`
(`button.tsx:8`) covers colours and **not** opacity, so `hover:opacity-90` variants **snap** — in
the product, and therefore in the film — while `hover:bg-*` variants ease over 150ms. Sites
wired: beat 1's "Get started" (meadow), beat 2's "Create account" and its mail-list row, beat 3's
"Set baseline" (foggy), beat 4's "Allow camera and inference" (meadow), beat 5's "Turn on
camera" / "I'm ready" / "Back to home" (all meadow), beat 6's "Start check-in" (meadow), beat 9's
"Yes, that's me", beat 10's send, and beat 11's play button.

**Two of those sites ship no hover at all, and the film says so rather than inventing one.**
Beat 10's chat send is `bg-foggy text-on-accent transition-opacity disabled:opacity-50`
(`chat-shell.tsx:388`) — a disabled state and a transition with nothing to trigger it. Its
treatment is the **one authored entry** in the whole table, written as the house
`hover:opacity-90` idiom on an element that already carries the transition to run it, and
declared as authored in the code. And the signup consent checkbox ships nothing either
(`terms-acknowledgement-field.tsx:93` — `cursor-pointer`, a focus-visible ring, and that is all):
a native checkbox's hover is the browser's own rendering, which the product does not declare, so
the tick gets a cursor, a press and a ring and **no hover**, which is what the product does.

**One hover had been dropped in transcription and is restored.** The `(auth)` submit carries
`hover:opacity-90` at `signup-form.tsx:255`; the film's copy of it did not. It is also the one
hover in the film the product genuinely **eases**, because it carries `transition-opacity`
rather than the `<Button/>` base's `transition-colors`.

**AND `prefers-reduced-motion` WAS ONLY EVER ANSWERED FOR JAVASCRIPT.** This is the finding
behind "the checkmark flashes", and it is bigger than that one site. `shims/use-media-query.ts`
intercepts the **hook**, so every component that gates its motion with a JS branch —
`reducedMotion ? <span/> : <motion.span/>`, or a conditional class string — takes its static
variant correctly. **Nothing was answering the query for the CSS engine.** Chromium evaluates
`@media (prefers-reduced-motion: reduce)` itself, against a media feature the render never sets,
so every `motion-reduce:` Tailwind variant in `apps/web` and every raw `transition:` in an inline
style stayed **live** — and a live CSS transition in a frame-addressed render is a second clock on
a value the film addresses by frame. Remotion keeps one page and steps the frame on it, so those
transitions run against real elapsed wall-clock time between screenshots: what lands in a frame
depends on how long the previous frame took to render.

Three sites were confirmed and the first is the film's central graphic:

- **`bloom.tsx:68,74`** — `transition: background 1.3s ease`, in the STATIC branch as well as the
  animated one. The film writes a frame-derived `--bloom` every frame and the component's own
  transition was chasing it, across beats 8 and 11's ~39-frame drifts.
- **`framing-overlay.tsx:32,82`** — `transition-colors duration-300` on the green room's brackets
  and `transition-shadow duration-500` on its meadow glow, both guarded only by
  `motion-reduce:transition-none`. **This is the checkmark flash.** The `<Check/>` glyph is a plain
  boolean mount and was never the problem; what popped was the glow it sits in, caught
  mid-transition at whatever wall-clock offset the capture happened to land on.
- **`globals.css:310`** — Ren's blink, a 7s infinite CSS animation on two eye groups.

`motion.tsx` § `<StillMotion/>` answers it for CSS, and **every rule in it is transcribed from
`apps/web/app/globals.css`'s own `prefers-reduced-motion` blocks** (`:209-216` and `:323-326`),
stated unconditionally. That is deliberate: the fix has to be what the product does when a user
asks for less motion, or the film renders a state the product never ships. It is mounted in
`<Camera/>`, which all thirteen beats render, so a new beat cannot forget it. **The general rule
gains its third form:** a value the film addresses by frame must have exactly one source — and the
component's own source may be a `setState`, a `setTimeout`, *or a stylesheet*.

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
| L1 | **Viewfinder is scaled up** from the app's 224×126px to 320×181 | At true size his face is a smudge on a phone. The emotional core of beat 8 requires a readable face. **Measured against the real component (2026-07-30): it grows from its TOP-LEFT.** The real viewfinder is an `absolute … z-10` overlay inside the stage card and its left edge sits at world x 743 against the bloom's right at 744; the bloom's gradient is fully opaque out to x 669, so growing from the top-right — its anchor in the app — covers the bloom's solid core, and beat 7's whole job is to plant bloom, stateline and viewfinder together. Growing from the top-left spends the enlargement on the empty page beside the card instead. It also has to be parented one level out of the card, which carries `overflow-hidden`. **AND ITS TOP EDGE IS THE ORB'S TOP EDGE NOW (L16), 212 → 237** — the two columns begin on one line, which is the composition's two pictures sharing a horizontal rather than the viewfinder sitting 25px above the thing beside it. The stage card's own top edge (188) was the other candidate and is not takeable: it leaves the toast nowhere to go but *below* the viewfinder, and beat 8's first landing is `CLOCK ∪ TOAST`, whose union would go 147 → 447px tall and cost 16:9 **880.5 world px** — the clock 32.1 → 13.4px on a phone and the subject line **16.1 → 6.7px, under the floor**, in the one shot the film's only piece of arithmetic happens in. |
| L2 | **The deadline notification sits top-right**, adjacent to the viewfinder | Keeps notification and face in one push-in, so you watch his face fall *while the toast is up*. Correct for macOS anyway. |
| L2b | **The mail client and music player are generic, not Gmail and Spotify.** Billie Jean is named. | Mohamed's call. No audio, no lyrics, so naming the track carries effectively no risk, while drawn third-party UIs carry needless brand clutter. |
| L3 | **Time is compressed throughout.** The real flow is 10–15 minutes | 60s video. Non-negotiable. |
| L4 | **Session timer jumps to `47:12`** | Free storytelling — he's been heads-down a while. Communicates "this runs in the background all day." |
| L5 | **The OTP code path is shown, not the magic link** | The magic link is the primary path but it's one click that navigates away. The 6-digit code triggers the best animation in the product. *Mohamed — overrule this if you disagree; it's the one liberty I picked rather than asked about.* |
| L6 | **No `/onboarding` step** | `full_name` is captured at signup, so the bounce never fires in practice. Signup → `/app` directly. |
| L7 | **The product is rendered at a 1200px viewport, scaled 1.6× to 1920×1080** | `apps/web` uses no `xl:`/`2xl:` utilities at all — its highest breakpoint is `lg:` (1024px), plus one custom `min-[880px]` on the dashboard grid — so every viewport ≥1024px is the identical layout. The content column is `max-w-6xl` (1152) inside `sm:px-6` (24), so it hits its designed cap at exactly 1200. That makes 1200 the *smallest* viewport at which the column is full width: maximum content, zero layout compromise, 1.6× of free magnification. At 1920 the column filled ~60% of frame; at 1200 it fills ~96%. |
| L8 | **Ren's avatar is drawn much larger than the app draws it** — **BUILT, at last** | `RenAvatar` defaults to 34px and its call sites use 38 and 54. Beat 10 is the only place in the video where Ren's face is on screen long enough to be read, and at true size it is a smudge on a phone. Same category as L1. **It had never actually been applied:** the component pass replaced the drawn stand-in with the real `<ChatShell/>`, which mounts `<RenAvatar/>` with **no props at all** (`chat-shell.tsx:447`), so Ren rendered at 34px in `idle` for the whole beat and the liberty survived as a row describing something nobody could see. It was **56px** — a *ceiling* rather than a judgement: it grows about the shipped box's own centre, so at 56 it sits inside the conversation header's 68.7px band with 6px top and bottom and stops 1px short of where "Ren" begins. `apps/web` takes no video-only prop, so the shipped avatar is hidden and the video draws its own — the seam `calibrate.tsx` already uses on the countdown numeral. **AND THE CEILING WAS THE WRONG PLACE TO SIT (2026-07-31).** At the beat's face landing 56 reads at **53.6px on a phone beside a 14.4px line of his own speech**, which makes the face the subject and the sentence the caption — and beat 10's subject is the exchange. It is **42 provisionally**, and the number is Mohamed's to pick: three variants of the same landing are rendered at **48 · 42 · 36** (46.0 / 40.2 / 34.5px on a phone) in `docs/video/ren-landing-2026-07-31/`. **Varying it does not re-frame the shot** — the landing's width is governed by turn 1's own right edge at x 630.5, not by the avatar, so the three are 434.5 / 433.5 / 432.5 and are genuinely comparable. |
| L9 | **Ren gets a typing indicator, which the app does not have** | Needed to make the `thinking` state legible as a state rather than as dead air. The video depicts a feature that will be built later. **Decided — this is not a fidelity defect and must not be "fixed".** **And only motion satisfies the justification:** the dots must *travel*. A static stagger is a photograph of a typing indicator, which reads as decoration and gives the liberty nothing to have been taken for. See beat 10. |
| L10 | **The travelling lift** — an element detaches from its layout, **travels** to centre frame at a narrower measure, is read, and settles back where it belongs | Some elements cannot be made legible by any camera move, and the reason is geometry: a 1152×86 banner in a 1200 viewport cannot be held whole *and* magnified in a 16:9 frame, so the tightest shot on it is the full frame. The lift stages the element instead of the shot. Content and type sizes stay real — the calibration banner is still `text-sm` — only position and measure are staged. **Used in exactly two places: beat 1's address bar and beat 3's calibration banner.** A third candidate gets reported rather than built. (Beat 7's stateline used to count against this cap; it is a different device — see L12 — and no longer does.) |
| L11 | **A clock in the browser toolbar**, right-aligned at the omnibox row's end, at twice the chrome's own type size | Beat 8's payoff is arithmetic the audience does unaided — the clock says 11:30, the boss says "by 12", nobody says *thirty minutes*. With no legible clock there is no arithmetic and no payoff, so a clock is load-bearing and must exist **from beat 1** (one continuous recording cannot grow chrome halfway through). The honest place is the macOS menu bar, but a 24px bar holds ~16px of type — ~6px on a phone in a wide shot — so it would have to grow (page height, which L7's whole argument forbids spending) *and* beat 8's push-in would have to reach world y 0, widening 590 → ~711 and dropping the toast's own subject line to ~8px. The toolbar costs **zero page height** and widens beat 8's push-in by only ~4%. No real browser draws a clock there; that is the entire cost. **It is plain — no pulse, flash, tint or animation beyond the time changing.** Emphasis would convert a discovery into an instruction, and there is no colour available anyway: amber and meadow both carry band meaning. |
| L12 | **The in-place emphasis** — a block grows **1.25×** where it stands, is read, and settles. Nothing travels, the camera does not move. **It is OFF the statelines now (L15) and lives on at beat 5a's privacy line** | A separate landing on the block was priced at ~1.5s; this is **free**, because camera travel is what costs time. **It is a rule, not a budget** — see the invariant below. **The factor fell from 1.65× at the component swap, and that is register item 3 resolving.** 1.65 was derived against a composite framing of ~1096 world px. 1.25× is set by measured clearances instead: the block grows downward from its own top edge (so the bloom is untouchable by construction) and, at L14's 70px controls gap, finishes **46.75px clear** of the real Pause/End controls and inside the frame. At 1.65× it would run through the controls and out of the frame. The device survives as grammar; only its amplitude yields. **And at L14 it is genuinely buying legibility rather than only emphasis**: in the 884.75 composite the 17px sub reads at **8.11px** on a phone seated and **10.13px raised**, so the raise is what carries the film's central reading over the ~10px floor — on every band, not on two of three. **A second copy takes the device: beat 5a's privacy line**, at the same 1.25× and at **full amplitude**, because there the room is simply there. It does not count against L10's travelling-lift cap — this is the in-place device, which is a rule rather than a budget, and it needs no camera travel, so it fits inside 5a's existing wide hold without moving a keyframe. See beat 5. **AND THAT IS NOW ITS ONLY SITE.** The device existed on the statelines for legibility: at the old 884.8-wide composite the 17px sub read at 8.11px and the raise carried it to 10.13. L15's composite is **840** and the stateline **head** reads at 18.09px, so the raise would be growing a line that is already as legible as the shot can make it — while costing the 70px of card the trend now occupies, and while forcing every horizontal framing number to clear a raised rect rather than a resting one. The device survives as grammar at 5a; it is removed from the three statelines. **(At L16 the composite is 927 and the head reads at 16.39px. Still well clear of the floor, so the conclusion is unchanged.)** |
| L14 | **The monitoring surface is REARRANGED for the film — BUILT, and half of it is superseded by L15.** The pinned right column, the readout in the card's top band and the sub's two reserved lines all stand; the narrowed column narrows once more and the 70px stateline→controls gap goes with the controls. The reading column narrows to `max-w-lg` (512), and the viewfinder, the mail toast and the confirmatory prompt move into a **pinned right column at x 856–1176 that does not scroll**. The session readout moves into the stage card's own top band; the stateline's sub reserves two lines always; the stateline→controls gap goes 28 → 70. Arrangement only — nothing is re-styled, re-coloured or re-worded. | **The number this row used to quote was wrong and too kind.** Bloom-top to trend-bottom is **918.4px**, not 664.2 — that figure used the *empty* 101.5-tall trend card, and the populated one is 355.7. Against a 519px viewport it is 399px short, not 145, and **no 16:9 frame ≤1200 world px can hold 918px of stack at all.** The column layout does not fix that and nothing does; what it fixes is everything the single scrolling column was breaking. (1) The viewfinder was rendered *inside* the scroll container, so at `SCROLL.monitor = 40` its top sat at 269 against the toast's bottom at 291 — **the toast overlapped the viewfinder by 22px**, which is the "notification covers the viewfinder" complaint in beats 8 and 9. The stated 18px gap had been computed against the *unscrolled* viewfinder. Pinned, the overlap is gone by construction. (2) The two-line `tense` block had 94px of room for 93px of block — an emphasis cap of **1.0108×**, the film's central device dead on the film's most important reading. The 70px controls gap buys **1.25× with 46.75px still clear**. (3) 1176 is the drawn clock's own right edge, so "clock, toast and viewfinder share a right edge" becomes true of the render rather than of a comment. (4) The viewfinder is now in **all three** of beat 11's landings, which it could not be before — it used to scroll away with the column. |
| L15 | **THE MONITORING COMPOSITION IS ONE SHOT — orb, stateline, trend and viewfinder together, and the page does not scroll.** Five changes: the orb comes down **288 → 176**; the card's top band **64 → 48** and its bottom pad **40 → 24**; its `min-height` is released; the reading column narrows `max-w-lg` → **`max-w-md`** (448, centred at 376–824); and **the session trend joins the pinned right column under his face**, drawn at 768 and scaled to 320. **One of the five is a CONTENT liberty rather than a geometric one, and the distinction is recorded rather than blurred: the Pause / End session controls are DELETED.** Everything else here resizes or repositions something the product ships; this removes two real controls from a real surface. What it buys is the 114px between the stateline and the footnote — the exact room the trend needed. | **L14's arrangement still could not put the four things the monitoring act is about in one frame.** Bloom top to trend bottom was **985.9px against a 519px viewport**, so the trend was a separate landing 855px down the page, reaching it was a page scroll plus a camera travel, and the film's closing image was a graph arriving *after* the reading rather than beside it. At L15 the act is **401.2px of card beside 385.5px of pinned column**, inside the viewport, and `COMPOSITE` — beat 7's landing, beat 8's wide phase, beat 9's opening and **every** landing of beat 11 after the music player — is **840 world px** holding all four, with the stage card **whole, all four edges, for the first time**. The numbers it buys: the stateline head **36px → 18.09px on a phone** (was 17.2), his face **60.14px** (was 57.1), and the trend's plot at ~150 × 44px. **The trend's own height is what forced the scale**, and the arithmetic is the point: `session-trend-geometry.ts:53` fixes the plot's viewBox at `H = 210` and the card's chrome is the other ~145, so the card is **355.7 tall at 512 AND at 768** — rendered directly at the 320 the column has room for it would still be ~370 tall and nothing would have changed. Drawn at 768 and scaled to 320 it is **320 × 148.2**. **The cost is stated:** its 18px heading and 12px axis labels fall under the phone floor at that scale. What the shot has to deliver is the LINE — a tail that climbed through beat 8 walking back down in meadow — which is a shape rather than a reading. |
| L16 | **THE TREND MOVES INTO THE READING CARD, UNDER THE STATELINE — and the right column stops swapping occupants.** Three changes: the trend leaves the pinned column for the stage card, drawn at 768 and scaled to the card's own content width (**368 × 170.4**); the orb comes down **176 → 96**; and **FR-024's footnote — "Processed just for you — analyzed, then deleted." — is DELETED.** The viewfinder's top edge moves to the orb's (237); the toast moves with it to 101–205, keeping `PINNED_GAP` above the face; the confirmatory prompt lands 32 below it at 450.3 and covers nothing. | **The trend belongs under the reading it is the history of, and in the pinned column it shared a y with the confirmatory prompt** — so beat 9 covered a graph with a notification and the column changed occupants three times across four beats. It does not fit for free: at the card's own content width the column runs 587.6 against a 519px viewport, so **two blocks give, not one.** **The footnote's deletion is a CONTENT liberty, not a geometric one, and the distinction is recorded rather than blurred** — same category as L15's Pause / End controls. Everything else in this row resizes or repositions something the product ships; this removes a real privacy statement from a real surface. It is acceptable because the film states that idea far more loudly twice over: the camera consent gate is a whole beat, and beat 5a's privacy line takes the in-place emphasis at full amplitude. What it costs, stated: the composite goes **840 → 927 world px**, so the stateline head reads **18.09 → 16.39px** on a phone, the sub 8.54 → 7.74 and his face 60.1 → 54.5 — about 9% off every reading in the shot. What it buys: the card is **481.4 tall inside a 519px viewport** with the trend under the stateline and 24px of the card's own padding above and below it, and **the plot is the full width of its card for the first time** (see the register, item 14). |
| L17 | **THE TREND STOPS BEING A CARD INSIDE A CARD.** `<StageLayout/>` strips the component's own `mt-5 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6`, so the stage card reads as one uniform container with the session's history as its last block. Arrangement only — nothing is re-styled, re-worded or removed; the section, its heading, its subtitle and its plot are the product's, unedited. | **Two borders, two fills and two shadows a few pixels apart read as a panel pasted into a card**, and the nested `sm:p-6` was also the loose vertical spacing: every gap in that column is `CARD_PB` = 24 — bloom → head, head → sub, sub → trend, trend → card bottom — but the inner card added its own 24 *inside* those, so the visible air above "This session" was 48 and under the plot was 48, against 24 everywhere else. Stripping it removes exactly that doubling; **the freed room is not given to anything**, so the trend measures **305.7 tall instead of 355.7** (24 + 24 of padding and 2 of border, measured on `SwapProbe`), the stage card goes **481.4 → 457.5**, and the composite tightens **927 → 884.4** because height governs it. Every reading in the shot gets ~5% back, and the plot widens **720 → 768** — the full content width of the stage card. What is left in that column is the sub's own reserved second line, which is load-bearing and stays: without it the block resizes on the frame the copy changes to the two-line `tense` string. |
| L18 | **THE READING IS ONE NUMBER.** The stateline's band and the session trend's series are both derived from a single per-beat `level` (0 = at ease, 1 = fully tense) whose band crossings are placed **on** the frames the sheet already gives the copy changes. `bandOf(level)` is what the stateline shows; `trendPoints` places the newest window at exactly `level`. | **It was three independent authored timelines on one value, and they did not agree.** Beat 8 had the bloom on `useDrift(0,1,136)`, the stateline on `frame >= 158 / >= 180`, and the trend on a *third* ramp, `useDrift(0,1,146)` — whose own band crossings landed at ≈f162 and ≈f169, seven frames apart, so the graph crossed both thresholds inside a quarter of a second while the copy was still on its first change. That is the "starts already elevated and steps once" reading. Beat 11 was worse: the bloom finished drifting at f145 and the copy returned at f128, but the trend's descent did not *start* until f150 and did not finish until f189 — the orb and the stateline read at ease and the graph caught up 1.4s later. Both are gone by construction: the stateline and the graph's right-hand end are the same number read two ways and cannot drift apart at any frame. **The bloom is deliberately still its own curve and that is stated rather than hidden** — its drift is the component's own `transition: background 1.3s ease` and beat 8 lands it at f159 while the copy only reaches "tense" at f164, so one scalar with fixed thresholds cannot produce both without retiming a signed-off change. **And the series' shape moved with it:** only the **last ten windows** are ever drawn (`capByLegibility`, measured on the render), so the old rise at p 0.35–0.80 put its whole climbing edge outside the drawn window — the visible graph was already halfway up before the beat started. The rise now spans 0.42–0.80 and the tail 0.80–1.00, and the drawn ten walk `at ease ×10` → `at ease ×5 + a little ×5` (f142) → `at ease + a little ×4 + tense ×5` (f164) → `a little ×3 + tense ×7` (f184). |
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
- ~~**THE IN-PLACE EMPHASIS FIRES ON EVERY STATELINE COPY CHANGE (L12).**~~ **IT FIRES ON NONE
  OF THEM — L15.** The rule was written when the film's central reading needed the raise to clear
  the phone-legibility floor. At L17's 884.4 composite the stateline **head** reads at 17.18px at
  rest, so the device would be growing a line that is already legible, and the room it needs is
  the room the trend now occupies. **The device itself is untouched and is not retired:** beat
  5a's privacy line still takes it, at the same 1.25×, growing downward from its own top edge, and
  every rule below still governs it there.
  - **The movement must be CAUSED by the change, not merely near it.** A raise that precedes its
    cause teaches the audience the opposite of the rule.
  - **No yo-yo.** The block goes up once and settles once.
  - **It must never cover what is above it.** It grows *downward* from its own top edge, so the
    thing above it is untouchable by construction rather than by arrangement.
  - **AND ONE THING TO WATCH, RECORDED RATHER THAN ASSUMED AWAY.** The emphasis was also directing
    the eye at the moment the reading changed. Beat 8 steps "You're a little tense" → "You're
    feeling tense" inside a static wide hold, on copy that differs by a few words. What carries
    the escalation instead is the order the beat already had — the bloom drifts first, then the
    head changes, then it changes again, three separate movements in a frame where nothing else
    moves. **If that ever reads as easy to miss, the emphasis is the fix and it comes back for
    that one transition only**, not for all three firings.
- **HOVER IS A FUNCTION OF THE FRAME, NEVER OF A POINTER.** `:hover` cannot fire in a render —
  a render has no pointer — so **every `hover:` utility in `apps/web` is dead code inside this
  film**, and correct component usage does not bring it back. A treatment that is not gated on
  the frame does not exist on screen. Every treatment is **transcribed** from the product's own
  variant table and cited; the two controls that ship no hover get none; the single authored
  entry is declared as authored where it lives. See "Every interaction has a visible cause".
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

## The four interstitial cards

The Egyptian Arabic voice-over is dropped and LinkedIn autoplays muted, so **on-screen text is now
the film's only narration.** It goes on cards, not as an overlay. Three reasons, recorded so the
decision is not relitigated mid-build:

- The film is near-black with dark UI, so overlaid text needs a **scrim** — sitting on top of
  surfaces that took nine passes to frame.
- A caption floating over a screen **breaks the conceit that you are watching a screen.**
- The film already punctuates with a card (beat 12), so a card is **existing vocabulary** rather
  than a new device introduced in the last pass.

**And the card is the transition.** Where a card sits, it covers the change of composition. That
is the point of putting them at these four seams and not elsewhere.

| Position | Line |
|---|---|
| Between **beat 4** (the camera gate) and **beat 5** (calibration) | **First it learns what calm looks like.** |
| Between **beat 5** (calibration) and **beat 6** (later) | **Then it stays quiet.** |
| Between **beat 7** (at ease) and **beat 8** (the email) | **Until something changes.** |
| Between **beat 9** (questionnaire) and **beat 10** (Ren) | **Then it helps you come back down.** |

**Why these four seams and no others.** A card earns its place where the film jumps in time or
changes who is acting, or where the run of lines needs a premise. The first states what the film is
about to show and gives the three that follow something to continue from; the second covers the
only unexplained time jump in the film; the third marks the inciting incident; the fourth marks the
app ceasing to measure and beginning to talk. Every other seam is a chain where each screen causes
the next and the UI narrates itself.

**The first card does not go earlier than beat 4.** Placed between beats 3 and 4 it would land
immediately before the camera gate's own heading, "Before the camera turns on" — text stacked on
text. After the gate resolves, the screen is clear.

**The four lines are ONE SENTENCE across the film.** Read in order: *"First it learns what calm
looks like. Then it stays quiet. Until something changes. Then it helps you come back down."* Keep
them in that relationship — **do not re-word one in isolation.** In particular **"First" is
load-bearing**: it is what gives the two "Then"s something to continue from, which is why the first
card exists at all.

**"Calm" is deliberate.** The calibration line the first card introduces reads "Setting your
baseline — one calm moment…", so the card and its beat speak the same language.

**No landing-copy swap was available, and each was checked.** Beat 12's card takes its line verbatim
from `lib/landing/copy.ts`, which is what keeps the film's claims tied to the product's own, so all
four of these were checked against that file. None has a near-exact equivalent there; the four
near-misses are recorded in `video/src/greybox/copy.ts` § `INTERSTITIALS` so nobody re-checks them.
The closest phrasing of the first card — "what your calm looks like" — is **app** copy, in the
dashboard banner and the calibration success state, both already on screen in beats 3 and 5;
quoting one on the card that introduces them would make the card a caption of the surface behind it.

**Two constructions are reserved and do not appear on these cards:**

- **"X, not Y."** That is beat 12's construction and the film's one claim. Reusing it would make the
  closing card the repeat of a device.
- **The typewriter.** Reserved for domains — beat 1's omnibox and the end card's `.tech`. That
  reservation is the reason the bookend works.

**Treatment — beat 12's card, one size down.** Same face (Outfit), same weight (500), same tracking
(−0.01em), same ground (`CARD.field` #0b0c0e, three points deeper than the app's own page), same
ink, same centred composition, same **760** framing. They read as the same object as the closing
card, not as a second design.

**But beat 12 stays the largest text in the film.** It is 34px world at 760, which is **18.88px
phone-equivalent** (`world × 422 ÷ frameWidth`, this sheet's own arithmetic). The four are **27px →
14.99px**: clear of the 14px floor, and visibly — 79% — under the claim. They are connective
tissue; beat 12 is the claim. Both constraints hold at once with room to spare, so the stop-and-
report escape was not needed.

**Colour.** Near-black ground, off-white type, and **nothing else is available**: meadow, amber and
crimson all carry band meaning and foggy is Ren's structural colour. No red anywhere.

**Duration: 60 frames (2.00s) each** — in over f3–f15, **settled and static f15–f48 (33 frames,
1.10s)**, out over f48–f60. Short display text needs time to be read at a glance and then
registered, not just decoded, so the settled window is the number that matters and it clears its 1s
floor with margin.

**Entry and exit are a fade with eight pixels of rise** — beat 12's own gesture, so the four read as
one device *and* as the same object as the card they lead to. Not the typewriter, not the end
card's wipe.

**They are OUTPUT-timeline material, not authored beats.** A card is new material rather than a
retimed one, so it is inserted after the Premiere map has been read and runs at exactly its own 60
frames. Giving each a slot in the authored timeline would have shifted every source frame in
`retime.tsx`'s segment table downstream of each of the four insertions — thirteen hand-moved
numbers reproducing a cut that is already approved, for no gain. `CARDS` in `GreyboxVideo.tsx`
holds their four output frames; each is verified to land on the first frame of the beat it
precedes.

**One honest note on the third card.** Beats 7 and 8 already join on the *identical* shot
(`COMPOSITE`) on the *identical* surface — the two beats were deliberately built to be continuous
there. So that card is the one of the four that does not cover a change of composition; it is
placed for what it marks, the inciting incident, and it interrupts a continuity rather than hiding
a discontinuity. That is the trade and it is recorded rather than blurred.

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
(510 wide at x 64, headline at 67.2px) rather than the gap between two columns.

**AND THE BLOCK IS CENTRED IN THE FRAME NOW, WHICH THE WHOLE COLUMN CANNOT BE.** The shot used to
frame headline, lede, both CTAs **and the data line**, then shift the frame left so `<StoryCard/>`
stayed out of it — which is what put the block **71.9 world px right of the frame's centre line**,
**186px of a 1920 frame**, against a 486px left gutter and a 114px right one. Centring it on the
full column is not available at any margin: the column is 369.3 tall, 16:9 charges at least 656.5
of width for it, and centred at cx 319 that reaches the story card's left border at **626** every
time — 21.3 world px into it at best, 63.9 at the shot's real size, which is its border, the corner
of its bloom and two sliced lines of its narration. Rendered and confirmed rather than derived.

So the block that is centred is the one **without the data line**: headline, lede and both CTAs,
325.3 tall, which drops the 16:9 floor far enough to fit. `FR-024`'s privacy line sits **below the
frame's bottom edge, wholly out rather than sliced**, which is the framing rule's own alternative
to cropping, and the film states that idea twice over elsewhere — beat 4 is a whole beat of camera
consent and beat 5a's privacy line takes the in-place emphasis at full amplitude. The width is the
**widest centred frame whose right edge still clears the card's border**, so the margin is the
largest the geometry allows rather than a number picked to fit:

    frame        x  14.0 – 624.0   y 266.0 – 609.1     610 wide, a 3.15× push
    block        x  64.0 – 574.0   y 274.9 – 600.2     centred, 8.9 clear on every side
    story card   x 626.0                                2.0 clear of the frame's right edge
    data line    y 620 –                               10.9 below the frame's bottom edge

The tighter push is worth one number on its own: the 67.2px headline reads at **46.5px on a
phone** rather than 38.2. The cursor's own waypoints move with it — it rises into frame from
below, which is the only edge reliably off-frame while the camera is still pulling in.

**AND THE LIFT WAS PASSING BEHIND THE PAGE'S OWN NAVBAR.** This is the "grey thing emerging from the nav bar" that was reported against Pass C, found by frame-scanning the render: at f61 the `serenify.tech` pill is fully visible below the navbar, at f63 its top edge is cut BY it, at **f65 it is fully occluded**, at f67 it re-emerges above it inside the omnibox row, and at f69 it is seated. `<PublicNavbar/>` is `sticky top-0 z-50` (`public-navbar.tsx:88`) and `lift.tsx`'s wrapper carried **no `zIndex`**, so a positioned element at `z-index: auto` lost to `z-50` regardless of DOM order. **A browser's address bar can never be behind page content**, so this is a correction rather than a preference: the wrapper is `zIndex: 60`, which clears both of the film's sticky chromes and stays under the drawn cursor. Beat 3's calibration banner is the only other call site and both its rects sit below the header's bottom edge at 156, so it never crosses anything and the change is inert there.

**And the omnibox reads.** Its text was `OS.label` — recessive by design for a URL nobody reads,
which is the wrong treatment for the one URL in the film the audience watches being typed. While
lifted it takes `OS.clock`, the one furniture value allowed to clear the ramp's lightness band;
seated afterwards it drops back to `OS.label`. That is the same treatment a browser gives a
focused versus an unfocused address bar. **The face is Inter with tabular figures, not Geist
Mono** — see the typeface note above; a monospaced address bar is the tell of a drawn browser.

---

### 2 · Signup · 0:06 – 0:20.4 (14.4s)

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

**AND THE EMAIL WAS NOT THE EMAIL WE SEND. Three things, and the first inverts the sender.**

- **It carried the MAIL CLIENT'S OWN ENVELOPE MARK where the Serenify wordmark belongs.** The
  document is *from Serenify*; putting `MailMark` in its header says the message is from the mail
  app about itself. Worse, `MailMark` is the signature beat 8's whole misread-risk hangs on — the
  one glyph that says *this is not Serenify talking* — so spending it inside a Serenify email
  spends the exact disambiguation beat 8 borrows. The header is the real `<Wordmark/>` now, which
  is what `confirmation.html` puts there, and under the scene's `.dark` root its `text-ink` /
  `text-meadow-text` resolve to **#E2E5E8 / #63B292** — the template's own dark-mode wordmark
  colours, with nothing overridden. Every other `MailMark` site — the tab, the sidebar, the sender
  avatar, beat 8's toast — is untouched, because those are the client's chrome and are where the
  mark is correct.
- **The "Confirm email" button was left-indented.** The template centres it (`align="center"`),
  and it is a button sized to its own text rather than a fixed block flush to the card's left edge.
- **The card as a whole diverged from what ships.** It was one uniform padding block at a guessed
  **560px**; the template is **520** with **four rows on distinct paddings** — header/headline/body,
  the centred CTA, the code label and code, then a rule and the footer. It renders in the
  template's own `prefers-color-scheme: dark` values now rather than borrowing the mail client's
  furniture ramp: card `#181B1E`, a 4px `#63B292` top rule, `#23272B` borders, body `#939A9F`.
  **The two palettes never had to be reconciled** — `confirmation.html` ships a first-class dark
  variant, so the document wears its own colours inside a dark client, which is what an HTML email
  does. No red exists in either variant, so nothing about it tests the no-red rule.

The lesson is the one this sheet keeps re-learning in a new place: **quoting a template's copy is
not reproducing the template.** The words were right the whole time and the thing on screen was
still not what lands in his inbox.

**AND THE CLIENT IS BUILT — `video/src/app/mail.tsx`.** A real three-pane dark client: a sidebar
with six folders and their unread counts, a message list with the Serenify mail unread at the
top and **five plausible neighbour messages** under it, and a reading pane. The neighbours are
the whole reason it reads as somebody's inbox rather than as a diagram of one — a list with a
single row in it is a wireframe with a story attached. The email itself is drawn as a **document
card inside the pane**, which is what an HTML email looks like in a client; it is not the pane.
Generic in branding, specific in content, which is the L2b line held in both directions.

**Cost: beat 2 goes 13s → 16s, and it is the invariant's biggest bill.** Opening a tab,
typing a URL, waiting for a page and clicking a message open used to be five cuts; performed,
they are about three seconds. A cut back to Serenify after the code was explicitly allowed and
turned out not to be needed — the tab click costs half a second.

**AND 2e IS RETIMED — 15.6s → 14.4s, and NOT ONE PERFORMED ACTION IS CUT.** The new-tab click,
the URL typing, the page load, the row click and the tab switch back all still happen and are
still on screen for as long as they take to read. What was cut is the **holds around them**, every
one of which was outlasting its own read: the blank new tab before typing starts (10f → 6),
"Enter" to the page rendering (6 → 4), the loaded hold before the push onto the list (18 → 8), the
row after the click (10 → 6), the pull-out from the list (14 → 10), the page-scale hold (10 → 5),
the push onto the card (18 → 13) and the pull-back before the tab switch (10 → 8). The URL typing,
the row's own read and the card's own read are **unchanged** — those are the beat.

**140 frames of 2e become 104.** Everything from the tab-switch click onward — the wide hold, the
OTP choreography and the seam into beat 3 — shifts left by exactly 36 frames and is otherwise
untouched: the choreography still starts ten frames before the camera lands on it and still runs
its own 88 frames end to end.

*A third landing on the code block alone was built and dropped: at any framing tight enough
to enlarge the code, the frame edge cut the body line above it. The whole-card landing
already renders the code legibly, so "the push-in lands on the code" is honoured by where the
move ends rather than by cropping to it.*

**THE READING PANE IS EMPTY UNTIL THE MESSAGE IS CLICKED — register item 1, closed.** The beat
is "he opens the email and finds the code", and a click that reveals something already on screen
reveals nothing. The greybox showed a ghost of the body at `opacity: 0.16` beforehand, which is
one state at two opacities and not two states. **The pane now has two genuinely different
states**: before the click, the empty-selection state every mail client ships — a large
low-contrast envelope and "Select a message to read" — and after it, the message. **Nothing of
the email is in the DOM before the click.** The ghost is gone.

**The register said this applied "at beat 2 and beat 8"; at beat 8 it is structurally
inapplicable.** Beat 8 renders **no mail client at all** — it is the monitoring page plus
`<MailToast/>`, with no cutaway, which is that beat's own invariant. There is no reading pane
there to be empty. The requirement is met at beat 2 and there is nothing to meet at beat 8.

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

**AND THE VERIFY SCREEN HAD NO CODE INPUT ON IT.** The choreography was correct and the field it
belongs to did not exist. `<CheckEmailSurface/>` renders the OTP panel only when it is handed a
start frame (`auth.tsx:221-223` returns `null` without one), and the beat was gating that on the
same flag that fires the sweep — which does not go true until f352, the tab click back to
Serenify. So from the moment "Check your email" lands until f352, including **the whole wide hold
whose entire job is to say which screen this is**, the six boxes were absent from the DOM. The
audience watched a heading, a helper line, and then a row of filled meadow boxes arriving out of
nothing.

The gate was pure loss: `<OtpChoreography/>` already renders the correct unlit idle state for any
frame before its start, because every interpolation in it clamps on the left. So the panel is
mounted from the moment the state lands and the boxes are simply **there**, empty, waiting — which
is what the screen is for. The digits now land into a field the audience has already seen, and the
merge grows out of something rather than into existence.

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

**BEAT 2 WAS THE WORST-FRAMED BEAT IN THE FILM, AND IT HAD TEN SEPARATE CROPS IN IT.** Not one
bad landing — every landing. The beat is rebuilt against measured rects:

| | frames | width | what it holds | reads |
|---|---|---|---|---|
| establish | f0–f16 | 880 | wordmark, toggle, heading, sub, three labelled fields | heading **17.3px** |
| field group | f48–f70 | 664.5 | three fields and **all three** checklist rows | checklist 8.3px |
| password | f88–f110 | 479.3 | email, password, the checklist lighting row by row | checklist **11.4px** |
| consent | f134–f158 | 483.4 | the password group, the tick, "Create account" | consent **13.1px** |
| verify | f182–f196 | 777.8 | heading, body and the OTP panel whole | heading **16.3px** |
| chrome | f206–f250 | 1200 | the window, for the new-tab press | — |
| mail list | f264–f282 | 309.3 | the unread row and its neighbour, both whole | subject **17.1px** |
| the email | f324–f336 | 907.6 | the whole document card | code **11.6px** |
| OTP | f390–f448 | 508.3 | the whole panel, through the merge | pill **43.2px** |
| seam | f448–f467 | → 962.7 | the whole `(auth)` column, pulling out | — |

The ten, in one list, because the pattern is what matters: a checklist row under the page fold;
rows 2 and 3 sliced because `SIGNUP.fieldGroup` was measured against the **collapsed** checklist
(669) rather than the three-row one (704); a consent landing whose top edge ran through the
password input and whose bottom ran 59px past the window; a verify landing framing a rect 78px
taller than the surface it described; **two clicks with their targets outside the frame** (the
new-tab press, 130px above the top edge, and the tab switch back); a mail-list landing that sliced
"Inbox" at the top and, from the click onward, cut the opened message's own sender and subject at
the **right** edge — "Confi", "Se", "to"; an email landing with the card's whole bottom off-frame;
and an OTP landing whose top edge cut the panel in half.

**The email card does not fit the reading pane, and that is the client's honest behaviour.** It
measures **520 × 482.5** and its bottom lands 37.4px below the fold, so the pane scrolls 52px
between f278 and f300 — which reads as him scrolling down to read it, because that is what it is.
The alternative was growing the world, which L7 forbids.

**Both mail landings are new numbers, not inherited ones.** The old email rect said 560 × 470 at
(536, 88); the built card is 520 × 482.5 at (536.25, 230.7) in world coordinates. The sheet
already predicted this — "rects that changed size when the real mail client replaced the greybox"
— and the landings were still derived from the old ones.

---

### 3 · Dashboard, first arrival · 0:20.4 – 0:24.4 (4s)

He lands on `/app`. Uncalibrated.

**Arrives by pulling out, not by cutting.** After "Taking you in…" the camera pulls back from
the OTP row and the dashboard is simply what is there when it gets wide. Then the two things
that matter:

**AND THE JOIN USED TO FLASH, WHICH IS THE "STRAY FRAME BEFORE THE DASHBOARD".** It was never a
one-frame render glitch — beat 2's last sixteen frames are byte-identical to each other, and the
camera is mathematically continuous across the join (beat 2 ended on `frameRect(VERIFY.otpRow, 40)`
= `{600, 563.1, 432}` and beat 3 opened on the byte-identical `shot(600, 563.1, 432)`). **The
camera was continuous and the content was not.** Under that tight 432-wide rectangle the screen
swapped instantly from the green "Verified" pill to two unrelated dashboard card corners, because
the beats are a hard cut in `<Series>`. A matched framing over unmatched content is a jump cut
wearing a continuous camera's clothes.

So the pull-out **starts in beat 2**, at f448, and beat 3 opens on the same derived shot **still
rendering the verify surface** for its first twenty frames while the camera keeps widening. The
navigation fires at **f20**, which is the measured frame at which the dashboard's own left edge is
inside the shot. f10 was tried first and was wrong in the most instructive way: at 950 world px
the frame cut "Good morning, Youssef" to "…d morning, Youssef" — the seam fix reintroducing
exactly the defect it exists to remove.

Beat 2's f467 and beat 3's f0 render to a **maximum channel delta of 0**. One continuous move.

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

**THE DASHBOARD'S THREE CARDS WERE A LOADING SKELETON, AND THAT WAS A BUG.** They were dark
rectangles with an uppercase label and three grey bars each — the shape every product uses to
say *this is still fetching*. **Loading skeletons that never resolve is not something the product
does.** Software stuck mid-load is the most legible way a screen has of saying "this is a
mock-up", and it was saying it for four seconds on the beat whose entire job is *he is in, and it
is real*.

The reasoning in the code — that the real cards "would render their empty states… on the beat
that is supposed to say the product is live" — had the trade backwards. **At beat 3 he signed up
ninety seconds ago.** An empty account is not a compromise there, it is the truth, and the
product ships *written* empty states precisely because a new account is a normal thing to be. A
card that says "Nothing to nudge you toward right now" is a product with an opinion about its
own first-run. Three grey bars are a screenshot of a network request.

The real copy, which is what is on screen now:

- `<ThingsThatMightHelpCard/>` — **"Things that might help"** · "Suggestions land here when
  they're useful." · "Nothing to nudge you toward right now — Serenify is still learning your
  patterns."
- `<RecentChatsCard/>`, empty branch — "You haven't started a chat yet. When you do, threads stay
  here so you can pick them back up."
- `<TodaysCheckinCard/>`, static default — **"Today's check-in"** · "A quiet space for a quick
  read on how today is going." · "Watches for signs of stress while you work and checks in if
  something comes up." — plus the **"Start check-in"** CTA, which is the control beat 6 clicks.

**Two of the three are the shipped components, mounted so they take their no-data branch with no
network.** `<ThingsThatMightHelpCard/>` takes no props; `<TodaysCheckinCard/>` with no `userId`
early-returns in its effect, so nothing is fetched, nothing is awaited and nothing can fail.
**`<RecentChatsCard/>` cannot be imported** — it calls `loadConversations()` from a `"use server"`
module that pulls in `next/cache` and `@/lib/supabase/server`, which would drag a server-only
dependency graph into a Remotion bundle. Its empty branch is reproduced with the class strings
and the copy quoted character-for-character and line-cited, exactly as `shell.tsx` reproduces the
`(authed)` layout contract for the same class of reason.

**And all three skeleton heights were wrong.** Measured: **217.5 / 176.3 / 152.5**, against the
invented **196 / 168 / 168**. The grid row is 176.3 rather than 168 because the two cards are
deliberately not height-yoked — neither carries `h-full`.

**RESOLVED:** the revision-2 note that this beat had no push-in available and no fix short of a
type-scale liberty. The lift needs neither.

**Cost:** 5s → **4s**. The lift works and it stays, but it was spending about a second more
than the beat can afford. The 20-word sentence was never going to be fully read whatever the
hold — the lift buys legibility, not reading time — so the travel and the hold are both
tighter, and the beat reads as "calibration is required, he clicks" without lingering.

**Ends on:** the click on **"Set baseline"** — and then on **a move, not a cut.** The push
towards beat 4 starts here, at f108, and beat 4 opens on the same shot and finishes it. Before
this, the beat held the full 1200 frame to its last frame and beat 4 opened on a 616 landing, so
the framing changed on the same frame the page did: **two discontinuities on one boundary, which
reads as an edit** and is the one thing this film's own invariant forbids. It is the same seam
beat 2 already uses into beat 3, applied to the other boundary that was cutting.

**AND IT WAS STILL READING AS TWO MOVES, BECAUSE THE CAMERA STOPPED ON THE SEAM.** Halving the
travel is not the same as making it continuous. Both segments took the camera's default
`inOut(cubic)`, which eases *out* at the end of beat 3 and *in* at the start of beat 4 — so the
camera decelerated to a dead stop on the boundary frame and started again. Two segments that each
begin and end at rest are two moves however tightly they abut, which is exactly the note: *"the
timing reads as two separate moves rather than one."*

A single gesture is one acceleration and one deceleration, handed over **at speed**. Beat 3 now
departs on `in(cubic)` with no settle, beat 4 arrives on `out(cubic)` with no start, and
`BEAT4_SEAM` is placed where the two velocities match rather than at the midpoint of the distance:
beat 3 carries fraction *p* over 12 frames and beat 4 carries *1 − p* over 14, so *14p = 12(1 − p)*
and **p = 6/13**. The seam is that fraction along 1200 → 616 on every axis — **930.5** wide,
cy 327.9 — which lands close to the old hand-picked 900/327. The point was never that the midpoint
was badly placed; it was that both halves came to rest on it. Measured on the frame-by-frame shot
width, the camera's speed used to fall to **0.7 world px/frame at the boundary** between peaks of
63.2 and 52.6; it now peaks **at** the boundary, 61.9 → 62.7, and decays monotonically to zero.
**The surface change is the fastest frame of the move rather than its only stationary one**, which
is what the seam wanted in the first place.

---

### 4 · Camera consent gate · 0:24.4 – 0:28.4 (4s)

~230 words. Unreadable at any speed. Do not try.

**The page is SCROLLED, because the real page does not fit.** At 1200×675 the gate is ~890px of
page — a badge, a heading, ~230 words across two bordered cards, and the CTA — in a 583px
viewport. Showing it scrolled is the honest behaviour, and it reinforces what the copy is
saying: this is long because it matters. **Cost: 4s → 5s**, all of it the scroll.

Establish the shape — the circular camera badge, the heading **"Before the camera turns on"**,
two bordered cards below — then scroll, then the button.

**⚠️ THE LANDING ON "Nothing is kept…" IS GONE, AND IT IS NOT A TRIM.** The beat used to establish,
scroll, pull out, push in on that line and hold 34 frames on it, then fling to the buttons: five
movements and six seconds for a beat whose content is a long page and a button. But the reason it
goes is not pacing. **The claim was being made twice, two beats apart.** This landing held
"Nothing is kept. There is no bucket, no table, and no file path where a clip lands.", and beat 5a
lands on "Your video isn't stored — only the calm reading it produces." Same claim, back to back,
which makes the second read as a repeat rather than as a promise.

**The calibration one is kept.** It is tighter, it reads at 10.01px against this one's 8.96, and
it sits at the moment the camera is actually about to turn on, which is when a privacy claim
carries weight. This beat keeps the page — 230 words of it, visibly scrolling, which is the beat's
real content — and hands the sentence to 5a. That is also what stops the beat lingering.

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
closes it. So the beat takes **three landings inside its one continuous move** — establish, the
key line, then the CTA — which is this sheet's own remedy for this class of problem, applied once
more.

| | frames | width | what it holds |
|---|---|---|---|
| **seam** | f0 | 930.5 | beat 3's push, arriving **at speed** — the surface changes under a moving camera, on the fastest frame of the move |
| **establish** | f14–f72 | 616 | the badge, the heading, the lede, and the first card's top border |
| **CTA** | f104–f120 | 658 | the last three bullets of "What declining changes", its bottom border, **Allow** and **Not now** |

The scroll is **one continuous travel to the page's bottom** now, held under the establishing
camera and finished under the pull to the buttons. It used to stop at 250 for 58 frames while the
camera read a line.

**The landing used to arrive mid-layout, and that was a bad rect rather than a bad shot.** It
held the key line surrounded by sentences sliced at *both* the top and bottom edges, with no card
border anywhere in frame — a crop of something bigger, which is exactly what the framing rule
forbids. `GATE.*` was 64px high on every value (the third instance of the header-less probe; see
the note at the top of this file), so the shot was correct about a page that does not exist.

**And its legibility was being quoted from the wrong type size.** The bullets are **`text-sm`,
14px** (`camera-consent-gate.tsx:149`), not the 17 that "12.7px on a phone" was derived from. At
the 659 landing they read at **8.96px** — under the floor, and that is stated rather than
smoothed over. The card is 568 × 416.2, so a frame holding all four of its borders costs **≥740**
world px, at which the copy drops to 7.98. There is no framing at this world that puts a
416-tall card of 14px body copy over 10px, and the beat's own text says so: ~230 words,
unreadable at any speed, do not try. What the landing has to do is show *a whole card of privacy
copy, with the key sentence in it*, and it does. **The heading reads at 20.6px and the CTA label
at 10.26px** — the two things the audience is actually meant to take away.

**Cost: 6s → 4s.** The beat had six seconds for five movements; it has four for three, and the
one it lost was making a claim another beat makes better.

---

### 5 · Calibration · 0:28.4 – 0:42.5 (14.1s)

**This is where the character first appears.** Not beat 7 — here, in the green room, because that's where you genuinely first see yourself.

**ONE TAKE**, and it now runs all the way to the dashboard. **Cost: 10s → 12s → 12.4s** — the
uploading line is ~1.3s and the success state plus its click is ~2.7s, offset a little by 5a
getting simpler; the last 0.4s is reading time for the success copy (see 5f).

| Sub-beat | Time | Content |
|---|---|---|
| 5a | 0:32–0:34 | **Intro, and it STAYS WIDE.** "Set your calm baseline" + the three icon rows (armchair / sun / clock). The rows are short and the whole screen reads without magnification, so there is no push-in — the old one onto **"Turn on camera"** was buying nothing. Ends on the click. |
| 5b | 0:34–0:37 | **Green room — first sight of him.** He settles into the 3:4 portrait framing target. The brackets are graphite. Then the gate clears: **brackets turn meadow, a meadow glow blooms, a small check appears top-centre.** Status line reads **"You’re all set — start when you’re ready."** He looks calm, mildly curious. |
| 5c | 0:37–0:38.5 | **Countdown.** 3 → 2 → 1, white numerals over the blurring preview. **45 frames — 15 a number, half a second each.** Compressed, but a count rather than a flicker. |
| 5d | 0:38.5–0:41 | **Recording.** The breathing orb pulsing over his softened preview, label alternating **"Breathe in" / "Breathe out"**. The 6px meadow progress bar advancing beneath, with the real mm:ss on its row. **Show ~2.5s of a 60s process** — still the most aggressive compression in the video. |

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
"Setting your baseline…" out of nowhere. The bar is back, and it is the real component. **The
readout followed it a pass later, onto the bar's own row — see below.**

**The orb's PERIOD is the one thing staged.** The timer and the bar take the beat's 40×
compression directly, because a counter running fast reads as a counter running fast. The breath
cannot: at 40× the discs flutter five times a second and the pacer strobes, which is the one
thing on screen that would contradict the word "calm". At the real 8s cycle a 1.5s window shows
under a fifth of one breath and the label never changes, so the pacer's whole nature is
invisible.

**ONE BREATH WAS NOT ENOUGH, AND THE REASON IS THAT THE POINT OF THE MINUTE IS THE ALTERNATION.**
The cycle used to be the length of the window, which gave exactly one breath — in, out — two
phases at 22.5 frames each. Two phases do not read as a rhythm; they read as one label that
changed once, and at that compression the guide could not be read at all, which loses the whole
reason for showing the minute. The audience has to see it **alternate**: breathe in, breathe out,
breathe in. So the cycle is set from a **phase count** rather than from the window —
**three phases, 15 frames each, half a second apiece** across 5d's 45 frames. Four would be
11.25 frames, 375ms, which is the strobe this note already warns against; three is the only count
that satisfies both ends, and the third phase gets its full fifteen frames before the cut, so no
phase is clipped. Measured: **f195–209 "Breathe in" · f210–224 "Breathe out" · f225–239 "Breathe
in."** Shape, amplitude, easing and copy are all the component's; only the period is staged, and
the discs follow the same parameter, so the rise and fall stay locked to the words.

**5c COUNTS, AND IT GETS 45 FRAMES — 15 a number, half a second each.** At the old thirty that
would be a third of a second per number, which is a flicker rather than a beat settling. It is
driven from the frame, keeping the component's own face, size, tabular figures, drop shadow and
its 300ms zoom-and-fade.

**AND "NO FRAME-ADDRESSED RENDER EVER FIRES A TIMEOUT" IS FALSE. That claim was the bug.**
It was written here, and in `motion.tsx`'s own header, as an invariant about the medium. It is
not one. **Remotion keeps ONE live browser page and steps the frame on it**, so wall-clock time
keeps passing between frames and `setTimeout` fires exactly as it would anywhere else.
`<GetReadyCountdown/>` schedules `setTimeout(() => setCount(c => c − 1), 1000)` on mount
(`get-ready-countdown.tsx:29-33`), and that effect is **not** gated on reduced motion — the
media-query shim changes which *variant* a component renders and stops no timers.

So two clocks were driving one numeral: the component's internal `count`, ticking about once per
real second, and the frame-derived value, stepping every fifteen frames. The numeral painted was
`count`. And because `from` only seeds `useState` on mount, the `key={value}` remount **re-seeded
`count` back up** every time the frame clock stepped — which is the rewind. Once `count` reached
zero the component returned `null` (`:46`), which is where the blank stretches came from. The
sequence on screen was `3 · 2 · 1 · 2 · 1 · 1`, and it was **non-deterministic** — the exact
garble varied with render speed, so the same frame rendered two different numerals depending on
whether the page was fresh.

The fix keeps the real component — it is still the 128px `role="timer"` box — and hides only its
stateful numeral behind a scoped `visibility: hidden`, with the frame-derived digit drawn over it
carrying `get-ready-countdown.tsx:49`'s className character-for-character. That is the same seam
`<BreathPacer/>` already uses one file over. Moving the `key` onto the frame would have fixed
rendered frames and left the second clock alive for any frame held longer than a second.

**The general lesson is larger than 5c.** Any component in this film that schedules a timer is
running it against wall-clock time inside the render, and anything derived from that timer is
outside the frame's control. The rule is not "timers do not fire" — it is **"a value the film
addresses by frame must have exactly one source, and the component's own must be suppressed
rather than out-run."**

**THE FIFTEEN FRAMES COME OUT OF 5d, NOT OUT OF THE CAMERA, AND THAT CONSTRAINT DECIDED IT.**
Framing is Pass B's and no keyframe moved. The camera holds BEAT5_GREENROOM to f150 and lands on
BEAT5_PREVIEW at f172, so a countdown starting before f150 plays its first two numbers at the
green-room framing — and worse, `<GreenRoom/>` unmounts the moment the phase flips, so those
frames would hold a **204px hole** where its card had been. So the countdown stays at f150 and
5d goes **60 frames → 45** (~2s → ~1.5s). **The trim list already priced this** — "Beat 5, 12.4s
→ 10.5s. 5d recording can lose a second" — so it spends half of a cut already agreed available.
Beat 5 stays 372 frames and the running total does not move.

**AND THE MINUTE GETS ANOTHER SECOND — it was still too compressed.** 5d ran **45 frames, a 40×
compression**, and at that rate the three phases got 15 frames each: half a second per phase,
which is the *floor* at which a pacer reads as a pacer rather than as a flicker. The beat was
sitting on the floor, so nothing in it could breathe. 5d is **75 frames** now (2.5s, 24×) and the
phase count stays at three, so each phase gets **25 frames — five sixths of a second**. That is the
difference between seeing that the label alternates and being able to follow it. The bar and the
readout take the new compression directly, as they always did. **Everything after it shifts +30
and nothing else about the beat changes. Beat 5 goes 372 → 402 frames.**

**5d's MINUTE NOW HAS NUMERALS, AND THEY ARE PACED.** The bar came back last pass and the
readout did not. `<RecordingTimer/>` is the real readout and it already renders — in the
controls card **below** the preview, because FR-031 keeps status *words* off the raw video — but
that card starts at world y 492 and 5d's framing ends at 504, so the mm:ss sat **8px under the
frame's bottom edge**: visible in the product, out of shot in the beat. Framing is out of scope,
so the readout came to the shot instead — the same component, on the bar's own row, inside the
existing framing. The row is height-capped at 16px so its 20px line box centres and finishes
**4px clear** of the frame's 504. **FR-031 is honoured rather than worked around:** this is
neither words nor on the video, and the product's own reading of its rule is
`<GetReadyCountdown/>`, which puts numerals *over* the feed on the grounds that they are numbers
only.

**The compression was LINEAR, and linear is what made the minute read as a jump cut.** One story
second per frame gave the bar no shape at all and gave the readout thirty distinct values a
second — digits as flickering texture rather than as a time. It is **eased in and out** now
(starts near real time, races, settles — the shape that reads as elapsed time rather than as a
skip), with the numeral **held four frames at a time**: about seven readouts a second, 133ms
each. **The bar stays continuous; only the digits are paced.** The two can disagree by up to four
story-seconds mid-run, which is 6.7% of the bar's width and not a comparison anyone can make at
133ms — and stepping the bar to match would turn a smooth fill into fifteen visible jumps.
| 5e | 0:41–0:42 | **Uploading.** The capture stage is **replaced** by the line, verbatim from `components/anchor/anchor-recorder.tsx`: **"Setting your baseline — one calm moment…"** — and **the camera closes in across the replacement.** |
| 5f | 0:40–0:43 | **The camera PULLS OUT, then he clicks.** The bloom ripple, the check drawing itself, and the real success state from `components/anchor/success-state.tsx`: **"Your baseline is set"** (`text-3xl sm:text-4xl`) · "We’ve learned what calm looks like for you. You can update it anytime from your account." · the **"Back to home"** button. All three are in frame, all four edges inside it, *before* the click. Then he clicks, and lands on the dashboard. Beat 6 continues from that frame. |

**5a CARRIES THE FILM'S PRIVACY CLAIM, AND IT TAKES THE IN-PLACE EMPHASIS (L12).** The line is
**"Your video isn't stored — only the calm reading it produces."**, and it is at
`components/anchor/intro.tsx:52` — the **calibration intro**, not the beat-4 consent gate, which
has its own separate pitch. It gets the same grow-and-settle the stateline uses, at the same
**1.25×**, and unlike the stateline it gets the device at **full amplitude**, because here the
room is simply there.

Measured, growing downward from the line's own top edge and outward from its horizontal centre:
the line is **418.4 × 20 at (390.8, 370.6)** inside the intro; raised it is **523.0 × 25** with
its bottom at 395.6 against the "Turn on camera" block's top at 422.6 — **27px of clearance**.
Horizontally it runs 37.5px past the invisible `max-w-md` boundary onto empty page background,
and BEAT5_INTRO gives **249px of clearance each side**. It does not count against L10's
travelling-lift cap: this is the in-place device, which is a rule rather than a budget, and it
needs no camera travel, so it fits inside 5a's existing wide hold without moving a keyframe.

**MOTION ONLY. IT IS NOT RECOLOURED, DELIBERATELY.** Everything else this film adapts is
geometry. Recolouring a privacy claim would be a different kind of change — it would make the
sentence more prominent in the video than it is in the product, which is a claim *about* the
product rather than a staging *of* it. The `text-muted` grey and the meadow shield stay exactly
as `intro.tsx` sets them.

~~**And the emphasis buys emphasis, not legibility.**~~ **IT BUYS BOTH NOW — the framing was
found.** At 1021.5 world px the line's real 14px landed at **5.8px on a phone**, 7.2px raised.
5a now takes a landing at **590 world px**, held f32–76, where it reads at **10.01px seated and
12.51px raised** — over the floor at rest and comfortably over it under the emphasis.

Three measured facts made it possible, and the first is a correction: **the line is `text-sm`,
14px** — several notes about it had been reasoning from 17. L12's raise takes it to **523 wide**,
so no frame narrower than about 570 can hold it whole. And a **27px page lift** opens a clean
vertical window between the lede's last line (315.6) and the helper line's bottom (659.6) — 344px,
which 16:9 allows up to 611. 580 sits inside that with 7.1px of gutter at both edges.

**The lift is a fix, not a device.** The intro column is preview (288) + `mt-4` (16) + card
(204.2) = 508.2 against 519px of visible page, so it *fits* — `main`'s own `pt-8` simply starts it
32px too low, which was slicing **"Your browser will ask for permission next."** at the viewport's
bottom edge at rest. The window is [21.2, 32] and 27 is the middle of it. It drops to 0 at 5e,
where the content no longer overflows.

**The instruction not to recolour stands and was not spent.** The emphasis is the same 1.25×,
growing downward from the line's own top edge, in the component's own `text-muted` grey with its
meadow shield. Only its *window* moved — 0–42 → 32–62 — so it fires while the camera is landed
rather than while it is still travelling. **The sheet's "5a STAYS WIDE" was written when the beat
had no other option**; a push-in that lands on a whole element and holds long enough to read is
what the framing rule asks for everywhere else in this film, and it costs the beat nothing.

**5e/5f corrected.** The earlier version covered the viewfinder with a success state and then cut
to the dashboard, skipping the uploading line, the real success copy and the click. All three are
part of the chain and the click is a real action.

**AND THE FLIP INTO 5e WAS A CUT WEARING A CONTINUOUS CAMERA'S CLOTHES.** 5c, 5d and 5e all played
inside one static `BEAT5_PREVIEW` hold, so at the swap the capture stage — preview, orb, pacer,
progress bar, mm:ss — was **replaced in a single frame under a camera that was not moving.** Every
pixel of the shot changed at once with nothing carrying it, which is exactly the defect the beat
2 → 3 seam already exists to fix. The camera **closes in across the swap** instead. Not a
transition effect — the same push-in grammar the rest of the film uses, put on the boundary that
needed it. It also takes the line from 11.4px on a phone to **12.98px**.

**AND THE CAMERA WAS ARRIVING BEFORE THE THING IT MOVED FOR.** The move ran **f244 → f272** and
the flip is at **f270**, which is **26 frames into a 28-frame travel** — under
`Easing.inOut(Easing.cubic)`, ~99.5% of the distance. So what played was an abrupt push while the
breathing minute was still running, a moment of stillness, and then the surface changing under a
camera that had already stopped: the cut wearing a continuous camera's clothes, reintroduced at
the other end of the move. Both `framing.ts` and `Beat05Calibration.tsx` carried comments about
this — *"20 frames into a move"*, *"26 frames into a move"* — and **neither was what the numbers
did**.

It runs **f264 → f292** now, so the flip lands **six frames in — 21% of the travel** — where the
camera is still visibly moving. That also gives 5d its last two-thirds of a second back to a
static camera, which is the other half of what was asked for.

**The cost is paid by the film rather than by 5d.** The uploading line's settled hold is 26 frames
and it is the only moment that line is on screen under a stopped camera, so the pull-out to
`BEAT5_SUCCESS` moves f298 → f318 and everything after it shifts by the same 20. **Beat 5 goes 402
→ 422 frames.** 5d keeps every frame it had; nothing was compressed to absorb this.

**AND THE LINE SAT IN THE TOP QUARTER OF THE FRAME.** In the product this line appears *where the
stage was* — the column above it still carries a heading and the stage's own box, so it lands
around the middle of the page. The film's reproduction replaces the whole stage with the
paragraph, so with only its own `py-10` above it the line fell at world y 228–252: a quarter of the
way down a frame whose centre is 322, reading as a caption pinned to the top rather than as the
app taking over. It is dropped **82px** — the distance from where it falls to where the stage's
own centre was — so it arrives on the axis the preview just left. Spacing only: the paragraph
keeps its verbatim class string and its verbatim words.

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

**BEAT 5'S FIVE LANDINGS, AND THE THREE CROPS THEY FIXED.**

| | frames | width | what it holds |
|---|---|---|---|
| **intro, wide** | f0–f8 | 920 | the whole intro, nothing cut |
| **intro, read** | f32–f76 | 590 | the three icon rows, the privacy line seated **and** raised, "Turn on camera" and its helper line |
| **green room** | f98–f150 | 921 | the 512×288 preview **and** the green-room card, whole |
| **capture** | f172–f268 | 590 | the preview, the countdown, the orb and its pacer, the capture bar and its mm:ss |
| **success** | f306–f354 | 700 | the ripple and the component, **centred** |

**AND THE FIRST GUIDELINE ROW HAD SEVEN PIXELS OF HEADROOM, WHICH READS AS A CROP.** The window
this landing has to sit inside is bounded by two things nobody had measured: the lede's last line
ends at **315.6** and the helper line's bottom is at **659.5**, so anything outside [315.6, 659.5]
slices a line of type. The first guideline's icon tile — the 40px square beside "A quiet moment to
yourself" — starts at **347.5**. At 580 the frame ran 340.5 → 666.7: nothing was *actually*
sliced, and the tile had **7px** of headroom, which at this beat's magnification is 23 output
pixels. A content element sitting 23 pixels off the frame edge reads as cropped whether or not it
is, and "it measures fine" is not an answer to that.

The arithmetic is a fixed budget rather than a free choice: with the helper line in shot,
`headroom + helperClearance = h − 312`. At 580 that is 14.25 and the split was 7 / 7.2. At **590**
it is 19.9, split **12 / 7.9**, with 19.9 above the lede as well — every clearance grows and the
seated line stays over the floor at 10.01px. Buying more headroom means a wider frame, and at 611
the seated line drops to 9.66. 590 is where both constraints are met.

Three things were being sliced at rest and are not now: the green-room card's bottom border and
21px of its padding, **"Beginning now — settle in."** (which the old countdown framing cut through
at 504), and the helper line under the privacy claim. The first and third were the page starting
32px too low, not the camera; see 5a's lift.

**THE COUNTDOWN NO LONGER PUNCHES IN, AND THE CEILING ON HOW FAR IT COULD PULL BACK IS TIGHT.**
5c used to land at `frameRect(CALIB.preview, 28)` — a macro shot of a numeral, which is what made
a count that was already broken feel abrupt as well. It now shares the capture landing at **590**,
where the count reads as part of the scene and the breathing guide's three phases are legible in
the same shot at **10.01px**. That 590 is not a taste value: `<RecordingStage/>`'s card top is at
489 and the get-ready line's bottom at 485, which caps the shot at 592, while the pacer's own 10px
floor sits at 590.8. **The two constraints meet within three pixels.** The next framing that holds
a whole element below it is ≥858.7, where the pacer falls to 6.88px and 5c would hold 154px of
empty page.

**And the f150 constraint survives the reframing.** The countdown still cannot start earlier:
`<GreenRoom/>` unmounts on the phase flip and leaves a 204px hole under the held green-room
framing, and the green room is now framed *wider* rather than tighter, so the hole would be more
visible rather than less. 5c stays at f150 and 5d keeps its 45 frames.

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

### 6 · "Later" · 0:42.5 – 0:43.7 (1.2s)

Continues straight from beat 5, which now lands on the dashboard itself. The calibration banner
is gone — that absence is the beat's visible content — and he clicks **"Start check-in"**.

**It is the SAME component as beat 3 with one flag off**, which is what makes the absence read:
the `space-y-10` column closes up and everything below the missing banner moves up by 126,
exactly as the product does when `has_anchor` flips. A separately-drawn "beat 6 dashboard" could
not have produced that, and would have drifted from beat 3 the first time either was touched.

**AND THE BEAT WAS CLICKING EMPTY PAGE.** It drew its own 152 × 44 "Start check-in" button,
floated it at **(1000, 300)**, and clicked *that* — because `<TodaysCheckinCard/>` underneath it
was a grey skeleton with no button in it, so there was nothing real to press and a button was
invented to press instead. The real CTA is **126.3 × 40 at (49, 399.6)** — the bottom **left** of
the card, not the middle right of the page. Both the drawn button and the guessed position are
gone; the pointer travels to the shipped control and presses it, and it has a hover (meadow,
easing over 150ms) because the shipped control has one. This is the same defect as beat 10's
seven-pixel miss, one order of magnitude larger: a hand-typed coordinate standing in for a
measurement.

**The "later that morning" text is GONE.** No replacement.

**The time jump is DECIDED, and it is out of scope.** The toolbar clock (L11) reads 10:43 here
and 11:30 in beat 7, and the session timer reads `47:12`, so the information is on screen and
consistent — but it will still play as continuous time and that is fine. "He calibrated, he
worked a while, an email came" is what the audience takes away and it is correct. Do not spend
anything on making the jump read.

**Shot:** locked on the full frame.

**And that costs one number, recorded rather than smoothed over.** At the full 1200 the "Start
check-in" CTA's own 14px label reads at **4.9px on a phone** — well under the floor. It stays,
because the beat's content *is* the banner's absence and absence is only legible at full frame:
any push-in tight enough to read the button would frame away the empty space that is the point.
The audience does not need to read the label to see a cursor press a button, and the label was
read four seconds earlier in beat 3.

**AND THE TWO CARDS AT THE BOTTOM WERE CUT BY THE PAGE, NOT BY THE CAMERA.** With the banner gone
everything below it moves up by 126 — the beat's whole visible content — and that is also what
dragged the suggestions row into the viewport: the row runs **568.6 – 744.9** against a fold at
**675**, so 106px of two cards sat in shot with their bottom halves below the page's own edge.
**No framing could fix it.** The dashboard column is `max-w-6xl` (1152) at x 24–1176, so any frame
tight enough to end above the row slices "Good morning, Youssef" — and a sliced line of text is
always a failure. (Beat 3 never had the problem: with the banner present the row starts at 694.6,
already below the fold.)

The gap under the check-in card was widened until the row cleared the fold entirely — **150** —
and that was the wrong answer in the other direction. The beat then read as a dashboard with
nothing at all under the check-in card, which is not what the page looks like: "Things that might
help" and "Recent chats" exist and the shot should say so.

**THEIR HEADERS ARE READABLE NOW — 66.3px, measured on the render.** 34.4px was shape only and
the note is that it is not enough: *"their headers need to be readable — 'Things that might help'
and 'Recent chats'."* So the control is no longer how much card is on screen, it is where the
heading's own baseline lands against the fold. The gap is the whole control and the relationship
was taken off the render rather than off the recon's arithmetic, which was 42px optimistic about
where the row starts:

| gap | visible | reads as |
|---|---|---|
| 150 (before) | 0px | not there at all |
| 148 | 0px | exactly on the fold |
| 118 | 30px | top border, corner radius, a sliver |
| 112 | 34.4px | shape only — what the last pass shipped, and what "not enough" refers to |
| 108 | 40px | the above plus the first line of each label breaking the fold |
| **80** | **66.3px** | **shipped** — both headings whole, with air; the fold cuts the SUBTITLES |
| 60 | 86.3px | headings and both subtitles — more page than the note asked for |
| 0 | 106.3px | two cards sliced through their body copy |

Measured on a still of this beat at output y: at gap 80 the cards' top border is at 974, the
heading ink runs 1017–1053 and the fold is at 1080, so both headings clear it by 27px and the
subtitles are what the page cuts. `Recent chats`' whole header row comes with it — the "with Ren"
qualifier and the "+ New chat" control share the heading's line.

**Nothing above it moves.** The check-in card's bottom border is at output y 845 at gap 112 and at
gap 80 alike; the 32px comes out of empty page, which is what the note asked to confirm. The shot
does not change at all: beat 6 is locked on the full world frame, so "Good morning, Youssef" is
untouched and no framing decision is involved.

**It is still not readable on a phone, and that is stated rather than implied.** `CardTitle` is
`text-xl` (20px), so at the full 1200 frame it lands at **7.03px** — up from the ~5px the body copy
reads at, still under the ~10px floor. The three things that would clear it are a tighter framing,
the in-place emphasis, or a camera move, and all three are excluded here.

**AND THIS IS A DELIBERATE EXCEPTION TO "NO CONTENT ELEMENT CROPPED AT REST" — recorded so a
later pass does not "fix" it.** The framing rule bans a content element sliced by the **frame**;
this crop is the **page's own fold**, at a shot that is the whole 1200-wide world and involves no
camera decision whatsoever. A page that continues past its viewport is what every page does, and
beat 3 already shows these same two cards below the fold with the calibration banner in place.
The camera crops nothing here.

---

### 7 · Working, at ease · 0:43.7 – 0:46.1 (2.4s)

The monitoring session, live and settled.

- The **bloom** pulsing meadow, centred in the stage
- Stateline: **"You're at ease right now"** · "Steady and settled — nothing to do."
- The session trend below, a steady meadow step-line
- Corner readout: **`Session · 47:12`**, ticking. Animate the seconds — it's a small liveness cue that costs nothing.
- The viewfinder (L1, enlarged), showing him **content and lightly smiling**, working — gaze
  down at the keyboard, shoulders carrying the typing. This is the face beat 8 has to fall
  *from*, so it is held rather than played.

Wide enough to hold bloom, stateline, **the session trend** and viewfinder together. This is the
"before" — the audience needs it registered so the fall lands.

**AND THAT IS ONE SHOT.** Beat 7's landing, beat 8's wide phase, beat 9's opening and every
landing of beat 11 after the music player are the same frame, and the stage card is **whole inside
it, all four edges** — every version before L15 ran the card off the top, the bottom and the left
and defended it as "the ground the reading sits on", which was true and was also the only option,
because at 675 tall the card could not be held whole by any 16:9 frame ≤1200. Beat 8's two tight
landings are unchanged; what has gone is the film's need to travel down the page to find the
trend.

**AT L17 THE COMPOSITE IS 884.4 AND THE TREND IS INSIDE THE CARD, WITHOUT A CARD OF ITS OWN.**
The union is two rects rather than three — the stage card (376–824 × 188–645.5) and the pinned
viewfinder (856–1176 × 237–418.3) — and **height governs now** where width did at L15, so anything
that shortens the card tightens the frame for free. The frame's top is still placed on **156**, the
app header's own bottom.

At L16 this was 927, because the trend was rendering inside its own `rounded-2xl border bg-surface
sm:p-6` card nested in the stage card. Stripping that chrome takes the stage card 481.4 → **457.5**
and the shot follows the geometry: **927 → 884.4**, giving back most of what the trend cost when it
joined the card — head 16.39 → **17.18px**, sub 7.74 → **8.11**, his face 54.5 → **57.1**. Nothing
was retuned to get it; the landing is `frameRect` over the union, which is the whole reason every
shot in this pass is derived rather than picked.

~~**The first firing of the in-place emphasis (L12), and it costs nothing.**~~ **THE EMPHASIS IS
OFF THE STATELINES.** It existed to carry the 17px sub over the phone-legibility floor at a
884.8-wide composite; the composite is 884.4 and the **head** reads at 17.18px at rest, so the
device would be growing a line that is already as legible as the shot can make it. The room it
needed — the 70px stateline→controls gap — is the room the trend now occupies. See L12 and the
invariant; the device is unchanged at beat 5a.

**THE COMPOSITE IS 840, AND IT HOLDS FOUR THINGS.** The union is the stage card (376–824 ×
188–589.2) with the pinned viewfinder and the pinned trend (856–1176), so `frameRect(m=20)` gives
**840 × 472.5** and *width* governs — the vertical clearance is 35.6px rather than the nominal 20.
The one number placed rather than derived is where that slack goes: centred on the union the
frame's top edge lands at 152.4, which puts a 3.6px sliver of the sticky app header across the top
of the film's most-repeated shot, so the top is set to **156**, the header's own bottom edge. The
whole frame lands inside the page's 156–675 band with nothing on the camera backdrop at any edge.

Measured consequences, against the 884.75 it replaces:

- the stateline **head** at **17.18px** on a phone (16.39 at L16, 18.09 at L15, 17.2 before it)
- the stateline **sub** at **8.11px**, from 7.74 — and there is no raise to lift it any more. It
  is a secondary line under a head that reads at 17.18, and that trade is stated rather than
  smoothed over
- his head at **57.1px**, from 54.5
- the trend's plot at **~166 × 47px** and FILLED edge to edge — at L15 it drew across 42% of its
  own card (register item 14), and the plot itself widened 720 → 768 when the inner card's padding
  went. A shape anyone can read walking back down

**THE PREVIOUS NUMBER WAS FRAMING A RECT THAT DID NOT CONTAIN THE COPY.** The greybox framed ~1096 world px because it drew the viewfinder as a separate
320-wide panel 300px to the right of a 700-wide card. The component pass replied with **760**, on
the reasoning that the real viewfinder overlays the card and so the union is far tighter. Both
were measured against the *`at_ease`* sub, and that turned out to be the whole problem:

**THE `tense` SUB IS 430 WIDE, NOT 287.6, AND IT WAS CROPPED AT REST.** It is the only one of the
three copies that wraps, and a wrapped paragraph **fills** its `max-w-[42ch]` box instead of
shrink-wrapping to its longest line. `geometry.ts` recorded 287.6 — the `at_ease` width — and
every horizontal framing number in the file was derived from it. The 760 composite began at world
x 436, so in beats 8 and 9 **the film's most important reading was sliced by 51px, at rest, before
any emphasis fired.** It was invisible in review for exactly the reason the two-line clipping was:
every still anyone framed was an `at_ease` one. The composite now frames the **raised** rect of
the **widest** copy — the same class of arithmetic as `SUCCESS_FRAMED`, and for the same reason:
the bounding box that matters is not the one at rest.

Measured consequences:

- the 17px sub lands at **8.11px** on a phone at rest and **10.13px raised** — so the emphasis is
  now carrying the sub over the legibility floor rather than decorating a line that was already
  over it. That is what L12 is *for*, and it is available on every band rather than on two of three
- his head is **~57px** on a phone here
- **the layout is the product's own, rearranged rather than padded** — register item 2 stands. The
  card is still `min-h-[480px] … px-10 pb-10 pt-16` with a `sm:size-72` (288) bloom and the real
  `mt-6` between bloom and stateline; what L14 changed is the column's width, where the readout
  sits, and the gap below the stateline. The emphasis still grows downward from the block's own
  top edge, so it cannot reach the bloom by construction rather than by arrangement.

**The page does not scroll at all any more.** It sat at 28 through beats 7–9 and travelled to 580
in beat 11, because the trend was 855px down. At L15 the whole act is 401.2px of card beside
385.5px of pinned column inside a 519px viewport, so there is nothing below the fold and nothing
to scroll to. **Beat 11's third landing WAS that scroll**; it is one settled frame now.

**The camera pushes f0–36 and stops, and the beat holds for the same 36 frames it travelled
for.** The split exists because the raise used to fire while the camera was still arriving, which
made the device read as ambient motion rather than as a response to the copy; it survives the
raise's removal, because a shot that lands and then holds is what lets a state be registered.

**AND THE BEAT IS 72 FRAMES, NOT 120.** It was a 60-frame move on a **10% push** (974 → 884.4)
followed by a 60-frame hold in which nothing happened at all — L15 took the raise off this beat
and nothing replaced it. Against the film's own numbers that is twice the median camera move and
ten times the first half's median dead dwell. Halved on both sides. **Nothing that has to be read
is cut**: the stateline is legible for the whole beat rather than only after the landing, running
15.6px → 17.18px on a phone across the push, so a three-word head and a one-line sub get 72
frames — 2.4s — of legible screen time.

**It settles HERE rather than handing the raised block to beat 8.** The intent was to carry it
across the join, but beat 8's push-in frames from world x 708 and the raised block's right edge
is at x 800 — a raised block put 92px of panel and a sliced word inside the video's single most
important shot. The framing does not allow the join, so the join is not forced; beat 8 raises its
own, once, covering both of its copy changes. That is the constraint that matters.

**RESOLVED:** the revision-2 open decision on beat 7's sub-line.

---

### 8 · The email · 0:46.1 – 0:52.2 (6.1s)

**THE TOAST MOVES WITH THE VIEWFINDER — 96–200 → 101–205 (L16), AND THE BEAT'S FIRST LANDING DOES
NOT MOVE AT ALL.** The viewfinder's top edge went to the orb's (212 → 237), so the toast follows it
down and keeps `PINNED_GAP` above his face rather than sitting "4px under the page's own top edge",
which was a number about a page rather than about the stack it belongs to. It still clears the
drawn clock's bottom (88) by 13. `BEAT8_CLOCK` frames `CLOCK ∪ TOAST` and **width still governs at
368**: the union grew 5px taller and 16:9 charges 346.7 for it, under the 368 the stack's own width
already costs. The clock reads at 32.1px and the subject at 16.05px — identical. Phase 2 pays
instead: the toast-to-face union is 20px taller, so it goes 613.9 → 649.4 and the fall plays at
77.8px rather than 82.3. That is the price of the alignment and it is stated rather than absorbed.

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

**THE TOAST IS FINISHED, AND IT IS A macOS SONOMA BANNER — `video/src/app/toast.tsx`.** A
squircle app icon (a clip-path superellipse over the **shared** `MailMark`, not a fork of it, so
2e's signature and beat 8's icon cannot drift apart), and a **two-stop vibrancy gradient**
(`panelTop` → `panel`, 2.7 L\*) — because at beat 8's ~4.2× magnification a flat fill is *the*
tell of drawn chrome, and this is the one surface in the film that has to pass as the audience's
own operating system. Radius 14 → 18. **Tabular figures on the subject line**, because its "12"
and the clock's "11:30" are the two numbers the audience subtracts and they share the
BEAT8_CLOCK frame; two sets of digits doing arithmetic together should not have different
metrics.

**The "Mail" app-name row is KEPT deliberately**, even though modern macOS banners often omit it.
It is doing disambiguation work — see the misread risk above — and dropping it to be more
faithful to Sonoma would cost the beat the one label that says *this is not Serenify talking*.

**The subject wraps to two lines and that is not a regression.** Measured: 289.95px of text in a
242px column. It is why the rect is **104 tall rather than 82**, which this sheet's geometry
already recorded as the reason.

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
| **clock** | f30–f68 | **368** | clock + toast | clock at **32.1px**, subject at **16.1px** |
| **face** | f80–f102 | **649** | toast still up + his face | **THE FALL**, head at **77.8px** |
| **wide** | f134 on | **840** | bloom, stateline, **the trend**, viewfinder | both stateline changes |

The clock, the toast and the viewfinder share a right edge at **1176** — the drawn clock's own,
restored by L14's pinned right column. The previous pass had moved the *rect* to 1063 and left the
*drawing* at 1176, which is why the clock rendered **"11:30 A"** with its meridiem cut off in the
one shot the beat's whole arithmetic depends on.

**THE TOAST DISMISSES AS THE CAMERA REACHES THE WIDE PHASE, AND THAT IS DECIDED.** It slides out
at f104. Keeping it up through the wide would push that framing from 884.75 to ~1000 to hold a
banner nobody is reading any more, and the wide phase is where the **emphasis** has to land —
pushing the frame wider there is exactly the "the emphasis lands softer rather than harder"
failure. L2 is untouched by this: L2 is about the *fall*, and the fall happens at the 614 framing
with the toast up, which is the whole of what that liberty protects. A macOS banner auto-dismisses
after a few seconds anyway, so the beat gains a small piece of fidelity rather than spending one.
It is a slide-out, not a pop.

Sequencing matters here: let the **toast land and be read first**, then his face reacts, then the bloom moves. The order is what makes it cause-and-effect rather than three things happening at once.

Then, in one continuous shot with the toast still up:

1. He reads it. **His face falls** — 16 frames of continuous travel through the whole pose
   vector at once, and **it happens at the TIGHT framing**, where his head is ~100px on a phone.
   He also stops typing here, and does not start again until beat 11.
2. The **bloom drifts** meadow → mixed → amber. The real transition is 1.3s ease, so a band change *drifts rather than snaps* — keep that, it's the honest behaviour and it looks better.
3. The stateline changes: **"You're a little tense"** · "A bit of an edge lately. Maybe a slow breath."
4. Then further: **"You're feeling tense"** · "This has held a while. Serenify can check in when you're ready."
5. The trend line below climbs and recolours — **arriving at each band on the frame the copy does**,
   because it and the stateline are one number read twice (L18). The drawn ten windows walk
   `at ease ×10` before f120, `at ease ×5 + a little ×5` at **f142**, `at ease + a little ×4 +
   tense ×5` at **f164**, and `a little ×3 + tense ×7` by the beat's end.

**THE ESCALATION WAS TWENTY FRAMES LATE AND THE DRIFT WAS OFF SCREEN.** Both defects were the
same thing twice — *the reading changed while nobody could see it*:

- The drift ran f104–f143, and the bloom does not enter the frame until the camera has widened
  to about f128. The audience met an already-amber bloom, and "let it drift, don't snap" was
  being spent behind a tight shot. It begins at **f116** now and its last two thirds play in
  frame.
- The stateline changed at f150 and f176 while this sheet, and the beat's own header, both said
  f130 and f156. The code had drifted twenty frames later than the plan, which put a dead second
  between the fall settling and anything else moving.

**ACT THREE NOW HAPPENS AFTER THE CAMERA STOPS, WHICH IS THE WHOLE POINT.** The camera lands wide
at **f134**, and everything that has to be *watched* runs from there: the drift begins f120 (so
its last two thirds play in frame) and the copy changes land at **f142 and f164**. Nothing fires
mid-travel. The previous cut raised at
f142 — before its first copy change and while the camera was still arriving — and never settled,
so neither change carried movement, and the one that did read was competing with a moving frame.

~~**The emphasis fires on the first change and settles as the second lands.**~~ **THERE IS NO
RAISE HERE ANY MORE (L15).** What carries the escalation instead is the order the beat already
had: the bloom drifts first, then the head changes, then it changes again — three separate
movements in a frame where nothing else is moving, on copy that reads at 17.18px rather than the
17.2 it used to. **This is the one thing to watch in the whole pass**, and it is recorded rather
than assumed away: if the "a little tense" → "tense" step ever reads as easy to miss in a static
wide, the emphasis is the fix and it comes back **for that one transition only.** See the
invariant.

**Do not rush this.** It is the largest single allocation in the video and it's correct — this beat is the entire product thesis in one shot.

**Cost: 6s → 6.1s, and the character rig is what found it.** The camera used to arrive tight and
begin pulling out immediately, so by the time the face fell the shot was already ~930px wide and
his head was ~45px on a phone: the fifteen most important frames in the video were playing at the
width where a face reads least. It was invisible while the face was a labelled grey box. The tight
framing **holds** through the fall, and that hold is what keeps the second stateline change
readable rather than paying for the fall out of it.

**AND THE HOLD ON THE FALL WAS 32 FRAMES LONGER THAN THE FALL.** The travel finishes at f86 and
`dismayed` is a **constant** pose after it, but the camera sat at `BEAT8_FACE` until f118 — 32
settled frames on a face that had already arrived. It leaves at **f102**, giving the fall 16
frames of settle, and the whole third act shifts by the same −16 so every gap inside it is
unchanged: the drift, both copy changes and the trend's two band crossings keep their exact
spacing, and the crossings still land on the frames the copy steps on. The toast's 38-frame hold
at the clock framing is untouched — that is the film's only piece of arithmetic — and the second
stateline change keeps its 20 frames to the end of the beat.

---

### 9 · Confirmatory questionnaire · 0:52.2 – 0:54.7 (2.5s)

**THE RING ON THE OPTIONS IS GONE, AND THAT IS A FIDELITY CORRECTION RATHER THAN A LIBERTY.** A
meadow ring arrived on "Yes, that's me" the moment the prompt opened and was still there under the
cursor's click. **It is `:focus-visible`, and `:focus-visible` cannot fire on a mouse click in a
real browser** — `confirmatory-prompt.tsx:27` is
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow …`, a keyboard-navigation
affordance and nothing else. Two things conspired to draw it anyway: Radix's `<Dialog.Content>`
moves focus to its first focusable child on open, and Chromium's focus-visible heuristic treats
programmatic focus as keyboard-ish when no pointer input has ever happened — and in a render, none
ever has. So the film was drawing a state **the product never shows to a mouse user**, on the one
beat whose entire subject is *he was asked and he answered*. Removing it makes the film **more**
faithful, not less, which is why it is recorded here rather than in the liberties table. Verified
by A/B render: suppressing the rule changes 603 × 113 output pixels by up to 151 levels, and the
diff is the ring. What remains on the control is what a real click genuinely produces — the
cursor, its press dip and click ring, and the option's own shipped `hover:bg-[…]` easing over
`transition-colors`.

The sticky confirmatory prompt appears beside the stage. He answers — **and confirms the stress is real.**

**This is the true-positive branch.** The landing page hero deliberately shows the false-alarm branch. That inversion is intentional and must not be reconciled.

**He clicks it, and the click has a cause now.** A focus ring arriving on "Yes, that's me" with
nothing touching it reads as a stray keyboard focus rather than as a person deciding, which
inverts the one beat whose entire subject is *he was asked and he answered*. The pointer travels
to the option and presses it.

~~It is drawn in SCREEN space, outside the camera.~~ **IT IS A WORLD RECT NOW, AND THAT WAS THE
FRAMING COMPLAINT.** `<Notification/>` portals to `document.body` and is `fixed right-4 …
bottom-[…]` (`notification.tsx:186`), so it resolved against the 1920×1080 output frame and sat
outside the camera's transform entirely — which is why the prompt used to sit in the same corner
of the frame **regardless of where the camera was looking**, and why the beat clicked it while the
camera was holding on the orb. A beat whose entire subject is *he was asked and he answered* was
answering a question that was not in the shot.

It is placed in the pinned right column at **x 856–1176, y 450.3**, below the viewfinder, so the
camera can push in on it like anything else.

**AND ITS TWO GUTTERS AGREE NOW.** It used to sit **flush against the stage card** — the column
began at 856 and the card ended at 856, so the horizontal gap was **zero** — while carrying 30.7px
of air above it to the viewfinder. Two different spacings on one element, and the tighter one was
nothing. L15's reading column is `max-w-md` (448), which `mx-auto` centres at 376–824, so 856 is
exactly **32** away; and the prompt begins exactly **32** below the viewfinder's bottom. That the
column width the composition wanted happens to produce the gutter the spacing wanted is luck, and
it is recorded as luck — 448 was chosen first, for the orb.

**It overlays the trend, which starts at the same y**, and that is correct rather than a
collision: `<Notification/>` is `fixed` in the product and lands over whatever page content is
under it. Beat 9 does not need the trend in shot. The landing is `frameRect(PROMPT, 24)` at **600.9**
world px, where the option copy reads at **10.5px** on a phone — over the floor — and the click at
f66 lands 24 frames into a held shot, on a target that is in frame, and the beat ends 10 frames
after it — the prompt has no response state, so the frames after the press were a stopped camera
on a stopped surface. The pointer moved into world
coordinates with it.

Two edges are stated rather than hidden. The prompt is 320 wide at x 856, and no 16:9 frame at or
above the 368px minimum, centred on it, clears the stage card's own right edge at 856 — so this
landing's **left edge runs through the card and the tail of the `tense` sub**. That is a
background element in a shot whose subject is the question and the three answers, and it is the
kind of overlap the framing rule's full-bleed exception exists for. Beat 9's own copy is whole.

**RESOLVED — the copy exists and is signed off.** `apps/web/components/questionnaire/confirmatory-prompt.tsx`:
title **"Checking in"**, body **"Your signals have looked tense for a little while. Is that how
you're feeling?"**, options **"Yes, that's me" / "No, I'm okay" / "Maybe — talk about it"**. He
picks the first. Nothing to recon.

**Cost: 4s → 3s.** The read is quick and 4s sat on a read the audience had finished two seconds
earlier. The prompt lands, then the click follows.

---

### 10 · Ren · 0:54.7 – 1:05.1 (10.3s)

The chat opens. **A real three-turn exchange, each message legible.**

**REN WAS INERT IN HIS OWN BEAT, AND THAT WAS TWO SEPARATE FAILURES WEARING ONE FACE.**

`<ChatShell/>` mounts `<RenAvatar/>` with **no props at all** (`chat-shell.tsx:447`), so he
rendered at the shipped default — **34px, `state="idle"`** — for the whole 210 frames. L8 had been
in the liberties table since the greybox and had never actually been built. And the camera punched
in on him at f32 and pulled back out at f38: **six frames**, which is not a shot, it is a twitch —
and it was punching in on a 34px circle with no expression, so there was nothing there to land on.
He is the companion the whole product is built around and he had less presence than the mail
notification in beat 8.

**Both are fixed, and neither needed anything invented.** `<RenAvatar/>` ships **four real states**
(`ren-avatar.tsx:52`) and they are not decorative: `attentive` opens the eyes 1.22× and lifts them,
`thinking` shrinks them to 0.62× and drops them down-right — a squint, away from the reader — and
`warm` drops the open pair entirely for the closed, smiling one. Those are the product's own
measured values. The film drives them from the frame, at L8's size, through the same seam
`calibrate.tsx` uses on the countdown numeral: the shipped avatar is hidden and the video draws its
own.

**`attentive` IS DROPPED FROM THE FILM ENTIRELY (2026-07-31), AND IT IS NOT TO APPEAR ANYWHERE.**
It is a good state at the 34px the product draws it at and a bad one at four times that: the 1.22×
eye-scale and lift read as a **stare** at conversational size, and the film is the only place the
avatar is ever seen large. `idle` goes with it — beat 10's Ren is either composing or he has just
answered, and neither is idle.

**His arc, decided, and it is two states** — the states are discrete in the product, so they snap,
and the one snap left sits on the frame its message arrives:

| Frame | State | What causes it |
|---|---|---|
| f0 | `thinking` | he is composing the opener, and the typing indicator says so. It runs **through** turn 1 landing and does not change when it does: he has spoken, and now he is waiting on a person who is typing, which is the same state |
| — | `thinking` | through the whole of turn 2's typing and through his own composing of turn 3. One continuous state, not two: nothing happens between them that would cause a change |
| f250 | `warm` | ON turn 3 — **the eyes close.** `warm` drops the open pair entirely and leaves the closed, smiling one (`ren-avatar.tsx:90`), so the moment the Michael Jackson suggestion lands is the moment his eyes shut. It is the product's own state for exactly this, and the only expression change in the beat |

**And the blink is a function of the frame now.** It is a **7s infinite CSS animation** crossfading
two eye groups (`globals.css:310-321`) — wall-clock, not frame time, so in a render it landed
wherever the previous frame's capture happened to leave it. See the note on `<StillMotion/>` at the
top of this file: that component pins both pairs at the product's own resting opacities, and this
beat re-authors the two values per frame instead, so he blinks on the film's clock.

**THE BEAT LANDS ON HIS FACE AND HIS OPENING LINE TOGETHER.** The pass before this one gave him a
real 300-wide face landing and held it, and deliberately kept turn 1 **out** of frame — by 0.65px —
revealing the bubble with the move off his face. That paid for the performance and left the opener
itself **never read above 8.33px**, its widest framing in the cut being the 760 working shot.

**One framing holds both, comfortably, and the constraint that said otherwise was about the wrong
bubble.** *Any landing holding both the avatar and his bubble ending at x 919 is ≥638px wide* is
about **turn 2** — `self-end`, running out to 919. Ren's own opener is `self-start` and ends at
**x 630.5**, 288px narrower, and escapes the constraint entirely:

    union(REN_AVATAR, CHAT.turn1)   x 270.0 – 630.5   (360.5)
                                    y 194.8 – 324.1   (129.3)
    frameRect(m=40)                 w = 433.5 – 440.5   (width governs)

At that width **turn 1 reads at 14.37px on a phone**, 1.7× the 8.33 it had. The camera goes there
at f24 and **holds across the landing**: Ren composes on screen (`thinking`, with the typing
indicator in turn 1's own slot), the line arrives at f38, and it gets 36 frames — 1.2s — before the
camera moves. The message is **read** rather than revealed. The avatar's size barely moves the
frame, because turn 1's own right edge governs it — which is what makes L8's three variants
comparable at all.

The frame's top edge is placed rather than centred, at **156**, the app header's own bottom — the
same treatment `COMPOSITE` and `BEAT5_SUCCESS` get. Centred it lands at 137.5 and puts 18.5px of
the sticky header, and a slice of one of its icon buttons, across the top of the shot.

**The shell's empty-thread greeting is suppressed for those 52 frames.** `<ChatShell/>` renders
`emptyGreeting` whenever the log is empty (`chat-shell.tsx:424`) — in the panel variant a second
`<RenAvatar/>` and "Hi, I'm Ren · A calm place to think out loud." That is correct for a thread a
person opened and wrong for this one: **Ren speaks first here**, and a greeting sitting under a
typing indicator is two openings at once, with a sliced line of the greeting's body copy at the
landing's bottom edge. Same seam as `<RenFace/>`'s own `visibility: hidden` — the component keeps
every class it ships with; the film chooses which of its states is on screen.

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

~~**All four states are timed.**~~ **Two are — see the arc above.** `attentive` and `idle` do not
appear in the film.

The exchange, written:

| Turn | Who | Content |
|---|---|---|
| 1 | **Ren** | "Something shifted just now. What happened?" — opens gently, and with less clinical distance than "how are you feeling". |
| 2 | **Him** | **VERBATIM, and the lowercase is his:** `boss moved the deadline to 12. i have only thirty minutes to finish the report`. Decided 2026-07-31, character for character, including the missing capitals and the full stop mid-line. Somebody typing at speed with a deadline in half an hour does not reach for the shift key, and that is the whole reason it is written this way. **It TYPES ON.** |
| 3 | **Ren** | "Thirty minutes is enough — just not like this. Put Billie Jean on first. You always settle faster with MJ playing." — **because it knows he likes MJ.** |

**Turn 2 is 78 characters against the 49 it used to be, and the beat pays for that rather than
speeding up.** At the beat's own ~25 c/s that is **92 frames of typing instead of 58**; *never
sped to fit* is the rule and the copy is now fixed, so the beat grows. It also makes turn 2 wrap
to **two lines**, which moves turn 3 down by 26.4px — `CHAT.turn3` carries that, and it matters
because turn 3's rect is also the slot the typing indicator draws in while Ren composes it.

**Turn 3 is the beat that sells the product** and it needs to land as *personal*, not generic. The whole difference between Serenify and a wellness app that says "try deep breathing" is that Ren knows this specific person. If the audience reads turn 3 as a canned suggestion, the beat is dead. Whatever the final wording, it must make clear that Ren knew this about him already.

**HIS MESSAGE IS PERFORMED IN THE COMPOSER — RESTRUCTURED.** It used to type directly into a
bubble that did not exist yet, and the text bled out of it. The bleed was a symptom; the real
problem was that **the beat showed the result of an action instead of the action**, which is the
one thing the one-take invariant exists to prevent and the same note this sheet already applies
to tabs, clicks and scrolls everywhere else. So the beat does what a person does:

    f86   the cursor sets off, during the move off the landing
    f102  the caret click, 8 frames after the camera has settled on the working shot
    f104  he types THERE, into the real textarea — 78 characters at ~25 c/s
    f202  the pointer ARRIVES at send; the button lights on that frame
    f206  he hits send. The bubble lands with it, sized by the real component to its own content
    f214  Ren shows the typing indicator (L9), in turn 3's own slot
    f250  Ren replies, and his eyes close on the same frame

Two defects resolve as side effects, both because a real bubble sizes to its content: **the bleed
is gone**, and so is **the over-tall reply bubble**. Neither was ever a text-fitting problem;
both were drawn boxes with guessed widths.

And it earns something the old staging could not: this is the one moment in the film where he
acts through *language* rather than through a click, and the beat now **shows** that instead of
asserting it. Ren keeps the typing-indicator-then-message treatment (L9). The human types; the AI
thinks, then speaks.

**THE TYPING INDICATOR EXISTED BUT WAS A PHOTOGRAPH OF ONE.** Its three dots carried a **static**
stagger — three fixed opacities, held for 34 frames beside an otherwise still frame. A stagger
that never travels reads as decoration, not as a state, which defeats L9's entire justification:
the liberty exists because `thinking` is otherwise dead air, and the only thing that makes a
state legible *as* a state is motion. It is a **travelling wave** now, on a 0.9s loop, each dot a
third of a cycle behind the last, over the same **0.35–0.8** opacity range so its resting weight
against the thread is unchanged. The human types; the AI thinks, then speaks — unchanged, and now
visible.

**And the send button's click was seven pixels wide of it.** Both waypoints were hand-typed
against a 44px control starting at x 879, aiming at x 872 — outside its left edge. Measured now,
against the real `<ChatShell/>`; see the pointer note at the top of this file. The button also
gets the film's one **authored** hover treatment, because the shipped control declares none.

**AND THEN THE SEND READ AS A DOUBLE CLICK, WHICH IS A DIFFERENT DEFECT IN THE SAME PRESS.** The
hover opened eight frames before the click while the pointer was still parked in the composer —
`hover.tsx` addresses the DOM by selector and never reads a coordinate, so nothing stopped it. The
button lit, *then* the cursor crossed it, *then* the click fired: two separate acknowledgements of
one press, which is what a double click looks like. The order is causal now and each step has its
own frames — **the pointer's travel ends at f138, the hover opens on that frame** (a control
acknowledges a cursor that has reached it) **and the click lands four frames later at f142.** §2's
rule — *it lights before it is pressed* — is intact; what was wrong was that it lit before it was
*reached*.

**THE TYPING HAD NO CARET AND THE CURSOR WOULD NOT SIT STILL.** Two defects, unrelated to each
other, both of which made the one moment in the film where he acts through *language* read wrong.

- **The caret was pinned to the left of the field.** There was no authored caret at all — what was
  on screen was the real textarea's own DOM caret, and it sat at position zero because
  `<ChatShell/>` is remounted on every keystroke (the wrapper keys on the draft's length) and
  `chat-shell.tsx:119` re-focuses the composer on each new node. Focusing a textarea whose value
  was **set** rather than typed puts the caret at the start of the value, not the end. A real
  caret could not have been used anyway: its blink is wall-clock, and this film addresses frames.
  So the DOM caret is hidden with a scoped `caret-color: transparent` and an authored one is drawn
  at the measured end of the typed run — advance taken from a synchronous canvas `measureText`
  against the composer's real `400 15px Inter`, not a per-character guess, so it is frame-stable
  and calibrated rather than approximated. It blinks on its own half-second.
- **The cursor swiped across the field while he typed.** The pointer's path had three waypoints —
  arrive at the composer at f30, reach send at f92 — and the typing runs to f98, so that single
  eased leg dragged the cursor across the box through almost the whole typing window. A pointer
  that drifts while someone is typing is wrong in the plainest way: his hand is on the keyboard.
  A fourth waypoint holds the composer position through f98, so the leg is zero-motion, and the
  travel to send is a short move arriving exactly on the click.

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

**AND THE SHOT PLAN HAD STOPPED BEING DERIVABLE, WHICH IS WHY THIS BEAT WAS WRONG THROUGHOUT.**
Beat 10 was the only beat in the film framing hand-typed `shot(cx, cy, w)` values — five of them,
tied to no measured rect — because `geometry.ts`'s `CHAT` block described **only the composer**,
which is where the click was. None of the things the beat actually frames existed as rects: the
conversation header, Ren's avatar inside it, the log, the three bubbles. Framing you cannot derive
is framing nobody can check, and this beat is the proof. The rects are measured now and the
landings are unions of them again, which is what the greybox had:

| | frames | width | what it holds |
|---|---|---|---|
| **panel** | f0–f6 | 889 | the whole chat panel, establishing — brief, and the only shot that crops nothing |
| **his face AND his opener** | f24–f74 | **433.5** | Ren, "Ren", "here to listen" and turn 1 whole — the line at **14.37px on a phone**, the 42px avatar at **40.9px**. He composes inside it and the message lands at f38 |
| **turn 2** | f94–f222 | 760 | the header, his bubble, the composer and the send — **one static hold** across the typing and the click |
| **turn 3** | f246–f310 | 665 | the header and turn 3 — the protected hold, **60 frames, untouched** |

**THE BEAT COMES BACK 332 → 310, AND BOTH CUTS ARE TYPING INDICATORS.** An indicator is *looked
at*, not read: L9 exists to make `thinking` legible as a state, and once it has been legible every
further frame of it is a moving element the audience has already understood. The two composing
windows ran **52 and 44 frames** — 1.7s and 1.5s — against a beat whose own protected reads are 36
and 60. They run **38 and 36** now. Both reads are untouched to the frame: turn 1 still gets its 36
frames at 14.37px inside its landing, turn 3 still gets its protected 60 at L3, and the typing
itself is untouched at 92 frames for 78 characters, because 25.4 c/s is already faster than a
person types.

**EVERY NUMBER IN THIS BEAT IS AUTHORED, AND THE FILM NOW READS THEM AT 1.40×.** The Premiere cut
(see "Running total") runs beat 10 at 1.40× from its f47 to its f306, which is the typing, the
send, the thinking and turn 3. The beat's own timeline is unchanged and this is still what the
sheet describes; what lands on screen is **turn 1 at 28.3 frames instead of 36**, **turn 3 at 44
instead of its protected 60**, and **the typing at 35.6 c/s instead of 25.4**. Both protected reads
and the typing rate are therefore under the floors this section sets. Left as cut — the decision is
Mohamed's and he has watched it — and recorded here so the two sets of numbers are never confused
for each other.

**TURN 1 IS THE ONE OF THOSE THREE THAT IS NOW OVERRULED (2026-08-04), AND IT IS THE ONLY ONE.**
*"Something shifted just now. What happened?"* is seven words; at a typical silent reading rate they
need about **1.7s**, and the cut gave them **0.94s**. The previous pass flagged it and left it as
cut deliberately, because the decision was Mohamed's. It is made: the read gets its time back.

The fix is in the **time map**, not in this beat — no keyframe here moves. `retime.tsx` splits the
1.400× segment at the read: source **1680 → 1716**, which is this beat's own **f38 → f74** (the
frame turn 1 lands on, to the frame the camera leaves on), runs at **0.706×** over **51 output
frames — 1.70s**, from 28.3. Everything after it shifts +23 output frames and no other rate,
boundary or source frame in the table moves.

**Slowing below the authored rate is safe here and would not be everywhere.** The camera is static
across those 36 authored frames, the message has landed, and the only things moving are Ren's blink
and his `thinking` pose — both frame-derived, so Remotion genuinely draws the in-between positions
rather than repeating frames. That is the whole argument for a time map over a resample, spent
here.

**The other two stay exactly as cut.** Turn 3 keeps its 44 output frames (1.47s), and the typing
keeps its 35.6 c/s — which reads as text *appearing* rather than as a person typing, and is
accepted as that.

**Ren's avatar is in all four**, which is the requirement L8's enlargement exists to serve and
which the header placement now guarantees by construction.

**Turn 2 is deliberately one hold rather than a move down to the composer.** The pointer travels
to the composer, clicks, and then rests — so if the camera drifted there it would be the only
thing moving in a shot whose whole subject is a person typing. One static frame holds the typing,
the send and the bubble that follows it.

**AND ONE NUMBER SETS THIS BEAT'S SCALE, so it stops being re-litigated.** Ren's avatar sits at
x 281 and *his* bubble runs to x 919: **any** landing holding both is ≥638 wide before margins.
That is why turns 2 and 3 read at 8.33 and 9.52px rather than over 10 — a property of the
conversation's own layout, not of the framing, and not fixable by a tighter shot without dropping
the avatar, which is the one thing this beat may not do.

**Dependency:** the recommendations surface is `014-recommendations` and does not exist. This copy is written for the video. Keep it plausible against what 014 will plausibly ship — don't put a UI on screen that the product will never have.

---

### 11 · Return to ease · 1:05.1 – 1:12.9 (7.8s)

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

   **THE PLAYER IS BUILT — `video/src/app/player.tsx` — AND ITS TRANSPORT IS REAL.** Previous,
   play-pause and next are **SVG glyph paths, not text characters.** The old `▶` and `❚❚` were
   characters, so their metrics came from whatever face resolved them, which is why the play
   glyph sat visibly low in its circle — a defect with no fix inside a font. One **filled
   primary** and two quiet secondaries, because three identical circles say "three equal
   things" and there is one thing here he is about to do. A scrubber with **elapsed and total**
   time in tabular figures and a drag handle, and the track length is the real **4:54**. Title
   and artist are as before (L2b). The play button has a hover, and the pointer presses it.

   **THE PLAYER'S THREE WINDOW CONTROLS STAY GREY, AND THIS IS CLOSED.** Recorded so nobody
   re-opens it as an unfinished detail. macOS renders traffic lights **grey when a window is not
   focused**, and the player is a background window the whole time it is on screen — he opens it,
   presses play, and goes back to working in the browser — so grey is the faithful state rather
   than a missing one. Colouring them would also introduce **red, amber and green**, which are the
   three stress-band colours in this product, into a window sitting ~200px from a bloom that
   genuinely is asserting a reading. Red is banned outright in this film. Two independent reasons,
   same answer: do not colour them.

   **The sleeve is ORIGINAL abstract artwork — `video/src/app/albumart.tsx`.** The rule and its
   reasoning are in "The assets pass" below; what matters here is the design constraint it was
   built to. At beat 11's framing it is about **62px square on a phone**, so it is four elements
   and nothing else: a vertical field, one offset disc, a soft halo, three horizon bands. And it
   wears the furniture's **cool quadrant** — no meadow, no amber, nothing foggy — because a
   cover in a band colour, sitting ~200px from a bloom that genuinely is asserting a reading,
   would look like it was asserting one too.
2. **Puts headphones on** — and goes straight back to the keyboard.
3. **Music notes drift around him** in the viewfinder. He starts moving with it — small, a head nod on the beat, a shoulder. Not a dance number.

**HE EASES *OVER* THE WORK, NOT INSTEAD OF IT.** The beat used to end with him relaxed and the
deadline untouched, and there is a reading available — particularly for the managers this post is
aimed at — where the stress app told an employee to listen to music instead of doing the urgent
report. The clock says 11:30 and the deadline is 12. So **he never leaves the keyboard**: he is
typing again from the moment the player closes, all the way through the nod, the drift and the
recovery. The nod and the notes stay — they are the point of the beat. What changed is that he
does not stop.

**No audio plays.** This is animation only. ~~the VO track is Arabic narration and the cut must work silent regardless.~~ **There is no VO track at all now** — see the top of this file — so "must work silent" stops being a hedge and becomes the only condition.

Then, **after the head nod, THE CAMERA PULLS OUT AND HOLDS.** That pull-out is the beat's payoff
and it was missing: the move used to begin two-thirds of the way in and arrive on the very last
frame, so it never landed and never held, and everything that resolves resolved off screen. It now
lands with 54 frames still to run.

**~~THE THREE THINGS CANNOT SHARE ONE STATIC FRAME~~ — THEY CAN, AND L15 IS HOW.** For three
revisions the answer was that they cannot: bloom top to trend bottom was **985.9px against a
519px viewport**, so the trend was a separate landing reached by scrolling the page 580px while
the camera pulled out, and the film's last idea arrived in a picture that had only just stopped
moving. Every one of those numbers was correct. What was wrong was treating the app's layout as
fixed when the geometry-adaptation permission exists for exactly this.

**The orb comes down to 176, the Pause / End controls go, and the trend joins the pinned column
under his face** — so the whole act fits inside the page's own viewport and `COMPOSITE` holds the
orb, the stateline, the trend AND the viewfinder together. The page never scrolls, and everything
the beat exists to show happens inside a camera that stopped at f98:

| | frames | width | what it holds |
|---|---|---|---|
| **player, established** | f18–f24 | 916 | the music player over the whole composition — he opens it and you watch him do it. Held across the click |
| **player, landed** | f42–f60 | **640** | the window and very little else. It is the moment his suggestion pays off, so the camera goes to it — the punch begins ON the click at f24 |
| **the composite** | f98–f234 | **884** | headphones, the notes, the nod, the bloom's drift back to meadow, the stateline's return **and the trend's tail walking back down** — 136 frames on a camera that does not move again |

**The punch-in costs the beat nothing.** It is paid for out of the establishing shot's own hold —
48 frames in which nothing changed after the click — and out of the window's close (f56–f70) now
overlapping the camera's departure at f60 rather than finishing before it. The closing composite
still holds for **136 frames**.

**The closing image is one settled picture.** Him in the viewfinder with headphones on, the orb at
meadow, the stateline reading "You're at ease right now", and the trend walked back down — all in
one frame, held, with no scroll to reveal the descent. The tail reaches at ease **on f128, the same
frame the copy does** (it used to start at f150 and finish at f189, so the graph caught up 1.4s
after the orb and the copy had already resolved — L18), and settles by f170; the last 64 frames are
the linger. **The recovery skips `a little tense` because the stateline does**: the reading crosses
both thresholds inside one frame, so the graph is never in a band the copy is not showing.

**The player landing cannot exclude the trend, and that is geometry rather than a choice.** The
trend's top edge is at 474 and the window's bottom at 500, so no frame that holds the 600-wide
window whole can end above it. What is controlled is how much shows: the frame's bottom edge is
placed at the window's own bottom plus the same 20px the sides get, which leaves 20px of page
under it instead of the 40 that centring would give.

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

**AND IT LINGERS ON THE FINAL READING.** The last thing on the page that travels is the trend's
tail, settling at f189, which leaves **45 frames — a second and a half** — where nothing is moving
but his breath and the nod. Beat 12 is the film's thesis and it lands better arriving out of a
settled frame than out of a settling one.

**Cost: 6s → 7.8s.** The music player gives back ~0.4s — the track name reads in well under two
seconds at that framing — the payoff takes 1.4s and the linger 0.8s.

---

### 12 · The closing subtitle card · 1:12.9 – 1:15.9 (3s)

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

### 13 · End card · 1:15.9 – 1:21.6 (5.7s)

**A sequence, not a static frame.** Three timed events:

1. a **reveal animation** for the Serenify wordmark — unchanged
2. then **"take care of yourself"** *appears*. It no longer types
3. then **`serenify.tech` derives from the wordmark**: the wordmark duplicates on screen, the
   copy shrinks and travels down to the domain line, and only **`.tech`** types in after it

Then hold. ~~This is where the VO lands its last line, so the hold is room in the cut rather than
dead air.~~ **With the VO dropped the hold has to earn itself visually**, and it does — the
Premiere cut stretches these last 17 authored frames over 58 (0.60s → 1.93s), which is the film
resting on the domain rather than waiting for a line that is no longer coming.

**This makes the typewriter *mean* something.** All three elements used to type, which made
typing the card's house style rather than a gesture. Now the only thing that types in the whole
card is a **domain** — and beat 1 opens the film by typing a domain into an omnibox. The film
is bookended by the same action: the things a person types.

That is also why "take care of yourself" stopped typing. It is the sentimental line and it
should not be competing with a mechanical effect, so it fades up with a short rise. A wipe was
the alternative and was rejected for being the same *kind* of effect — the point is to isolate
the typewriter, and a wipe would have left three mechanical reveals inside eight seconds.

**AND THE LINE IS NUNITO NOW — that line only.** Picked off `endcard-compare.png` (recon,
2026-07-31) against Fraunces and Instrument Serif: the **curvier** answer rather than the
warmer-serif one, and the one that stays closest to Outfit's own geometry, so the card reads as
one voice with a softer second register rather than as two typefaces arguing. **It replaces Inter
here rather than joining it**, so the end card is two faces — Outfit for the mark and the domain,
Nunito for the line — and the one place in the film where the product stops talking and a person
does is the one place with a rounded face on it. Size (26), weight (400), colour (`CARD.muted`),
leading (1.4) and roman style are all untouched; Nunito's strokes are a shade lighter than
Inter's at the same size and that is left alone deliberately, because the softer weight **is** the
register the swap was made for. **The wordmark and the `.tech` treatment are byte-identical to
what they were.** Beat 12's closing card keeps Inter; nothing else in the film uses Nunito.

**AND THE REVEAL'S REAL DEFECT WAS THE CLIP, NOT THE DURATION.** `inset(0 X% 0 0)` is a
percentage of the element it is set on, and it was set on the **full-width centring row** — so the
first ~37% of every wipe uncovered empty page to the left of the mark and the last ~37% uncovered
empty page to its right. **Only the middle quarter of the wipe was ever on the glyphs**, which at
the 36-frame version was about **three frames of actual reveal**. That is why it read as "far too
fast" twice; and why doubling the wipe to 72 doubled the dead lead-in rather than the reveal, so
the card then sat on black for most of a second before the mark appeared. The clip is on the
mark's own `inline-block` box now, so the whole duration is spent on the wordmark: 2% of it
uncovered at f1, 21% at f8, 57% at f24, 92% at f48, arriving at f72.

**The easing changes with it: `out(quad)`, not `inOut(cubic)`.** Beat 12's line finishes leaving at
its f86 and this beat opens on the same `CARD.field`, so the only thing that ends the black is the
mark starting to uncover — and an ease-*in* spends its first frames at a standstill (0.4% after six
frames). `out(quad)` leaves at full speed and decelerates the whole way, so the mark starts
uncovering on the first frame after the cut and is still visibly completing three quarters of the
way through.

**AND THE WIPE IS 72 FRAMES (2.40s), from 36.** It is the same left-to-right `inset()`; the 1.04
settle stretches with it (26 frames rather than 14) so the arrival is not a flinch at the end of a
long wipe. The other three events shift by the same **+42**, so every gap between them is
unchanged — the line still lands two frames after the mark has settled, the duplicate still
detaches ten frames after the line has arrived, `.tech` still types at ~12 c/s. The card's last
event ends at f154 of **172**, leaving the same 18 frames of held card.

**This is the only beat that grows, and it is the last one**, so nothing downstream is pushed and
no hold anywhere else is spent: **136 → 172 (+36)**.

**AND THE PREMIERE CUT TAKES THE WIPE BACK BELOW THE VERSION THAT WAS REJECTED.** Everything above
is the authored beat and is unchanged; the film reads it at **2.60×** across the reveal and
**1.70×** through the domain, so the 72-frame wipe lands in **27.7 frames (0.92s)** — faster than
the 36 (1.20s) that was reported as *"still far too fast"* and doubled in the first place. `.tech`
types in 7.1 frames rather than 12. The one part that grows is the **held card at the end**: its
last 17 authored frames, in which nothing animates at all, are held over **58** — 0.60s → 1.93s,
which is the "final `serenify.tech` moment slowed down and held longer". Left as cut; see "Running
total" for why it is recorded rather than corrected.

**The duplicate travels BEHIND the line, dipped to under half opacity in transit.** Its path
from the wordmark to the domain row is almost vertical and the line sits across the middle of
it; drawn in front and fully opaque it blanked half of "take care of yourself" for most of the
move.

**`.tech` WAS GEIST MONO, WHICH BROKE THE ONE CLAIM THE MOVE EXISTS TO MAKE.** The whole point is
that the domain **derives from the wordmark** — and a domain that switches typeface halfway
through has not derived from anything, it has had a suffix stuck on it. It is **Outfit** now, at
`inherit` size: the old two-point drop existed to compensate for Geist Mono's larger apparent
size beside Outfit, and with both in Outfit there is nothing left to compensate for. So
`serenify.tech` reads as one word, set once. Colour stays `CARD.domain`. **The `DERIVE = false`
fallback path took the brand face too**, so a revert cannot quietly reintroduce the mono.

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
**unchanged** at ~1.13s, including the second added in revision 4 — ~~that is where the VO lands
and~~ **the VO is dropped, and the hold is kept anyway**: it is not what feels slow, and the film
now ends on a held domain rather than on a line being spoken over one.

---

## Running total: ~83.4s

**2501 frames.** The Premiere cut's 2238 (74.6s), **+23** for beat 10's turn 1 getting its read
back, **+240** for the four interstitial cards. Two additions on top of an approved cut, both
requested and both stated where they land:

| | frames | seconds |
|---|---|---|
| the Premiere cut, as approved | 2238 | 74.6 |
| beat 10 · turn 1 restored to 1.70s | +23 | +0.8 |
| the four interstitial cards, 60 each | +240 | +8.0 |
| **the film** | **2501** | **83.4** |

**The cards are the whole of the growth, and they are narration rather than pacing.** With the VO
gone they are not an addition to the film's runtime so much as a relocation of its soundtrack onto
the screen; 8s of type is what carrying the narration visually costs. Trimming toward the 40–60s
target, if it is ever taken up again, has to come out of the beats and not out of these — a card
under its floor is runtime spent on something nobody finishes reading.

Still over the 40–60s target. **Do not trim on paper — trim in greybox**, where you can actually
feel what's slow — which is exactly how the −124 pass below was found, and the pass above it went
one better: it was trimmed in **Premiere**, on the render.

**−210 frames, and the cut is MOHAMED'S rather than a proposal to him** — 2448 → **2238** frames,
81.6s → 74.6s. The remaining notes on `out/greybox-2026-08-02.mp4` were all pacing, so rather than
another round trip he took the render into Premiere Pro and re-cut it himself. **That cut is the
approved timing.** What is reproduced here is `serenify launch video.prproj`, segment for segment.

**The project file is the spec, not the description of it.** Three things were described — mostly
speed changes, a few frames removed before the closing card, the final `serenify.tech` moment
slowed and held. All three are in the file. Three things are in it that the description did not
carry, and the third is the one that matters:

- **Seven speed-ups, not a few**, and two are large: 2.00× inside beat 5 and 2.60× across the end
  card. The others are 1.30× (twice), 1.40× (twice) and 1.70×.
- **The frames removed before the closing card are 31** — a full second, not a few frames. They are
  the *tail* of beat 11, so the one-take invariant holds: this is a beat shortened, not an edit
  placed inside one. It is the film's only cut and everything else in the pass is a duration.
- **The end card's wordmark reveal is compressed to 27.7 frames, 0.92s.** It was **72 (2.40s)**,
  and it is 72 because 36 frames was reported as *"still far too fast"* and needed "considerably
  more than a touch" — so his own cut now runs the reveal **faster than the version he rejected**.
  Left exactly as he cut it, because he has watched this cut and approved it; recorded here because
  it is the one change in the pass that reverses a stated decision rather than extending one.

| Beat | Frames | What happens to it |
|---|---|---|
| 1 · cold open | 180 → **168** | 1.30× across the omnibox lift. −0.4s |
| 2 · signup | 432 → **432** | 1.00×. Untouched at every frame. |
| 3 · dashboard | 120 → **120** | 1.00×. Untouched. |
| 4 · camera gate | 120 → **120** | 1.00×. Untouched. |
| 5 · calibration | 422 → **376** | 2.00× through the countdown, then 1.30×, then 1.40× on the tail. −1.5s |
| 6 · "Later" | 36 → **33** | beat 5's 1.40× tail runs three frames into it. −0.1s |
| 7 · at ease | 72 → **72** | 1.00×. Untouched. |
| 8 · the email | 184 → **184** | 1.00×. Untouched — the whole email beat, at its authored rate. |
| 9 · questionnaire | 76 → **76** | 1.00×. Untouched. |
| 10 · Ren | 310 → **236** | 1.40× across the typing, the send, the thinking and turn 3. −2.5s |
| 11 · return to ease | 234 → **203** | 1.00×, and **its last 31 frames deleted**. −1.0s |
| 12 · closing card | 90 → **89** | 1.00× for the line; only its last 3 frames catch the end card's 2.60×. |
| 13 · end card | 172 → **129** | 2.60× across the reveal, 1.70× through the domain, then its last 17 frames held over 58. −1.4s |

**The whole of the first act after the cold open is at 1.00×, and so are the email and the
questionnaire** — beats 2, 3, 4, 7, 8 and 9 do not lose a frame. The reductions are the
calibration, Ren and the end card.

**The two reads that went under their protected holds are beat 10's, and both are left as cut.**
Beat 8's toast and stateline changes, beat 9's prompt before the click and beat 12's line are all
inside 1.00× segments and keep every frame they had.

| Read | Protected | Cut | Rate |
|---|---|---|---|
| beat 10 · turn 1, at 14.37px | 36f (1.20s) | **28.3f (0.94s)**, −21% | 42 chars at 35.0 → **44.5 c/s** |
| beat 10 · turn 3, at 9.52px | 60f (2.00s) | **44.0f (1.47s)**, −27% | 114 chars at 57.0 → **77.7 c/s** |

**And beat 10's typing is now 35.6 characters a second.** It was 25.4 — already declared *"faster
than a person types"* and protected by *never sped to fit, shorten the line instead*. The 1.40×
does to the rate what the rule forbids doing to it directly. The copy is Mohamed's, verbatim and
fixed, so the only levers are the rate and the beat's length; this pass took the rate.

**The final `serenify.tech` moment is a HOLD being extended, not a move being slowed.** Every
authored event in beat 13 has finished by its local f144; the 0.29× segment covers f155–f172, which
is a static card. 17 authored frames over 58 output ones — 0.60s → 1.93s of the same picture.

**And the trend's sync is safe by construction here rather than by care.** Its band keys live in
beats 8 and 11, and both are **entirely at 1.00×** — there is no retimed frame anywhere near a
crossing. It is verified on the render regardless, because it has broken twice.

── **how the cut is reproduced, and why it comes out cleaner than the export** ──

`video/src/retime.tsx` holds the fourteen segments and maps every output frame onto a **fractional**
authored frame; `GreyboxVideo.tsx` dispatches the beat and splits that frame in two, the integer
part riding a `<Sequence>` offset and the remainder riding `SubFrameContext`. **Every beat's own
timeline is untouched** — each is still registered at its authored duration and still scrubs at its
authored rate on its own in Studio.

**A time map rather than thirteen re-keyed beats, and the reason is the trend.** Six beats change
speed *inside themselves* — beat 5 at five different rates, beat 13 at three. Re-authoring those
would mean splitting each beat's timeline at arbitrary frames and rescaling every key by hand, with
L18's band keys having to move in step with the stateline at every one of them. The map cannot get
that wrong: the stateline and the graph read the same remapped frame, so they move together with no
second place for a key to be forgotten.

**The fractional frame is the quality argument.** Premiere resamples an already-rendered clip;
Remotion re-renders, so an eased move compressed to 1.40× can be drawn at the positions *between*
authored frames rather than at the nearest one. Rounding would have reproduced Premiere's sampling
exactly and bought nothing. A file that keeps importing Remotion's own `useCurrentFrame` degrades
to that sampling rather than breaking, which is why the seam is safe.

**−124 frames across the pass before it, all of them in the second half, and none of them a read** —
2572 → **2448** frames, 85.7s → 81.6s.

**The note was that the film slows from the "Start check-in" click onward and stays slow, and the
measurement is the argument.** Two numbers, taken per camera landing across every beat: the
*settled frames* it holds for, and the **dead dwell** left in it after its last authored event —
the camera stopped, nothing on screen changing.

| | settled, mean | settled, median | dead, mean | dead, median |
|---|---|---|---|---|
| 1st half (f0 – f1296) | 30.0 | 22 | 6.2 | 6 |
| 2nd half, before | 60.9 | 49 | 22.4 | 17 |
| 2nd half, after | 54.6 | 37 | 17.0 | 9 |

The second half's landings were not merely longer, they were **emptier**: the first half spends
21% of its settled time with nothing happening, the second spent **37%**. The AFTER column is
still above the first half's, and it is entirely the four holds that are not allowed to move —
beat 10's two reads (36 and 60), beat 11's protected closing composite (64) and beat 7's establish
(36). **Excluding those four, the second half's dead dwell is mean 6.3 / median 5 against the
first half's 6.2 / 6.**

| Beat | Frames | Why |
|---|---|---|
| 6 · "Later" | 60 → **36** | 38 dead frames of a locked-off dashboard after the click. The page does not respond to the press and the camera does not move; nothing was happening in any of them. It holds 14 after the click now, which is beat 4's own post-click band. −0.8s |
| 7 · at ease | 120 → **72** | a **60-frame move on a 10% push**, then a 60-frame hold on a beat whose one device — L12's raise — L15 removed. Twice the film's median camera move and ten times its median dead dwell, back to back. Halved on both sides; the stateline is legible across the push, so nothing that has to be read is spent. −1.6s |
| 8 · the email | 200 → **184** | the fall finishes at f86 and `dismayed` is a constant pose after it, but the camera sat on it until f118. It leaves at **f102**, and the third act shifts −16 with its spacing intact — so the trend's band crossings still land on the frames the copy steps on. −0.5s |
| 9 · questionnaire | 90 → **76** | the prompt has no response state, so the 24 frames after the click were a stopped camera on a stopped surface. The prompt keeps its whole 60 frames **before** the click. −0.5s |
| 10 · Ren | 332 → **310** | two typing indicators, **52 and 44 frames**, cut to 38 and 36. An indicator is looked at, not read. Both protected reads and the 92 frames of typing are untouched. −0.7s |

**Nothing that has to be READ lost a frame**, and it is checkable line by line: beat 8's toast
keeps its 38-frame hold at the clock framing and its second stateline change keeps its 20 to the
end of the beat; beat 9's prompt keeps its 60 before the click; beat 10's turn 1 keeps 36 at
14.37px and turn 3 keeps its protected 60; beat 12's line keeps its 50.

**And the invariants are intact.** Beat 11's closing composite still holds **136 frames**, f98 to
the end; beat 13's wordmark reveal is still **72** on `out(quad)`; the trend's band keys moved with
beat 8's copy changes by the same −16, so the sync survives; and **no beat gained a cut** — every
one of these is a hold or a move shortened, never a new edit inside a beat. **The first half is
untouched**: beat 1's hero framing is the only change before the click, and it is a framing rather
than a timing.

The pass before this one, for reference — **+36 frames**, 2536 → 2572, 84.5s → 85.7s:

| Beat | Frames | Why |
|---|---|---|
| 13 · end card | 136 → **172** | the reveal was *"still far too fast"* at 36 frames and needed "considerably more than a touch". The wipe is **72 (2.40s)** and the four events after it shift by the same +42, so every gap between them is unchanged and the held card keeps its 18 frames. It is the **last** beat, so nothing is pushed by it. +1.2s |

**Beat 11 gained a landing and did not gain a frame.** The punch-in onto the music player is paid
for out of its own establishing hold and out of the player window's close overlapping the camera's
departure; the closing composite still holds for **136 frames**, f98 to the end.

The pass before this one, for reference — **+102 frames**, 2434 → 2536, 81.1s → 84.5s:

| Beat | Frames | Why |
|---|---|---|
| 5 · calibration | 402 → **422** | the punch-in onto the uploading line was landing 26 frames into a 28-frame travel, so the camera arrived before the thing it moved for happened. It starts 20 frames later; the uploading line keeps its full 26-frame settled hold, so **the film grows rather than 5d shrinking**. +0.7s |
| 10 · Ren | 250 → **332** | two causes, both decided rather than discovered. His message is **78 characters instead of 49**, which is 92 frames of typing at the beat's own 25 c/s rather than 58 — the rate is not raised, because *never sped to fit*. And **turn 1 is now READ** inside a 440.5 landing rather than revealed by the move off his face, which is 36 frames it never had. +2.7s |

**Nothing was cut to pay for either, and no protected hold moved.** Beat 10's 60-frame hold on
turn 3 is untouched; 5d keeps every frame it had.

**Everything else in this pass is ±0.** The trend moving into the reading card, the orb coming
down to 96, the footnote's deletion, the viewfinder's top edge meeting the orb's, the toast's
move, the prompt's ring, beat 1's z-index, beat 6's suggestions gap and the end card's face all
changed **what is on screen** without changing how long anything is on screen for.

**−26 frames across the composition pass, and all four moves are deliberate rather than
incidental.** This is the first pass since the greybox that changed a duration at all:

| Beat | Frames | Why |
|---|---|---|
| 2 · signup | 468 → **432** | 2e's **holds**, not its performed actions. Opening a tab, typing a URL, waiting for a page and clicking a message open all still happen in full; eleven holds around them were outlasting their own read. −1.2s |
| 4 · camera gate | 180 → **120** | the privacy-line landing is gone — it made the film's privacy claim two beats before 5a makes it again, which turned the second into a repeat. −2.0s |
| 5 · calibration | 372 → **402** | the compressed minute was sitting on the 15-frame floor, so the breathing pacer's three phases had nothing to read. They get 25 frames each. +1.0s |
| 10 · Ren | 210 → **250** | he had four real avatar states and used none of them, and the previous pass punched in on him for six frames. He gets a face landing. +1.3s |

**Everything in Part 1 is ±0.** The whole monitoring restructure — the smaller orb, the removed
controls, the trend joining the pinned column, the emphasis leaving the statelines, beat 11's
three landings becoming two — changed **what is on screen** without changing how long anything is
on screen for. It also **deleted a camera move** rather than choreographing one, which is how the
closing image became a single settled picture.

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

**±0.0s across the assets and interaction pass.** Every change in it is an asset, an interaction
or a pacing correction, and the one change that genuinely needed frames — the countdown, which
was holding a static "3" — was **paid for out of 5d rather than added to the beat**:

| What changed | Cost |
|---|---|
| The mail client, the player, the album art, the toast | nothing |
| Hover states on every wired control | nothing — they run inside the existing approach |
| The cursor at real size, and three re-aimed click targets | nothing |
| Beat 6 clicking the real CTA instead of a drawn one | nothing |
| The dashboard's real empty states | nothing — same cards, different branch |
| Both typeface corrections | nothing |
| Beat 5a's privacy-line emphasis | nothing — in place, no camera travel (L12) |
| Ren's typing indicator becoming a travelling wave | nothing — same 34 frames |
| 5c counting for real, 45 frames | **+0.5s, taken out of 5d** — beat 5 stays 372 frames |
| 5d's paced minute and its numerals | nothing |

**−0.9s across the composition pass, and every frame of it is in the table above.** Part 1 — the
monitoring restructure — is ±0 on its own; the four duration changes are pacing and performance:

| What changed | Cost |
|---|---|
| L15 — the orb at 176, the controls removed, the trend pinned under his face | nothing |
| L16 — the trend inside the reading card, the orb at 96, the footnote removed | nothing |
| The trend's plot measuring its own width correctly | nothing |
| Beat 1's lift z-index, beat 9's focus ring, beat 6's suggestions gap | nothing |
| The end card's Nunito line | nothing. Its reveal is what grew beat 13 to 172 — see the running total |
| The composite going 884.75 → 840 and holding four things | nothing |
| The stateline emphasis leaving the statelines | nothing |
| Beat 11's three landings becoming two, and the page not scrolling | nothing — it deleted a move |
| The prompt's two gutters agreeing at 32 | nothing |
| `<StillMotion/>` — the CSS half of reduced motion | nothing |
| Ren's four avatar states, at 56px, driven from the frame | nothing |
| Beat 10's send hover firing on arrival rather than 8 frames early | nothing |
| Beat 3 → 4 and 5d → 5e carried by moves rather than cuts | nothing — the moves replace holds |
| Beat 5a's landing at 590, and 5e's line centred | nothing |
| Beat 6's suggestions row pushed clear of the fold | nothing |
| Beat 2's holds, beat 4's second landing, 5d's minute, beat 10's face | **−0.9s net** |

**±0.0s across the framing pass, and that is the point of it.** Every beat kept its exact frame
count; what changed is where the camera is and what the page is arranged like. Not one duration
moved, in either direction:

| What changed | Cost |
|---|---|
| L14 — the monitoring rearrangement, and the pinned right column | nothing |
| Five wrong rects (three 64px-high blocks, the clock, `SUCCESS_FRAMED`'s x) | nothing |
| The `tense` sub measured at its real 430 width | nothing |
| Beat 4 going to three landings inside its existing move | nothing — the move was already there |
| Beat 5a's 580 landing and its 27px page lift | nothing — inside 5a's existing hold |
| Beat 5c pulling back to share the capture landing | nothing |
| Beat 9's prompt becoming a world rect the camera can reach | nothing |
| Beat 10's landings derived from measured rects again | nothing |
| Beat 8's toast dismissing at the wide phase | nothing |
| The six OTP boxes existing before the sweep | nothing |
| The countdown counting once, monotonically | nothing — the 45 frames were already spent |
| Three legible breathing phases | nothing — same 45 frames, different period |
| The confirmation email matching `confirmation.html` | nothing |
| The cursor's hotspot, the caret, the stilled pointer | nothing |

**Trim candidates, in order:**

1. Beat 2, 14.4s → 12s. The performed mail sequence is where the remaining fat is; the OTP
   choreography is not. **1.2s of it is now spent** — the holds around the performed actions.
2. ~~Beat 5, 12.4s → 10.5s.~~ **Off the list, and it moved the other way.** 5d's second was the
   only fat in it and the pacer needed it back; 5f's hold is reading time for 16 words.
3. ~~Beat 4, 5s → 4s.~~ **Spent.** 6s → 4s, and the second landing is what went.

Beat 11 has come **off** this list. The music-player sub-beat is still the only fat in it, but the
beat now ends on a deliberate linger and trimming there would take the linger with it.

**Protect at all costs:** beat 8 (6.7s, and specifically its tight hold), beat 10's turn 3 **and
its face landing**, the 5b first-sight-of-face hold, and beat 11's composite hold and its closing
linger. Those are the video.

---

## The renderer was dropping frames, and it is not a compression artifact

Four visual artifacts were reported off the shipped 10.22 Mbps cut — at **~0:02**, **~0:05**,
**~0:10** and **~0:20**. They survived a 4× bitrate increase, so they were never banding or
blocking. And an earlier per-frame scan hunting whole-frame delta, tile-local delta and localized
luminance dips found nothing at those sites, which looked like a contradiction. It is not:
**there is nothing corrupt to find.** Every one of those frames is a clean, correctly rendered
frame — of some *other* moment.

**What identifies them is not a metric inside one render, it is rendering the film twice.**
`Greybox` is a pure function of frame, so two renders of the same commit must be identical. Over
frames 0–620, three renders disagreed with each other's consensus at exactly eleven frames and
matched everywhere else to the encoder's noise floor (median 0.07 of 255):

| render | frames wrong |
|---|---|
| the shipped 10.22 Mbps cut | **f67, f71, f73, f165, f167, f316, f604** ← all four reported sites |
| a re-render, same flags | f55, f122 |
| a re-render, `--gl=swangle` | f389, f456 |

So it is a race, it lands on 0.3–1.1% of frames, it **moves between runs**, and it is **not the
rasteriser** — software ANGLE hit it just as often, only elsewhere. A frame-level scan cannot see
it because a stale frame has no corruption signature, and during a push-in its delta against its
neighbours is in family with the ambient delta of the move. The metric that finds it is the
temporal **second** difference, and the proof is the cross-render diff.

**Where the race is.** Remotion's `remotion_setFrame` is `delayRender → setFrame →
requestAnimationFrame(continueRender)` — *one* animation frame between committing the new frame
number and declaring the page ready — and the renderer then screenshots the compositor surface
(`fromSurface: true`). One rAF is enough for React to render and for layout to run; it is not
always enough for the compositor to have produced a new surface, and under eight concurrent tabs
it is sometimes well short. When it is short you get **the tab's previous output**: f604 is f596
to the pixel, exactly eight frames back, which is the concurrency. (Remotion's own source names
this — *"a 0.1% framedrop when rendering under memory pressure"* — and its `DISABLE_FROM_SURFACE`
escape hatch crashes the render on Windows.)

**The one site that is not a stale surface is the same race one stage earlier.** At f165 and f167
the hero's `<h1>` had rendered but its accent span was still at `clamp(2.125rem, 5.6vw, 3.5rem)`'s
**2.125rem minimum** instead of 3.5rem, so the headline wrapped to two lines instead of three, the
copy column lost a line, and `lg:items-center` re-centred the whole column 75px up the frame and
back. That is the reported *"the landing page's left side jumps down and back up"* — a positional
jump, exactly as described, and invisible to a luminance or whole-frame-delta scan.

**Three things fix it, and the third is what makes the deliverable provable:**

1. **`<Settle/>`** (`greybox/settle.tsx`) holds every frame for six extra animation frames using
   Remotion's own `delayRender`, mounted once for the whole cut. It takes the rate from ~2 wrong
   frames per 620 to ~1 per 2572.
2. **The hero's headline size is pinned** in the video bundle, so the layout cannot depend on a
   viewport-unit resolution landing before the capture. It changes nothing that is drawn — the
   render viewport is 1920, so `5.6vw` is 107.5px and the clamp has been pinned to its 3.5rem
   maximum on every correct frame already.
3. **The cut is rendered twice as a lossless PNG sequence and reconciled.** Any frame where two
   renders disagree is a race by definition; the loser is the temporal outlier against its own
   neighbours, and it is confirmed by matching an earlier frame pixel-for-pixel. The shipped file
   is encoded from the verified sequence.

**The race has a second form: a stale compositor LAYER rather than a stale frame.** The music
player's scrubber was reported as jumping backwards between 0:24 and 0:26 of the track while the
elapsed time beside it kept counting correctly. `progress` is a linear `interpolate` and cannot go
backwards, and rendering those frames in isolation gives a perfectly even +1.5px/frame — so it is
the renderer again. An element carrying `opacity` plus a transform is promoted to its own
compositor layer, and a layer can be a frame or two behind while the rest of the picture is
current; the fill and the handle were in that layer and the text was not. Two things follow:

- **Do not promote a layer you do not need promoted.** `player.tsx` emits its `opacity` and `scale`
  only while the window is animating; through the hold it is ordinary painted content.
- **The reconciliation metric must be LOCAL.** The player's window is 0.28% of the frame, so a
  20px displacement of it moves a whole-frame mean by ~0.05 — invisible to any useful threshold.
  The check that ships this film compares **per-tile** maxima (60px tiles at 960×540), and it
  caught frames the whole-frame version had passed.

**AND IT TAKES THREE RENDERS, NOT TWO, BECAUSE TWO CANNOT NAME THE LOSER.** A disagreement between
two renders says a race happened; it does not say which side lost. The previous pass could name it
because both of its disagreements were the whole-frame class — a frame that repeats an earlier one
pixel-for-pixel, which is self-identifying. **Most disagreements are not that class.** Across the
2448 frames of the current cut, three renders disagreed on **58**, and the outlier was render A on
22, B on 16 and C on 16, with **4 having no two-of-three majority at all**. Only two were
whole-frame repeats (f979 and f1460, both in C, at 218 and 166 against a threshold of 3.0); one was
a partial-layer lag on the music player's own opening animation (f1965, 57 — the promoted-layer
case, on the frames where the window is legitimately animating); the rest are sub-pixel edge
rasterisation, concentrated on 1px card borders while the camera is moving. Diffing two renders
would have flagged all of them and resolved almost none.

`out/seqV` is the verified sequence: render A with its 22 outlier frames replaced by the frame the
other two agree on. The shipped file is encoded from it, at the same settings the previous cut used
— libx264 CBR **10220 kbps**, `nal-hrd=cbr filler=1`, yuv420p, everything else the x264 defaults
(verified by diffing the x264 options string in both files' SEI: identical).

**The Premiere cut ran the same procedure and landed in the same regime**, which is the useful
result: retiming did not make the race worse. Across its 2238 frames three renders disagreed on
**68** — outlier A on 15, B on 22, C on 27, **4 with no two-of-three majority**, against 58 and
22/16/16/4 before. `out/seqP` is its verified sequence — render A with its **15** outliers replaced
— and `out/greybox-2026-08-04-premiere-cut.mp4` is encoded from it at the settings above.

**And the encode verifies against a CONTROL rather than against an absolute.** A per-tile figure
means nothing on its own — chroma subsampling alone puts colour edges tens of levels apart — so the
number to beat is the *previous* cut measured the same way. Luma, 60px tiles at 960×540, area
downscale on both sides:

| | frames | worst tile | over 3.0 |
|---|---|---|---|
| `greybox.mp4` vs `out/seq1` | 2572 | 48 | 315 |
| `greybox-2026-08-02.mp4` vs `out/seqV` | 2448 | 53 | 299 |
| `greybox-2026-08-02.mp4` vs `out/seqV` — re-measured 2026-08-04 | 2448 | **52** | 2384 |
| `greybox-2026-08-04-premiere-cut.mp4` vs `out/seqP` | 2238 | **46** | 2196 |

**READ THOSE LAST TWO ROWS TOGETHER AND IGNORE THE `over 3.0` COLUMN ACROSS ROWS.** The control was
re-measured alongside the new cut because the two must go through one script to be comparable, and
the point survives being demonstrated: **worst tile reproduces (53 → 52, the same number), and the
count does not (299 → 2384).** The extremes are robust to how the two sides are brought into a
common colour space; the bulk of the distribution sits close enough to the threshold that a
different RGB↔YUV round trip moves almost every frame across it. So the row to trust is the worst
tile, the new cut's **46 against the control's 52**, and a count is only ever comparable to a count
produced by the same run of the same script. This is the same lesson the metric already carries —
verify against a control, not an absolute — applied one level down, to the tool.

**AND THE CARDS PASS RAN IT WITH A ZERO-THRESHOLD METRIC, WHICH IS WHY ITS COUNTS LOOK WORSE.**
`Greybox` is a pure function of frame, so two correct renders must produce **byte-identical PNGs** —
which means md5 alone finds every disagreement and resolves the two-of-three majority, with no
pixel decode and no threshold to choose. Across the 2501 frames of `greybox-2026-08-04-cards.mp4`,
three renders disagreed on **209**: outlier A on 72, B on 64, C on 56, with **17 having no
two-of-three majority** (left as A). `out/seqX` is the verified sequence — render A with its 72
outliers replaced — and the shipped file is encoded from it, at the settings above, **verified by
diffing the x264 options string in its SEI against the premiere cut's: identical.**

**Those 209 are not comparable to the previous passes' 58 and 68, and the reason is the
threshold, not the film.** The earlier figures came from a per-tile pixel metric that ignores
sub-threshold differences; this one counts every non-identical byte. Spot-measured on ten of the
209, the picture is the same regime as before: **B and C agree at max |Δ| = 0 while A differs**,
and A's deltas are mostly 4–15 levels over a handful of pixels — 1px card borders under a moving
camera. **One is a real race and is exactly what the procedure exists to catch: f1615, max |Δ| 130
over 25,925 pixels.** It was replaced.

The lesson is the one this section already carries, one level further in: **a count is only
comparable to a count produced by the same metric.** Byte-identity is the stricter and the
cheaper test, it needs no control to interpret, and it is the one to use from here — but its
number must never be read against a thresholded one.

**Do not judge a frame-level artifact off a single render**; diff three, diff them locally, and
compare the encode against the last one that shipped.

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
- ~~The protagonist is Youssef Kamal, and the film was calling him Mohamed Asem.~~ **CLOSED, and
  verified.** `PROTAGONIST.fullName` is "Youssef Kamal", `deriveInitials` reads straight off it,
  and every `<Header/>` in the film mounts from that one constant — so the avatar reads **YK**
  and there is no initials string to keep in sync. The only "Mohamed Asem" left anywhere in the
  video project is in `SwapProbe.tsx`, which is a measurement bench and is never in the cut.
- ~~Do the headphones still read now that the face is the brightest thing in frame?~~ **Yes**, and
  the re-tint is what protects it. They were brought down to muted grey to stop competing with
  the face; with the backdrop now 17 points below the skin, the cups sit between the two rather
  than against the top of the range. The contrast relationship inverted, and the fix was the
  backdrop rather than the headphones — moving them back up would have undone the previous pass.

- ~~Can the orb, the stateline, the trend and the viewfinder hold in one frame?~~ **Yes, and the
  cost was the Pause/End controls plus a third of the orb.** See L15 and beat 11. The composite is
  884.4 world px at L17, the stage card is whole inside it, and the page does not scroll
  at any point in the monitoring act.
- ~~Does dropping the stateline emphasis cost the "a little tense" → "tense" escalation its
  readability?~~ **It should not, and it is being watched rather than assumed.** The head reads at
  17.18px, and the escalation is carried by three separate movements in a
  static frame — the drift, then the first copy change, then the second. **If it ever reads as
  easy to miss, the emphasis comes back for that one transition only.**
- ~~Why does the green-room checkmark flash?~~ **Because `prefers-reduced-motion` was only ever
  answered for JavaScript.** The `<Check/>` glyph was never the problem; the meadow glow it sits
  in carries a live 500ms CSS transition guarded only by `motion-reduce:`, which the render never
  sets. See `<StillMotion/>` at the top of this file — the same root cause was also drifting the
  **bloom** on every frame of beats 8 and 11, and running Ren's blink on a 7s wall clock.
- ~~Does Ren perform?~~ **He does now.** Four real avatar states, driven from the frame, at 56px,
  with a face landing he is held on while he composes. See beat 10.

**Still open:**

- **Does the closing card land or stall the ending?** **It lands — and the reason is beat 11, not
  beat 12.** The card was always going to read as a speed bump arriving out of a *settling* frame,
  and that is what it used to do: beat 11's pull-out finished on its last frame, so the demo was
  still resolving when the text appeared. Beat 11 now lands its trend shot with **54 frames still
  to run**, so the card arrives out of stillness and reads as the last idea rather than as a pause.
  Judged on the rendered cut, not on the description. **If it is ever reopened, reopen beat 11's
  hold first** — that is the variable the card's reading depends on.
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
- ~~**Does 5a's privacy line read, now that it has the emphasis?**~~ **YES — 10.19px seated,
  12.74px raised**, at a 580-wide landing held f32–76, plus a 27px page lift that also un-slices
  the helper line under it. It was 5.8/7.2. See beat 5.
- Do the real full-page reloads (`<a href>` / `window.location.replace`) read as broken on video, or as honest? They're real; showing them is more faithful, but a hard white flash mid-video may just look like a mistake.
- Beat 10's three-turn exchange is written for the video; `014-recommendations` doesn't exist. Keep the UI plausible against what 014 will actually ship.
- Beat 10 turn 3 must read as *personal knowledge*, not a canned tip. If greybox shows it reading generic, that's a copy problem to fix before art.
- **Does the mail app icon established in 2e survive the ~25 seconds to beat 8 as a recognisable
  signature?** This is now a judgement rather than a blocker: both surfaces are built, and the
  toast's squircle icon is a clip-path over the **same shared `MailMark`** the client uses rather
  than a second drawing of it, so the two cannot drift apart. What is left to judge is
  recognition across the gap, which only the render can answer.

---

## The remaining hard seams — REPORTED, not built

The film's camera is continuous **inside** a beat by invariant, so most beat boundaries are moves
rather than cuts: beats 2→3 and 3→4 join on explicit named seam shots (`BEAT2_SEAM`, `BEAT4_SEAM`,
the second velocity-matched with `EASE_DEPART` → `EASE_ARRIVE`), 8→9 picks up beat 8's closing
framing and holds it four more frames before easing on, and 12→13 shares one solid `CARD.field`
ground so only the wordmark's wipe ends the black.

With the four cards in, **four boundaries are still hard changes of composition** — the picture
changes with neither a camera move nor a card covering it. This is the report; **nothing here is
built in this pass**, and this list is the input to the next one.

| Boundary | Out of | Into | What changes |
|---|---|---|---|
| **1 → 2** | landing hero, `HERO_SHOT` ≈610 | signup column, `SIGNUP_ESTABLISH` 880 | Different page at a wider framing with no carry-through. The "Get started" click that motivates it happens inside beat 1, so the *cause* is on screen — but beat 2 opens on a new surface and a new width regardless. |
| **6 → 7** | dashboard, full 1200 | monitoring, ≈1017 | Different surface at a similar width, with no seam shot — the one boundary in the first act that was not given the treatment 2→3 and 3→4 were built for. |
| **10 → 11** | chat panel, `L3` ≈665 | monitoring, full 1200 | Different surface and the largest width jump in the film, ~1.8×. |
| **11 → 12** | live monitoring composite, 927 | the closing card, solid `CARD.field` at 760 | The most abrupt of the four: the "live app" register drops for the title-card register instantly, with no device of any kind. |

**And the third card is the one that does the opposite.** Beats 7 and 8 already join on the
*identical* shot on the *identical* surface — deliberately, "the beats join on the same shot" — so
"Until something changes." interrupts a continuity rather than covering a discontinuity. It is
placed for what it marks, not for what it hides. Recorded here so a later pass does not read the
four cards as four fixed seams.

---

## The deferred register

**What is deliberately unfinished, so that nothing depends on being remembered.** Each entry is a
requirement plus the reason it is not built yet. Recording these *is* the work; none of them is to
be started from this list.

**Deferred to the component pass** — when the greybox page is replaced by real `apps/web`
components:

1. ~~**The mail client's reading pane must be empty until the message is clicked.**~~ **DONE
   (assets pass).** The pane has **two genuinely different states** rather than one at two
   opacities: the empty-selection state every mail client ships — a large low-contrast envelope
   and "Select a message to read" — and, after the click, the message. Nothing of the email is in
   the DOM beforehand; the greybox's `opacity: 0.16` ghost is gone. **The "and beat 8" half of
   this entry was structurally inapplicable and is recorded as such**: beat 8 renders no mail
   client at all — it is the monitoring page plus `<MailToast/>`, no cutaway, which is that beat's
   own invariant — so there is no reading pane there to be empty. Met at beat 2; nothing to meet
   at beat 8.
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
   **DONE — but the fix was half right for a pass, and the wrong half is why 5f then sat left of
   frame.** The ripple scales a 96px badge to 2.1 — 52.8px past the badge on every side — and the
   badge sits 24px below the component's top edge, so it crosses that edge by **28.8px**. That is
   correct, and it is a **vertical** fact. The rect grew from the badge on **both** axes, though,
   which put its centre at 723.2 against the component's 600 — so beat 5f's `shot(600, …)` arrived
   123px to the left of the rect it was framing, and the move onto it read as a pan the wrong way.
   Horizontally the ripple reaches 499.2 → 700.8, comfortably *inside* the component's 376 → 824,
   so the component governs x and the badge has no business in that arithmetic. `SUCCESS_FRAMED`
   grows on its top edge only now. See beat 5.
5. ~~**The calibration viewfinder becomes 16:9.**~~ **DONE.** The box is 512 × 288 `aspect-video`;
   the 3:4 bracket guide floats inside it at 168.5 × 224.6. The take is reframed, and the
   centring nudge lands harder for a measurable reason — the bracket target is only 33% of the
   box's width. The stale liberty lived in beat 5's framing note and **that note is deleted**;
   there was no row in the liberties table to remove.
6. ~~**Re-check beat 8's face size after the swap.**~~ **CLOSED — re-checked and better.** The
   fall now plays at **77.8px** on a phone (88.7 before L14, 82.3 at L15) — the viewfinder's top
   edge moved down 25 at L16 to meet the orb's, so the toast-to-face union is 20px taller and 16:9
   charges 649.4 for it against 613.9. Still comfortably over the ~80px that was accepted at the
   *tight* framings this entry was opened about, and the clock landing — the beat's actual payload
   — is unchanged at 32.1px. L1 is unchanged
   at 320×181; only the direction it grows from moved (see L1).
7. ~~**Beat 11's page half — the trend descent is DONE, the music player stays a stand-in.**~~
   **CLOSED (assets pass).** The trend was already the real `<SessionTrend/>` — the tail walks
   back down in meadow while the climbed history stays put, which is the thing the beat exists to
   show. **The player is no longer a stand-in:** a real transport in SVG glyph paths rather than
   text characters, one filled primary against two quiet secondaries, a scrubber with elapsed and
   total time in tabular figures and a drag handle, the real 4:54, and original abstract album
   art beside it. See beat 11.

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
9. **Should Ren stop blinking while a reading is Tense?** Raised four sessions ago, never
   answered. **It is now answerable rather than theoretical:** the blink is frame-driven (see
   `<StillMotion/>` and beat 10), so suppressing it in a window is one condition rather than a
   fight with a CSS animation.
10. ~~**Do Ren's `attentive` and `thinking` states need properly drawn eyes?**~~ **HALF CLOSED
    (2026-07-31): `attentive` is dropped from the film entirely and is not to appear anywhere.**
    Judged on the render at conversational size, its 1.22× eye-scale and lift read as a **stare** —
    it is a good state at the 34px the product draws it at and a bad one at four times that, and
    the film is the only place the avatar is ever seen large. `idle` goes with it: beat 10's Ren is
    either composing or he has just answered.

    **What is still open is `thinking`**, which is now on screen for 250 of beat 10's 310 frames at
    up to 40.9px on a phone. It reads as a squint, which is what it is for. Whether it wants drawn
    eyes at that size is a design call in `apps/web`, not a bug in the film — and it is a question
    about the product's own avatar rather than about the video.

**Opened by the composition pass:**

14. **The trend's own type is under the phone floor at `TREND_SCALE`** — **and this entry was
    OVERSTATED, because the plot was rendering at 42% of its own card.** `<SessionTrend/>` measures
    its container with `getBoundingClientRect` (`session-trend.tsx:297`), which returns SCREEN
    pixels, and `measure-patch.ts` was dividing out the camera's zoom but **not the trend's own
    scale wrapper**. It measured `720 × 0.4167 = 300` and drew a 300-wide SVG inside a 720-wide
    box: the gutters collapsed to their MIN values (84 / 24) so `plotWidth` was **192 instead of
    520**, `capByLegibility = floor(192/24)+1 = 9` **silently dropped a window**, and the plot's
    right edge landed at SVG x 276 of 720 — 58% of the card empty to its right. Predicted gridline
    edge 594px into the crop; measured on the render, **595**. The series was never too short:
    fill-to-width was working correctly on a plot 2.7× too narrow.

    **Fixed (2026-07-31).** The wrapper declares `data-measure-scale` and the patch walks up from
    the element being measured and divides that factor out too — deterministic, no race, and no
    `apps/web` change. The walk runs at zoom 1 as well, so `SwapProbe` measures what the beats
    draw. The plot now measures **718** and lays its windows across the full card with the latest
    reading pinned to the right edge, which is what the product ships and what the brief expected.

    **What survives of the original entry:** the card's 18px heading and 12px axis labels are still
    under the ~10px floor at the scale L16 draws it, and that is still the trade. What the shot has
    to deliver is the **line** — a tail that climbed and walks back down, which is a shape — and
    the plot is now ~158 × 45px on a phone **and filled**. If the labels ever have to read, the
    lever is the reading column's width, and it should be re-derived rather than nudged.
15. **`<StillMotion/>` is a blanket, and blankets hide things.** It states `apps/web`'s own
    reduced-motion rules unconditionally, which is correct and is also why nothing will ever again
    *tell* us that a component has grown a new CSS transition — it will simply be neutralised. The
    honest alternative is to make Chromium report `prefers-reduced-motion: reduce` at the browser
    level, so the app's own `motion-reduce:` guards fire for the reason they were written. Remotion
    4.0.501 exposes no browser-argument passthrough for it; if a later version does, that is the
    better shape.
16. ~~**Beat 6's suggestions row is pushed below the fold by a 150px gap.**~~ **CHANGED, not
    closed — the gap is 80 and the two cards' HEADERS are readable (66.3px, measured on the
    render).** 150 put them off the page entirely, which read as a dashboard with nothing under
    the check-in card and is not what the product's page looks like. At 112 the top border, the
    corner radius and the first line of each label break the fold: enough to show they exist, not
    enough to frame or emphasise either. **The crop is the page's own fold rather than the camera's
    — a deliberate exception to "no content element cropped at rest", recorded in beat 6 so a later
    pass does not "fix" it.** The caveat that opened this entry is unchanged and is why it stays
    open: 112 is still a spacing value the product does not have, and if the dashboard's own layout
    changes it will silently stop being the right number. It is a smaller and better-evidenced
    number than 150 was.

**Opened by the framing pass:**

11. **Three surfaces are scrolled by a scoped stylesheet rather than by a prop, and that is
    brittle.** Beat 2e scrolls the mail client's reading pane 52px (the email card is 482.5 tall
    and does not fit), beat 5a lifts the calibration column 27px, and both do it with a `<style>`
    block targeting a structural selector — `[data-mailpane] > div > div:last-child` in the first
    case. It works and it is the same seam `auth.tsx` already uses, but **it breaks silently if
    `mail.tsx` reorders its children**, and a silent break here is a crop. `mail.tsx` wants a
    `paneScroll` prop and `calibrate.tsx` wants a `scroll` prop, the way `consent.tsx` already has
    one. Not done in this pass because both files were being edited for content at the same time.
12. **The `(auth)` shell's header does not scroll with the form.** The scroll wraps only
    `AuthPage`'s children, so at the 2b–2c scroll of 145 the "Create your account" heading passes
    **under** the wordmark. No shot in the film holds on it, so nothing is visibly wrong today —
    but any future wide framing during 2c would expose it, and it is the kind of defect that gets
    found by a reframing rather than by a test.
13. **Two rects in `geometry.ts` still describe surfaces smaller or larger than they render.**
    `SIGNUP.fieldPassword` / `fieldGroup` were measured against the **collapsed** one-line password
    checklist; expanded to three rows the block runs to y **704**, not 669. And `VERIFY.section`
    carries h 442.1 (bottom 702.1) against a surface that ends at **649.5**. Beat 2 currently
    carries local corrections for both. They belong in `geometry.ts`, and `framing.ts` should own
    `BEAT2_SEAM`, which lives in the beat file and is imported by beat 3.

---

---

## The assets pass — built

The mail client, the music player, the album art and the notification are drawn. They are the
film's only non-Serenify surfaces, and they were the last labelled grey rectangles left in it.

**THESE ASSETS NEEDED PERSONALITY, NOT WIREFRAMES**, and that was the brief they were built to. A
labelled grey rectangle beside a real product component reads as unfinished in a way it never did
when everything was grey. They feel like real software someone actually uses — in dark, inside the
film's palette, with the specificity that implies. They take their values from the furniture token
block, which is deliberately decoupled from the app's palette, because a browser and a mail client
are not part of Serenify and must not move when its tokens do.

── WHAT WAS BUILT ──

- **`mail.tsx`** — a three-pane client: six folders with unread counts, a message list with the
  Serenify mail unread at the top and five plausible neighbours under it, and a reading pane with
  **two states**, empty-selection and message. The email is a document card *inside* the pane,
  which is what an HTML email looks like in a client. Copy and type scale from
  `supabase/templates/confirmation.html`. Beat 2e; register item 1.
- **`player.tsx`** — a transport in SVG glyph paths rather than text characters, one filled
  primary against two quiet secondaries, a scrubber with elapsed and total time in tabular
  figures and a drag handle, the real 4:54. Beat 11; register item 7.
- **`albumart.tsx`** — original abstract artwork, four elements, in the furniture's cool
  quadrant. See the standing rule below.
- **`toast.tsx`** — a macOS Sonoma banner: squircle app icon over the shared `MailMark`, a
  two-stop vibrancy gradient, tabular figures on the subject. Beat 8.

── THE ALBUM-ART RULE, WHICH STANDS ──

**ALBUM ART MUST BE ORIGINAL, AND THIS DOES NOT EXPIRE.** Song titles and an artist's name on
screen are decided and stay (L2b) — the naming is the evidence Ren knew him, and with no audio and
no lyrics it carries effectively no risk. **An actual album cover does not.** Three reasons, each
independent of the others:

- **The film is promotional, not educational** — which is the fair-use factor that cuts hardest
  against it.
- **The sleeve is a separate copyrighted work from the recording**, so not playing the song does
  nothing for it. The two are unrelated licences.
- **The sleeve in question is a photograph of a person**, so likeness rights sit on top of the
  copyright.

Original art costs nothing, matches the palette, and cannot get a launch post flagged. **No
reproduction or near-reproduction of a real album sleeve** — not redrawn, not "inspired by", not
recoloured. That holds for any future track, not just this one.

The art that exists is built from **four elements only** — a vertical field, one offset disc, a
soft halo, three horizon bands — because at beat 11's framing it is about **62px square on a
phone** and anything more becomes noise. It wears the furniture's **cool quadrant**: no meadow, no
amber, nothing foggy, since a cover in a band colour sitting ~200px from a bloom that genuinely is
asserting a reading would look like it was asserting one too.

---

## Third-party brands — decided

**Mail client and music player are generic. Billie Jean and Michael Jackson are named on screen. No audio, no lyrics.** Mohamed's call, made 2026-07-29.

The reasoning: naming a track with no audio and no lyrics carries effectively no risk, and the naming is doing real narrative work — it's the proof Ren knew his taste. Drawn Gmail and Spotify interfaces, by contrast, add brand clutter and buy nothing the story needs.

The one cost is that generic UI can't disambiguate itself, which is why beat 2e now has to establish a mail icon that beat 8 can lean on. See the warning in beat 8.

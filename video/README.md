# `video/` — Remotion project for the Serenify launch video

React-as-video. The source of truth for what gets built is
[`docs/video/serenify-launch-video-beat-sheet.md`](../docs/video/serenify-launch-video-beat-sheet.md).
All thirteen beats of that sheet exist here as a **greybox** — grey rectangles at
real durations with real camera moves — plus the two checks that prove the
pipeline is worth having. Nothing is built to final quality yet.

## Why it is here and not in `apps/`

The root `package.json` declares `workspaces: ["apps/*", "packages/*"]`. Putting
this project under either glob would fold ~270 Remotion packages into the root
lockfile, so every `npm ci` — including the one CI runs before it lints
`apps/web` — would install a video toolchain to run unit tests. It would also
re-hoist `node_modules` for everyone working on `apps/web` or `apps/api`.

So `video/` sits at the repo root, **outside both globs**, with its own
`package-lock.json` and its own `node_modules`. The consequences, all
intentional:

- The root lockfile is untouched. `npm ci` at the root installs exactly what it
  installed before.
- CI never sees this directory. All three jobs in `.github/workflows/ci.yml` are
  scoped — `speckit-skills guard` reads `.claude/` and `.gitignore`, `web` runs
  everything through `-w apps/web`, `python` runs in `apps/api` and
  `packages/ml-video`. None of them glob the repo root. No CI change was needed
  and none was made.
- Root `tsconfig.json` includes only `scripts/**/*.ts` and root
  `vitest.config.mts` only `scripts/__tests__/**`, so neither picks this up.
- You must `npm install` here separately, once.

## Setup

```bash
cd video
npm install
```

## Dev studio

```bash
cd video
npm run studio
```

Opens Remotion Studio — live preview, timeline scrubbing, hot reload on save.

**If port 3000 is busy** (a `next dev` for `apps/web` usually is), pass another:
`npm run studio -- --port 3411`. Remotion serves the bundle over HTTP and fails
with a confusing "this is not a valid Remotion project" error if it lands on the
Next dev server instead of its own.

## Render

```bash
cd video
npm run render:greybox  # -> out/greybox.mp4  (the cut: 1920x1080, 80.2s, ~18 MB)
npm run render:rig      # -> out/rig-spike.mp4  (the character rig's bench, 6s)
npm run render:hello    # -> out/hello-world.mp4
npm run render:probe    # -> out/web-component-probe.mp4

# or, generally:
npx remotion render <CompositionId> out/<name>.mp4 --port 3411
```

Every composition is 1920x1080, h264, 30fps. `out/` is gitignored — renders are
regenerable and MP4s do not belong in git history.

The first render downloads a Chrome Headless Shell (Remotion rasterises frames in
a real browser); later renders reuse it.

## The greybox — `src/greybox/`

`Greybox` is the cut: all thirteen beats at the durations the beat sheet gives
them, 2406 frames = **80.2s** at 30fps.

**The world is 1200×675, not 1920×1080.** The product renders at a 1200px-wide
viewport and the whole desktop is scaled 1.6× to fill the output — a screen
recording of a 1200×675 screen, blown up, not a 1920 screen with 384px of dead
gutter each side. 1200 is the smallest viewport at which the app's `max-w-6xl`
(1152px) column is at full designed width, and `apps/web` has no `xl:`/`2xl:`
utilities at all, so nothing reflows between there and 1920. Details and the
arithmetic are in `src/greybox/theme.ts`.

It exists to answer **one** question — *does the pacing work* — because pacing is
the failure mode that kills a video like this and it is invisible on paper. So
it is deliberately ugly: grey rectangles stand in for every screen, panel and
person. What it does have is **real durations and real camera moves**, plus real
copy at real sizes, because those are the things being tested. Watch it at
phone size; that is the whole point.

Everything here gets thrown away. Do not refine it.

| What is real | What is a rectangle |
|---|---|
| Beat durations, to the frame | Every screen, panel, card and window |
| The toolbar clock, and the internal clock it sits on | The clock's chrome (no browser draws one there) |
| **The character's motion** — every expression, the fall, the nod, the blink, the typing | The character's *art* — he is arcs, dots and one quadratic |
| Every push-in, at its sheet framing | The mail client, the music player, the toast |
| Every performed action — tabs, clicks, scrolls | Ren's face (a circle with a `REN: <state>` label) |
| The 2f OTP choreography, at recon timings | The office backdrop (a flat rectangle) |
| The 1.3s eased band drift (the only colour) | The wordmark, all icons, all art |
| App copy, verbatim, at app sizes | Typeface, palette, tokens, polish |

Layout is authored at **real app pixel sizes** inside the world — a 448px signup
column really is 448px wide, `text-sm` really is 14px, the stateline really is
30px — and legibility comes from the camera pushing in, exactly as it will in the
finished video. Sizing text up to be readable in a wide shot would test the wrong
thing.

Every beat is also registered on its own under the **`Greybox-Beats`** folder in
Studio, so one beat can be scrubbed and re-timed without playing the minute in
front of it. Double-clicking a sequence in `Greybox` jumps to it.

`src/greybox/Camera.tsx` is the piece to read first. A `Shot` is three numbers —
which rectangle of the world fills the frame — and every beat's camera plan is a
short keyframe list of them. `frameRect(rect, margin)` in the same file is the
**framing rule as arithmetic**: a push-in lands on a *whole* element with all four
edges inside the frame and margin around it. Every landing goes through it rather
than through hand arithmetic, which is how the first pass ended up with copy
hanging off the frame edges. The one exception — full-bleed furniture may run off
left and right — is documented there too.

`PHONE_PX(size, framedWidth)` in `theme.ts` is the legibility check: ~10px is the
floor at which a line is read rather than recognised on a phone.

**No cuts inside a beat.** Each beat is one `<Camera>` and one continuous scene
driven by frame number — the camera moves, holds and moves again, and screen
changes are animated or performed rather than cut to. Beats 2 and 5 used to be six
and five sub-sequences with a camera each, which was eleven cuts inside two beats.

`src/greybox/lift.tsx` is the other piece worth reading, and it holds **two
devices** that revision 3 confused for one:

- **The travelling lift** (beats 1 and 3). Some elements cannot be made legible by
  any camera move — a 1152×86 banner in a 1200px viewport cannot be held whole *and*
  magnified at 16:9 — so this stages the element instead of the shot: it detaches,
  travels to a narrower measure at centre frame, is read at its real type size, and
  settles back. **Capped at two uses**; a third would make it a template.
- **The in-place emphasis** (beats 7, 8, 11). The stateline block grows 1.65× where it
  stands and the camera does not move, which is why it is free. It is a **rule, not a
  budget**: it fires on every stateline copy change, so the audience learns that when
  the block moves, the reading changed. One hard constraint — **no yo-yo**: beat 8's
  two copy changes land seconds apart and are covered by a single raise.

The emphasis is also why `surfaces.tsx` relaid out the reading card. Growing about the
block's centre sent its top edge into the bloom, and beat 7 exists to plant bloom,
stateline and viewfinder together — so it grows *downward* from its own top edge, and
the card is 40px taller with the trend 76px lower to make the room.

## The character rig — `src/greybox/rig.tsx`

**A spike, and it answers one question:** can a face made of primitives *fall* convincingly? Two
risks were travelling under one name — whether a rig can produce the motion the beats need, and
whether we can get good consistent art — and the second was making the first look frightening. The
first is settled with no art at all.

**An expression is a vector, not a picture.** Thirteen numbers (`Pose`), and each named expression
— `calm`, `content`, `dismayed`, `tense`, `easing` — is a point in that space. Every transition is
an interpolation between two points, which is the only way a fall or a nod exists: cross-fading two
finished drawings gives neither, and on a face it reads as a jump cut. `useExpression` keyframes
expressions exactly as `Camera` keyframes shots, so a transition is the default and a cut is hard to
write by accident:

```tsx
const pose = useExpression([
  { frame: 0,   state: "content"  },
  { frame: 70,  state: "content"  },   // holds
  { frame: 86,  state: "dismayed" },   // ← THE FALL, 16 frames of travel
  { frame: 148, state: "tense"    },
]);
```

Parts: head (nod, sink, tilt), brows (the fall, more than anything else), eyes (aperture + blink),
pupils (gaze), mouth (one curvature scalar), shoulders (slump + typing), hands, headphones. The hair
cap, ears and neck are **not** animated — they exist to mark where the generated drawing's seams
land, and to prove the rig has somewhere to attach them.

**Studio composition `CharacterRig`, under `Spikes`**, is the bench: the five poses static, plus
beat 8's fall at its real timings both large and at the viewfinder's real on-screen size. Use it
rather than the cut — a rig that fails only at small sizes is invisible in the cut, and a rig that
fails everywhere is a finding worth surfacing before art exists.

It also found a real defect in the cut. Beat 8's camera used to arrive tight and start pulling out
immediately, so the fall played at ~930px of framing where the head is ~45px on a phone. Invisible
while the face was a labelled grey box; obvious with a rig in it. The tight framing now holds
through the fall.

## The two pipeline checks

Neither is a beat. They exist to keep the pipeline honest.

| Composition | What it proves |
|---|---|
| `HelloWorld` | The toolchain produces a 1920x1080 MP4. Imports nothing from `apps/web`, so if it renders and the probe does not, the fault is in the app bridge rather than in Remotion. |
| `WebComponentProbe` | **The one that matters.** Imports the real `apps/web` `<Wordmark />` through the app's own `@/` alias and renders it with its real Tailwind v4 theme tokens. |

`<Wordmark />` is the probe because it fails loudly rather than subtly: two
tokenised colours (`text-ink` on `seren`, `text-meadow-text` on `ify`), a
tokenised font, and a `lowercase` rule. A broken CSS pipeline yields one flat
colour in the wrong typeface — obvious in a frame grab.

Verified 2026-07-29: it renders with `#EAEBEC` (`--color-bg`), the correct
two-tone split, and Outfit.

## Agent skills

Remotion's own agent skills ([remotion-dev/skills](https://github.com/remotion-dev/skills),
taken from the `4.0.501` tree) are installed at **project scope** — committed with
the repo, not depending on anyone's global install — in **both** locations this
repo already uses:

- `.claude/skills/<name>/SKILL.md` — Claude Code, auto-discovered
- `.agents/skills/<name>/SKILL.md` — Codex, per `AGENTS.md` § Skills

The two trees are byte-identical real directories, not symlinks. Symlinks do not
survive a Windows checkout without `core.symlinks`, and the repo's existing
speckit skills are already dual real copies — this matches that pattern. **Edit
both or neither.**

Installed (8): `remotion-best-practices` (the router — **enter here**),
`remotion-markup`, `remotion-create`, `remotion-render`, `remotion-docs`,
`remotion-captions`, `remotion-multimedia`, `remotion-interactivity`.

`remotion-captions` and `remotion-multimedia` are on the list for a specific
reason: the cut must read silent with on-screen text, and an Egyptian Arabic
voice-over is laid over a locked cut later.

`remotion-markup` is the one whose name undersells it — it is "content, animation
and effects best practices", i.e. `sequencing.md`, `timing.md`, `transitions.md`,
`multi-scene-video.md`, `text-highlights.md`, `voiceover.md`, `google-fonts.md`.
That is the beat sheet's material almost line for line.

`remotion-interactivity` is installed as a **link target**, not because Studio
drag-to-position editing is how this video gets authored. Four installed files
link to it (`remotion-create/SKILL.md`, `remotion-markup/SKILL.md`,
`cropping.md`, `text-highlights.md`). At 7.7 KB it is cheaper to carry the skill
than to carry four hand-edits that have to be re-applied at every upstream sync.

### Not installed, and why

`remotion-maps` (geographic animation — Cesium, Mapbox, GeoJSON flyovers),
`remotion-saas` (`<Player>`, Lambda, render backends), `remotion-upgrade`
(premature). None applies to a hand-authored promotional MP4, and `remotion-maps`
alone is 569 KB of 3D assets, which is why it is the one exclusion still worth
two hand-edits.

### The only two files that diverge from upstream — read before upgrading

Every other installed file is **byte-identical to upstream**. Keep it that way:
when a link would dangle, prefer installing the target over hand-editing the
file. That principle is why `remotion-interactivity` is here at all.

1. **`remotion-best-practices/SKILL.md`** — upstream ships the router with a full
   copy of every other skill nested inside its own directory, linked as
   `<name>/REFERENCE.md`. That cannot work in a flat `skills/` layout, so its
   links are flattened to `../<name>/SKILL.md` and the three uninstalled skills'
   sections removed. Section bodies are otherwise upstream's, unedited. A comment
   at the top of the file says the same thing. **This divergence is unavoidable
   in a flat layout** — it would persist even at a full eleven-skill install.
2. **`remotion-markup/SKILL.md`** — its two links to `remotion-maps` are
   flattened to plain text marked `(skill not installed in this repo)`, and its
   own embedded 569 KB copy of `remotion-maps` was stripped.

Verified after install: **zero dangling internal links in either tree.**

To upgrade, re-clone upstream and redo those two files — or install
`remotion-maps` as well, which reduces it to the router alone. Do not run
upstream's `scripts/sync-agent-skills.ts`: it builds symlinks into a
`packages/skills/skills` path that does not exist here.

The skills are markdown only. They add nothing to any lockfile and are invisible
to CI, for the same reasons this whole directory is.

## How `apps/web` components are made to work

Three pieces, in `remotion.config.ts` and `src/tailwind.css`:

1. **`@` alias → `../apps/web`.** Webpack has no idea about the app's
   `tsconfig.json` paths, so without this every internal import inside an
   imported component (`@/lib/utils`, `@/components/...`) fails to resolve.

2. **`react` / `react-dom` pinned to this project's copies.** Because `video/`
   is outside the workspaces, a file under `apps/web` resolves `react` by
   walking *up* to the root hoisted copy — two React instances in one bundle,
   which means hooks throw and context silently returns defaults. The alias
   collapses them to one.

3. **Tailwind via `@remotion/tailwind-v4`, with `src/tailwind.css` importing
   `apps/web/app/globals.css` verbatim.** No palette is re-declared here; the
   `@theme` tokens are the shipped app's. `@source` directives are required
   because Tailwind v4 scans downward from the CSS file's own directory, which
   would otherwise miss every utility used in `apps/web`.

### Caveats when pulling in further components

- **Client-only components need care.** Anything importing `server-only`, or
  reading Supabase/`next/headers` at module scope, will not bundle. Prefer
  presentational components, or pass data in as props.
- **`next/font` does not exist here.** `globals.css` sets
  `--font-display: "Outfit"`, but in the app it is `next/font` that actually
  loads the file. Remotion loads it via `@remotion/google-fonts` instead — see
  `src/WebComponentProbe.tsx`. Any component depending on a font token needs the
  same treatment or it silently falls back to a generic face.
- **`next/image` and `next/link` will need shimming** if a component reaches for
  them.

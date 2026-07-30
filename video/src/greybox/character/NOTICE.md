# The character base — provenance, licence and landmarks

## What the asset is

`av2-base.svg` is a [getavataaars.com](https://getavataaars.com) export, stripped to the
regions the rig needs, at `viewBox 0 0 264 280` with a transparent background.

    Avatar Style   Transparent
    Skin           Brown            (#EDB98A)
    Top            Short-Hair / Short-Flat
    Hair           BrownDark        (#4A312C)
    Clothes        Shirt Crew Neck  (#25557C)
    Nose           Default
    Facial hair    Blank
    Accessories    Blank

**The appearance is locked.** Skin tone, hair and shirt are Mohamed's picks. Do not
re-export, re-pick or "improve" them.

**Three regions were deleted from the export**, because the rig draws them:
`Mouth/Default`, `Eyes/Default`, `Eyebrow/Natural/Default-Natural`. What the base keeps is
the body/skin path, `Neck-Shadow`, the shirt, the hair and `Nose/Default`.

## Licence — MIT, and it was read rather than assumed

Avataaars is by **Pablo Stanley**; the React implementation the web exporter is built on is
[`avataaars`](https://www.npmjs.com/package/avataaars) by Pablo Stanley and Fang-Pen Lin.
The website describes the licence in plain English ("free for personal and commercial use,
no attribution required"), which is a grant rather than a licence text — so the actual
`LICENSE` file in the npm package was read instead. It is **MIT**:

```
MIT License

Copyright (c) 2017 Pablo Stanley, Fang-Pen Lin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**The export was tied to that package rather than only to the website's grant**, because
this repository is public and a plain-English grant is not a licence. Every path in
`av2-base.svg` was checked byte-for-byte against `avataaars@2.0.0`:

| Region | Source file in the package |
|---|---|
| body / skin path | `src/avatar/index.tsx` + `src/avatar/Skin.tsx` |
| shirt + collar shadow (`165.960472,29.2949161 …`) | `src/avatar/clothes/ShirtCrewNeck.tsx` |
| hair (`180.14998,39.9204083 …`) | `src/avatar/top/ShortHairShortFlat.tsx` |
| nose (`M16,8 C16,12.418278 …`) | `src/avatar/face/nose/Default.tsx` |

All four match. MIT covers modification, distribution and commercial use, so shipping a
derived asset in a public repository and in a promotional video is squarely inside the
grant. Its **only** condition is that the notice above travels with it — which is what this
file is for. Recorded in `docs/DECISIONS.md`, 2026-07-30.

## Landmarks, measured off the vector

These are the registration coordinates the rig draws against, in the base's own
`0 0 264 280` viewBox. Face centre is **x = 132**.

| Landmark | Value |
|---|---|
| Eye line | y 112 |
| Pupils | (106, 112) and (158, 112), r 6 — inter-pupil 52 |
| Brow band | y 88 – 100; left x 88 – 118, right x 146 – 176 |
| Nose arc | x 120 – 144, y 130 – 138 |
| Mouth (deleted) | x 118 – 146, y 149 – 163 |
| Chin | y ≈ 181 |
| Hair top | y ≈ 20 at centre, ≈ 15 at the spikes (x 150 – 180) |
| Head silhouette | x 76 – 188 (width 112) |
| Neck | x 108 – 156, y 181 – 199 |
| Shirt | x 32 – 232, y 199 – 280; collar notch bottom y ≈ 222 |

Feature fill opacities in the original export: eyes 0.6, brows 0.6, mouth 0.7, nose 0.16.
**Every facial feature is `#000000` at an opacity — there is no palette and there are no
whites.** That is the grammar the authored primitives follow; see `features.tsx`.

### Ears — the handover note said they do not exist. They do.

`av2_landmarks.json` (the handover file, not committed — this table supersedes it) flagged
`ears: ABSENT — no ear geometry exists. Headphones must be placed at a chosen coordinate.`
That is misleading. There is no ear *element*, because the ears are baked into the skin
path — but they are drawn, and they are measurable. Read off the path directly:

| | viewBox 0 0 264 280 |
|---|---|
| Ear centre, y | **117** |
| Ear band, y extent | 98 – 136 (flat outer section 110 – 124) |
| Ear outer edge, x | 66 (left) / 198 (right) |
| Head silhouette at ear level, x | 76 / 188 |
| Ear centre, x | **71** / **193** |
| Protrusion per side | 10 |

Derived from the body path's own segments — `C38.48,99.06 34,94.05 34,88 L34,74
C34,68.05 38.32,63.12 44,62.17` in the body group's local space, plus its `translate(32,
36)`. The flat outer section runs local y 74 → 88, so the centre is local y 81 → **viewBox
117**, and the outer edge is local x 34 → **viewBox 66**.

**The ear centre (y 117) sits five pixels BELOW the eye line (y 112).** Headphones hung on
the eye line ride visibly high. `features.tsx` attaches them at 117.

A raster measurement of the same landmarks gave ear centre y 116.9 and outer edge x 66.0 —
agreeing to within a tenth — and a protrusion of 5.9, which is the only figure that differs
materially. The vector says 10 (x 66 → 76). The vector wins; 5.9 is what a soft antialiased
edge measures on an 800px render.

## The two adjustments the handover flagged

1. **The nose was too faint.** `fill-opacity` 0.16 against the mouth's 0.7 — roughly four
   times fainter, and it did not read at the tight framing. Raised to **0.27**, chosen off a
   render at beat 8's framing rather than off the suggested 0.25–0.30 range.
2. **The shoulders did not reach the frame edges** — 32 → 232 inside a 264-wide box, about
   12% padding each side. Not fixed with a scale transform: a plain x-scale widens the crew
   neck's own opening and the collar with it. `rig.tsx` draws an **authored shoulder
   extension** behind the base instead — a quadratic in the shirt's exact `#25557C` whose
   apex is pinned at y 228, below the collar notch at 222, so it can never intrude on the
   neck, and whose ends are driven off the framing window so the shoulders exit the left and
   right edges at every aspect ratio.

## `expression-reference.json`

Per-expression primitive geometry for six Avataaars expressions, including brow path data.
It is **shape reference for the authored primitives and nothing else.** Do not wire these in
as animation assets: they are discrete separate drawings, and cross-fading them is exactly
the jump cut the rig exists to prevent.

What it is actually good for is the grammar. `Eyes/Default` is two filled r-6 circles and no
sclera at all. `Eyes/Squint` is a lens *plus* a separate pupil circle — which is where the
rig's clipped-iris eye comes from. `Eyebrow/Natural/Default-Natural` is a filled leaf,
pointed at both ends and thickest in the middle, not a stroked line. `Mouth/Default` is a
filled crescent. Whites (`#FFFFFF`) appear only in the extreme presets — Surprised, Grimace's
teeth, Wink — and none of the five poses this rig uses reaches them.

# shadcn ↔ Mist & Meadow CSS-Variable Mapping

This is the runtime-reference form of `plan.md`'s Decision B. The
mapping lives in two places — this contract file and the
`apps/web/app/globals.css` `@theme inline` block — and the two MUST
stay in sync. Any change here requires the same change in
`globals.css` and a `docs/CHANGELOG.md` entry per Constitution
Principle VIII.

---

## Mapping table

| shadcn CSS variable | Mist & Meadow source (light) | Mist & Meadow source (dark) | Notes |
|---|---|---|---|
| `--color-background` | `var(--color-bg)` (`#ECEEE9`) | `var(--color-bg)` (`#161917`) | Page background. |
| `--color-foreground` | `var(--color-ink)` (`#1F2522`) | `var(--color-ink)` (`#DCDED5`) | Body text. |
| `--color-card` | `var(--color-surface)` (`#F5F6F2`) | `var(--color-surface)` (`#20231F`) | Card fill. |
| `--color-card-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a card. |
| `--color-popover` | `var(--color-surface)` | `var(--color-surface)` | Dropdown/popover fill. |
| `--color-popover-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a popover. |
| `--color-primary` | `var(--color-meadow)` (`#7A9275`) | `var(--color-meadow)` (`#97AE91`) | Primary actions. |
| `--color-primary-foreground` | `var(--color-bg)` | `var(--color-bg)` | Symmetric. Light gives bg-on-meadow ≈ 5.8:1 AA; dark gives bg-on-meadow ≈ 7.4:1 AA. An earlier asymmetric `--color-ink` mapping in dark mode failed WCAG AA (~3.1:1). |
| `--color-secondary` | `var(--color-foggy)` (`#8AA9B6`) | `var(--color-foggy)` (`#9CBBC7`) | Secondary actions. |
| `--color-secondary-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a secondary button. |
| `--color-muted` | `var(--color-surface)` (`#F5F6F2`) | `var(--color-surface)` (`#20231F`) | Muted fill (Skeleton, muted Card, hover rows, Tab unselected). Mapped to surface, NOT border — see research.md R-2. |
| `--color-muted-foreground` | `var(--color-muted)` (`#6E7572`) | `var(--color-muted)` (`#8B928F`) | Muted text. |
| `--color-accent` | `var(--color-foggy)` | `var(--color-foggy)` | Hover / focus accent. |
| `--color-accent-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on an accent fill. |
| `--color-destructive` | `var(--color-crimson)` (`#7B4244`) | `var(--color-crimson)` (`#C17F81`) | **FR-042 scope-clarified per CHANGELOG 2026-05-20**: crimson permitted on destructive action surfaces only. Supersedes the earlier amber mapping (amber + dark-mode ink failed WCAG AA at 1.4:1). |
| `--color-destructive-foreground` | `var(--color-bg)` | `var(--color-bg)` | Symmetric. Light gives bg-on-crimson ≈ 6.08:1 AA; dark gives bg-on-crimson ≈ 5.02:1 AA. Same theme-adaptation pattern as `--color-primary-foreground`. |
| `--color-border` | `var(--color-border)` | `var(--color-border)` | Soft border. |
| `--color-input` | `var(--color-border)` | `var(--color-border)` | Form input border. |
| `--color-ring` | `var(--color-meadow)` | `var(--color-meadow)` | Focus ring. |

### Radius ladder

Tailwind v4 generates the `rounded-{sm,md,lg,xl,2xl,3xl,4xl}` utility
classes from `--radius-*` tokens. Anchored to the existing Mist &
Meadow radii (`--radius-control` 8px for interactive controls;
`--radius-card` 12px for cards):

| shadcn CSS variable | Value | Notes |
|---|---|---|
| `--radius` | `var(--radius-control)` (8px) | Base; consumed by primitives that use `rounded-[--radius]` directly. |
| `--radius-sm` | `6px` | Small interactive elements (badges, chips). Above the Constitution V ≤4px sharp-corner floor. |
| `--radius-md` | `var(--radius-control)` (8px) | Buttons, inputs, dropdowns — matches Mist & Meadow's locked control radius. |
| `--radius-lg` | `var(--radius-card)` (12px) | Cards — matches Mist & Meadow's locked card radius. |
| `--radius-xl` | `16px` | Larger feature surfaces. |
| `--radius-2xl` | `20px` | Hero surfaces. |
| `--radius-3xl` | `24px` | Reserved (extends ladder). |
| `--radius-4xl` | `28px` | Reserved (extends ladder). |

**The `--color-*` prefix is load-bearing.** Tailwind v4 generates
color utility classes (`bg-destructive`, `text-foreground`, etc.)
only from tokens that match the `--color-*` naming convention in
`@theme` blocks. An earlier unprefixed shape (registered as
`--destructive`, `--background`, etc.) declared the variables but
produced NO Tailwind utility classes — shadcn primitives rendered
unstyled (e.g. `<Button variant="destructive">` resolved to
`background-color: rgba(0,0,0,0)` and inherited `color` from its
parent). See research.md R-2.1 for the discovery sequence. The same
prefix convention applies to `--radius-*` for radius utilities.

**Three load-bearing choices** (out of the 19 rows above), called
out explicitly because each was forced by a non-obvious constraint:

- `--color-destructive` → `var(--color-crimson)` AND
  `--color-destructive-foreground` → `var(--color-bg)`. FR-042's
  scope clarification (CHANGELOG 2026-05-20) permits red only on
  destructive action surfaces. Amber was the original mapping but
  failed dark-mode WCAG AA at 1.4:1 (`#DCB587` amber + `#DCDED5`
  dark-ink ≈ 1.4:1). Crimson + bg-as-foreground clears AA in both
  modes.
- `--color-muted` → `var(--color-surface)`, not `--color-border` —
  see research.md R-2. shadcn's `--color-muted` is consumed as a
  fill surface, not a hairline border.
- `--color-primary-foreground` → `var(--color-bg)`, symmetric across
  modes — see research.md R-2. The originally-asymmetric
  `--color-ink` mapping in dark mode failed WCAG AA at ~3.1:1.

---

## `globals.css` block (the canonical implementation)

The mapping is implemented in `apps/web/app/globals.css` as a single
`@theme inline` block plus a `:root.dark` override block. The shape:

```css
@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-ink);
  --color-card: var(--color-surface);
  --color-card-foreground: var(--color-ink);
  --color-popover: var(--color-surface);
  --color-popover-foreground: var(--color-ink);
  --color-primary: var(--color-meadow);
  --color-primary-foreground: var(--color-bg);
  --color-secondary: var(--color-foggy);
  --color-secondary-foreground: var(--color-ink);
  --color-muted: var(--color-surface);
  --color-muted-foreground: var(--color-muted);
  --color-accent: var(--color-foggy);
  --color-accent-foreground: var(--color-ink);
  --color-destructive: var(--color-crimson);
  --color-destructive-foreground: var(--color-bg);
  --color-border: var(--color-border);
  --color-input: var(--color-border);
  --color-ring: var(--color-meadow);

  /* Radius ladder — 8px control / 12px card anchors */
  --radius:     var(--radius-control);
  --radius-sm:  6px;
  --radius-md:  var(--radius-control);
  --radius-lg:  var(--radius-card);
  --radius-xl:  16px;
  --radius-2xl: 20px;
  --radius-3xl: 24px;
  --radius-4xl: 28px;
}

:root.dark {
  /* Mist & Meadow dark overrides (already present in feature 001;
     `--color-crimson` added 2026-05-20 per the FR-042 scope
     clarification in CHANGELOG). */
  --color-bg:      #161917;
  --color-surface: #20231F;
  --color-ink:     #DCDED5;
  --color-muted:   #8B928F;
  --color-meadow:  #97AE91;
  --color-foggy:   #9CBBC7;
  --color-amber:   #DCB587;
  --color-crimson: #C17F81;
  --color-border:  #2D3130;
  /* All shadcn variables track through their @theme inline mapping —
     including --primary-foreground (= --color-bg),
     --destructive-foreground (= --color-bg), and --muted
     (= --color-surface), which are symmetric across modes. */
}
```

`--radius-card` (12px) and `--radius-control` (8px) are pre-existing
in `globals.css`'s `@theme` block from feature 001 and are NOT
re-declared. The `--radius-md` and `--radius-lg` lines above point
to those existing tokens so Tailwind's `rounded-md` (controls) and
`rounded-lg` (cards) resolve correctly without further per-primitive
overrides.

The `@theme inline` block is the only place where shadcn variable
names appear at top level. Tailwind v4 reads `@theme` and looks for
the `--color-*` prefix (color utilities) and `--radius-*` prefix
(radius utilities) to register tokens for utility-class generation —
`bg-primary` resolves to `background-color: var(--color-primary)`,
`rounded-md` resolves to `border-radius: var(--radius-md)`, etc.
The unprefixed shape (e.g. `--primary` alone) declares a CSS variable
but does NOT generate any utility class. See R-2.1 of research.md.

Dark mode swaps the underlying Mist & Meadow hex values; the shadcn
variables track them automatically via the `var()` chain. No
shadcn-side variable needs a dark-mode-specific override at the
`@theme inline` layer — all overrides happen at the
`--color-bg` / `--color-ink` / etc. level inside `:root.dark`.

---

## Verification checklist

When `/speckit.implement` reaches step 3 (shadcn install), this
checklist gates the commit:

- [ ] `npx shadcn@latest init` from `apps/web/` completed without
  errors.
- [ ] `apps/web/components.json` matches the shape in `plan.md`
  Decision E.
- [ ] The 19 mapping rows above are present in `globals.css`'s
  `@theme inline` block, all using the `--color-*` prefix (load-
  bearing for Tailwind v4 utility-class generation; see R-2.1).
- [ ] The 7-step radius ladder (`--radius-sm/md/lg/xl/2xl/3xl/4xl`)
  is present in the same `@theme inline` block; `--radius-md` and
  `--radius-lg` reference the pre-existing `--radius-control` and
  `--radius-card` Mist & Meadow tokens.
- [ ] Computed-style probe: `<Button variant="destructive">` resolves
  to `background-color: rgb(123, 66, 68)` (light, `#7B4244`) /
  `rgb(193, 127, 129)` (dark, `#C17F81`) and `color:
  rgb(236, 238, 233)` (light, `#ECEEE9`) / `rgb(22, 25, 23)`
  (dark, `#161917`). NOT transparent (which would indicate
  Tailwind didn't generate the utility class — see R-2.1).
- [ ] Computed-style probe: any `<Button>` (default variant) has
  `border-radius: 8px` (= `--radius-md` = `--radius-control`).
  NOT `0px` (which would indicate the radius ladder is missing).
- [ ] No `--destructive` rule outside the table — search
  `globals.css` for any literal `--color-destructive` reference;
  only the mapping line should match.
- [ ] `shadcn add` succeeded for `button card dropdown-menu sheet
  dialog avatar separator`.
- [ ] Auth Playwright specs from feature 001 pass unchanged (the
  (auth) pages import zero shadcn primitives, so the diff at this
  step MUST be visually empty on those surfaces).
- [ ] Manual visual review: a destructive-variant button (e.g., a
  placeholder mounted in a developer-preview surface) renders with
  crimson fill — `#7B4244` in light mode, `#C17F81` in dark mode —
  and bg-colored text per the symmetric `--destructive-foreground`
  → `--color-bg` mapping (light text `#ECEEE9`, dark text `#161917`).
  Not amber, not shadcn-default red.

---

## Forbidden patterns

- Adding a new shadcn CSS variable without a corresponding row in
  this table.
- Mapping any shadcn variable to a hue in the red sector (340–20°)
  in either mode.
- Introducing a parallel "shadcn-default" palette alongside Mist
  & Meadow.
- Overriding a shadcn primitive's emitted CSS file directly (rather
  than via the variable mapping).

Each is a Constitution Principle V violation and blocks the merge.

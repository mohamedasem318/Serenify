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
| `--background` | `var(--color-bg)` (`#ECEEE9`) | `var(--color-bg)` (`#161917`) | Page background. |
| `--foreground` | `var(--color-ink)` (`#1F2522`) | `var(--color-ink)` (`#DCDED5`) | Body text. |
| `--card` | `var(--color-surface)` (`#F5F6F2`) | `var(--color-surface)` (`#20231F`) | Card fill. |
| `--card-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a card. |
| `--popover` | `var(--color-surface)` | `var(--color-surface)` | Dropdown/popover fill. |
| `--popover-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a popover. |
| `--primary` | `var(--color-meadow)` (`#7A9275`) | `var(--color-meadow)` (`#97AE91`) | Primary actions. |
| `--primary-foreground` | `var(--color-bg)` | `var(--color-bg)` | Symmetric. Light gives bg-on-meadow ≈ 5.8:1 AA; dark gives bg-on-meadow ≈ 7.4:1 AA. An earlier asymmetric `--color-ink` mapping in dark mode failed WCAG AA (~3.1:1). |
| `--secondary` | `var(--color-foggy)` (`#8AA9B6`) | `var(--color-foggy)` (`#9CBBC7`) | Secondary actions. |
| `--secondary-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a secondary button. |
| `--muted` | `var(--color-surface)` (`#F5F6F2`) | `var(--color-surface)` (`#20231F`) | Muted fill (Skeleton, muted Card, hover rows, Tab unselected). Mapped to surface, NOT border — see research.md R-2. |
| `--muted-foreground` | `var(--color-muted)` (`#6E7572`) | `var(--color-muted)` (`#8B928F`) | Muted text. |
| `--accent` | `var(--color-foggy)` | `var(--color-foggy)` | Hover / focus accent. |
| `--accent-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on an accent fill. |
| `--destructive` | `var(--color-crimson)` (`#7B4244`) | `var(--color-crimson)` (`#C17F81`) | **FR-042 scope-clarified per CHANGELOG 2026-05-20**: crimson permitted on destructive action surfaces only. Supersedes the earlier amber mapping (amber + dark-mode ink failed WCAG AA at 1.4:1). |
| `--destructive-foreground` | `var(--color-bg)` | `var(--color-bg)` | Symmetric. Light gives bg-on-crimson ≈ 6.08:1 AA; dark gives bg-on-crimson ≈ 5.02:1 AA. Same theme-adaptation pattern as `--primary-foreground`. |
| `--border` | `var(--color-border)` | `var(--color-border)` | Soft border. |
| `--input` | `var(--color-border)` | `var(--color-border)` | Form input border. |
| `--ring` | `var(--color-meadow)` | `var(--color-meadow)` | Focus ring. |

**Three load-bearing choices** (out of the 19 rows above), called
out explicitly because each was forced by a non-obvious constraint:

- `--destructive` → `var(--color-crimson)` AND `--destructive-foreground`
  → `var(--color-bg)`. FR-042's scope clarification (CHANGELOG
  2026-05-20) permits red only on destructive action surfaces.
  Amber was the original mapping but failed dark-mode WCAG AA at
  1.4:1 (`#DCB587` amber + `#DCDED5` dark-ink ≈ 1.4:1). Crimson +
  bg-as-foreground clears AA in both modes.
- `--muted` → `var(--color-surface)`, not `--color-border` — see
  research.md R-2. shadcn's `--muted` is consumed as a fill surface,
  not a hairline border.
- `--primary-foreground` → `var(--color-bg)`, symmetric across modes
  — see research.md R-2. The originally-asymmetric `--color-ink`
  mapping in dark mode failed WCAG AA at ~3.1:1.

---

## `globals.css` block (the canonical implementation)

The mapping is implemented in `apps/web/app/globals.css` as a single
`@theme inline` block plus a `:root.dark` override block. The shape:

```css
@theme inline {
  --background: var(--color-bg);
  --foreground: var(--color-ink);
  --card: var(--color-surface);
  --card-foreground: var(--color-ink);
  --popover: var(--color-surface);
  --popover-foreground: var(--color-ink);
  --primary: var(--color-meadow);
  --primary-foreground: var(--color-bg);
  --secondary: var(--color-foggy);
  --secondary-foreground: var(--color-ink);
  --muted: var(--color-surface);
  --muted-foreground: var(--color-muted);
  --accent: var(--color-foggy);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-crimson);
  --destructive-foreground: var(--color-bg);
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-meadow);
  --radius: var(--radius-control);  /* 8px — primitives derive their corners from this */
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
re-declared. The `--radius` line above maps shadcn's expected
radius scale to the control radius; cards use `--radius-card`
directly via `rounded-[--radius-card]`.

The `@theme inline` block is the only place where shadcn variable
names appear at top level. Tailwind v4 reads `@theme` to register
the variables for use as Tailwind utility classes (e.g.,
`bg-primary` resolves to `background-color: var(--primary)`).

Dark mode swaps the underlying Mist & Meadow hex values; the shadcn
variables track them automatically via the `var()` chain. The only
dark-mode-specific shadcn variable is `--primary-foreground`,
overridden explicitly per the R-2 contrast rationale.

---

## Verification checklist

When `/speckit.implement` reaches step 3 (shadcn install), this
checklist gates the commit:

- [ ] `npx shadcn@latest init` from `apps/web/` completed without
  errors.
- [ ] `apps/web/components.json` matches the shape in `plan.md`
  Decision E.
- [ ] The 19 mapping rows above are present in `globals.css`'s
  `@theme inline` block (18 originals + `--destructive-foreground`
  added 2026-05-20).
- [ ] The `--primary-foreground` dark-mode override is present in
  `:root.dark` (or `.dark`).
- [ ] No `--destructive` rule outside the table — search
  `globals.css` for any literal `--destructive` reference; only
  the mapping line should match.
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

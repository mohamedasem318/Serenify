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
| `--primary-foreground` | `var(--color-bg)` | `var(--color-ink)` | **Asymmetric.** See R-2 in `research.md` — calm-first picks the softer contrast in each mode. |
| `--secondary` | `var(--color-foggy)` (`#8AA9B6`) | `var(--color-foggy)` (`#9CBBC7`) | Secondary actions. |
| `--secondary-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on a secondary button. |
| `--muted` | `var(--color-border)` (`#D6D7D1`) | `var(--color-border)` (`#2D3130`) | Muted fill (skeleton, tab background). |
| `--muted-foreground` | `var(--color-muted)` (`#6E7572`) | `var(--color-muted)` (`#8B928F`) | Muted text. |
| `--accent` | `var(--color-foggy)` | `var(--color-foggy)` | Hover / focus accent. |
| `--accent-foreground` | `var(--color-ink)` | `var(--color-ink)` | Text on an accent fill. |
| `--destructive` | `var(--color-amber)` (`#DCB587`) | `var(--color-amber)` (`#DCB587`) | **FR-042 hard requirement.** No red. Same hex both modes. |
| `--border` | `var(--color-border)` | `var(--color-border)` | Soft border. |
| `--input` | `var(--color-border)` | `var(--color-border)` | Form input border. |
| `--ring` | `var(--color-meadow)` | `var(--color-meadow)` | Focus ring. |

`--destructive-foreground` is not in the table because shadcn's
recent CLI emits primitives that derive the destructive variant's
text color from `--foreground` (mapped above to `--color-ink`). If
a future `shadcn add` introduces a primitive that references
`--destructive-foreground` directly, set it to `var(--color-ink)`
in both modes and update this table.

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
  --muted: var(--color-border);
  --muted-foreground: var(--color-muted);
  --accent: var(--color-foggy);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-amber);
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-meadow);
}

:root.dark {
  /* Mist & Meadow dark overrides (already present in feature 001) */
  --color-bg:      #161917;
  --color-surface: #20231F;
  --color-ink:     #DCDED5;
  --color-muted:   #8B928F;
  --color-meadow:  #97AE91;
  --color-foggy:   #9CBBC7;
  --color-amber:   #DCB587;
  --color-border:  #2D3130;

  /* Asymmetric override for primary-foreground in dark mode */
  --primary-foreground: var(--color-ink);
}
```

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
- [ ] The 18 mapping rows above are present in `globals.css`'s
  `@theme inline` block.
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
  amber `#DCB587` fill in both light and dark mode — NOT red.

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

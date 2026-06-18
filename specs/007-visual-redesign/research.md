# Phase 0 Research: Visual Redesign (Graphite)

**Feature**: `007-visual-redesign` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

This document resolves the two `[PLAN-DECISION]` items the spec deferred to `/speckit-plan`
(FR-012 type-scale mechanism; FR-021 scrim token) and records the code-grounded findings that
shape the plan. Every decision below was made **after reading the real `apps/web` source**, not
from the spec text alone. Where the audit contradicted an assumption in the brief, that is called
out under "Grounding corrections."

The formal `docs/DECISIONS.md` / `docs/CHANGELOG.md` entries are written later, during
implementation, per FR-035. This file is the planning-time rationale they will reference.

---

## R-1 — Type-scale token mechanism (resolves FR-012)

### Decision

**Override Tailwind v4's built-in `--text-*` scale** in the real `@theme` block of
`apps/web/app/globals.css`. Do **not** introduce new semantic size-token names + convert call
sites.

### What the audit found

Font-size usage across `apps/web` (excluding `*.test.*`), measured by grep:

- **149 `text-<size>` utility occurrences across 48 files.**
- **Zero arbitrary `text-[Npx]` / `text-[Nrem]` values** anywhere.
- Utilities in use and how they line up against the locked 8-step scale (13/14/17/18/20/24/30/38):

| Tailwind utility | TW v4 default | Locked role → px | Δ |
|---|---|---|---|
| `text-xs`  | 12px | caption / meta → **13** | **+1** |
| `text-sm`  | 14px | small / secondary → **14** | 0 |
| `text-base`| 16px | body → **17** | **+1** |
| `text-lg`  | 18px | notice / failure-error copy → **18** | 0 |
| `text-xl`  | 20px | card title → **20** | 0 |
| `text-2xl` | 24px | section heading → **24** | 0 |
| `text-3xl` | 30px | page heading → **30** | 0 |
| `text-4xl` | 36px | display / large-numeral → **38** | **+2** |

Five of the eight locked sizes (`sm`, `lg`, `xl`, `2xl`, `3xl`) are **already exactly** the locked
values. Only three need a value override: `xs` 12→13, `base` 16→17, `4xl` 36→38 — each a ≤2px nudge
that does not reflow layouts or re-classify which role reads as which.

The existing utility choices **already encode the locked role→size intent**: `text-xs` is used for
captions/helper/error text (auth `field.tsx`, `password-requirements.tsx`, `otp-panel.tsx` hints);
`text-sm` for secondary/button text; `text-base` for body and form inputs; `text-lg` for dialog/
sheet/notification titles; `text-xl` for card titles; `text-2xl` for section headings and card
titles; `text-3xl`/`text-4xl` for page headings, large numerals, and form hero headings.

**Three sizes sit above the locked ceiling — all deliberate oversized display/graphic one-offs:**

- `apps/web/app/(auth)/layout.tsx:41` and `apps/web/app/(onboarding)/layout.tsx:39` —
  `font-display text-4xl … sm:text-5xl` hero wordmark (48px desktop).
- `apps/web/components/anchor/get-ready-countdown.tsx:49` — `font-display text-8xl …` on-video
  countdown numeral (96px), which FR-022 explicitly **keeps** as the established on-video pattern.

These are display/graphic moments, not body roles. They are preserved as-is under the same
principle FR-020 applies to one-off geometry (`rounded-[28px]`, `aspect-[3/4]`): the locked 8-step
scale governs the role-driven sizes (`xs`…`4xl`); a small number of deliberately oversized brand/
graphic numerals live above it untouched.

### Why override (and not new semantic tokens)

1. **Auto-migration with zero call-site churn.** The app already speaks only in the standard
   utility ladder (no arbitrary sizes, no `5xl`-and-up role sizes). Changing three values in
   `@theme` re-skins all 149 sites correctly; new semantic names would require hand-editing 149
   call sites for **zero behavioural gain** and high regression risk.
2. **shadcn primitives ship the standard utilities internally.** `button.tsx` (`text-sm`),
   `dialog.tsx`/`sheet.tsx` (`text-lg`/`text-sm`), `dropdown-menu.tsx` (`text-sm`/`text-xs`),
   `card.tsx` (`text-2xl`/`text-sm`) all hard-code Tailwind size utilities. Overriding the scale
   applies the new sizes to them automatically; new token names would **not** reach them without
   also rewriting each vendored primitive.
3. **The role intent is already there.** Re-classifying every site under new names adds naming
   ceremony without changing a single rendered pixel beyond the three value deltas.

### How it is implemented (Phase 1, in `@theme`)

Express the locked px as rem against the **unchanged 16px root** (so user font-size scaling and
zoom keep working — matching Tailwind's own rem-based defaults). **Do not change the root/`html`
font-size** — that would rescale every rem-based utility and break the other locked values.

```css
@theme {
  /* type scale — only the three deltas; sm/lg/xl/2xl/3xl keep TW defaults (already locked values) */
  --text-xs:   0.8125rem;  /* 13px */  --text-xs--line-height:   1.4;
  --text-base: 1.0625rem;  /* 17px */  --text-base--line-height: 1.5;   /* body ≈1.5 (FR-011) */
  --text-4xl:  2.375rem;   /* 38px */  --text-4xl--line-height:  1.15;  /* heading ≈1.2 (FR-011) */
}
```

- **17px base body** (FR-011) is delivered by `--text-base: 17px` for `text-base` sites **plus** a
  base rule so untokened body text inherits 17px: `body { font-size: var(--text-base); }` in
  `@layer base` (the existing `html, body { … }` rule). This is a px-token inherit, not a root-rem
  change, so the rest of the scale is unaffected.
- **Line-heights** (FR-011: body ≈1.5, headings ≈1.2): set the `--text-*--line-height` companions
  for the overridden steps; the heading steps `xl`/`2xl`/`3xl` already trend ~1.2–1.4 in TW v4 and
  are tightened to ≈1.2 only where a heading needs it. `text-5xl`/`text-8xl` one-offs keep their
  local `leading-none`.

The chosen scale + mechanism is recorded in `docs/DECISIONS.md` at implementation time (FR-035).

### Alternatives considered

- **New semantic size tokens (`--text-caption`, `--text-body`, …) + convert call sites** — rejected:
  149 hand edits, larger Phase-2 surface, regression risk, and it cannot reach shadcn primitives'
  internal `text-sm`/`text-lg` without rewriting them too. No clarity gain (utilities already carry
  role intent).

---

## R-2 — Scrim token (resolves FR-021)

### Decision

Introduce **one fixed, Graphite-ink-derived scrim token** in the real `@theme` block and apply it
to all three overlays:

```css
@theme {
  --color-scrim: rgba(28, 32, 35, 0.60);  /* Graphite ink #1C2023 @ 60% — fixed in both modes */
}
```

Replace the raw-black scrims with the `bg-scrim` utility this token generates:

- `apps/web/components/ui/dialog.tsx:24` — `bg-black/80` → `bg-scrim`
- `apps/web/components/ui/sheet.tsx:24` — `bg-black/80` → `bg-scrim`
- `apps/web/components/notification.tsx:132` — `bg-black/50` → `bg-scrim` (mobile overlay; the
  desktop slide-in keeps `md:hidden` — no scrim, intentional non-modal feel, unchanged).

### What the audit found

Exactly three modal/sheet/notification scrims exist, all raw black at differing opacities
(`black/80`, `black/80`, `black/50`). The `notification.tsx` source comment already flags that
shadcn's default `bg-black/80` "is too harsh against the palette." There is no scrim token today.

### Why this value, and why it does not swap per mode

- **Ink-derived, never raw black** (FR-021 constraint): the value is the Graphite **light-mode ink**
  hue `#1C2023` = `rgb(28,32,35)` at 60% alpha — the brand's deep graphite, not `#000`.
- **One value, both modes** (the brief's explicit constraint): a scrim must *dim/flatten the
  backdrop*, so it must read dark in **both** modes. It therefore **cannot** be `var(--color-ink)` —
  `--color-ink` swaps to the near-white `#E2E5E8` in dark mode, which would invert the scrim. The
  token is a **fixed** value defined once in `@theme` and **not** overridden in `:root.dark`; the
  translucent graphite veil separates the modal surface (`bg-surface`) from the page and de-
  emphasises the backdrop in both light and dark.
- **Alpha 0.60** sits between the old `0.50` (judged "soft, modal-appropriate") and the old `0.80`
  (judged "too harsh"): clearly modal, still calm. Both-mode legibility (modal surface vs scrim) is
  on the SC-001 / US2 contrast checklist and is confirmed in `smoke-tests.md`.

Mechanically this is a **new real `@theme` token** (allowed; FR-005/FR-021), not an `@theme inline`
alias edit and not an alias pointed at a literal — so it respects the token rules. The alpha is
baked into the token value (so `bg-scrim` needs no `/opacity` modifier).

### Alternatives considered

- **Per-mode scrim with a `:root.dark` override** — rejected: the brief asks for *one* value, and a
  single translucent graphite veil already works in both modes.
- **`var(--color-ink)` with an opacity modifier** — rejected: inverts in dark mode (ink is near-
  white there).

---

## R-3 — Grounding corrections (audit vs. assumptions)

These are real-code findings that change *how* requirements are verified or implemented. They are
not scope changes; they keep the plan honest.

1. **The orb "frost" is glassmorphism applied via inline `backdropFilter`, not a `backdrop-blur`
   utility.** `apps/web/components/anchor/breathing-guide.tsx:121-123` sets
   `style={{ backdropFilter: FROST_FILTER, WebkitBackdropFilter: FROST_FILTER }}` where
   `FROST_FILTER = "blur(8px) saturate(0.85) brightness(1.04)"` (line 56). A grep for
   `backdrop-blur` returns **zero** matches, so SC-003 ("no `backdrop-blur`/glassmorphism, verified
   to zero occurrences") **must be verified by grepping `backdropFilter` / `backdrop-filter` /
   `WebkitBackdropFilter` as well as `backdrop-blur`.** Removing this inline backdrop-filter is the
   actual glassmorphism removal (FR-019/FR-028).
   - Distinct from this: the **softened webcam preview** uses `blur-[2px]`/`blur-0`
     (`anchor-recorder.tsx:587`) — a `filter: blur` on the video element, which FR-029 **keeps**.
     Do not confuse the two; only the orb's `backdropFilter` frost is removed.

2. **`globals.css` still holds the OLD "Mist & Meadow" values, not Graphite.** The `@theme` block
   (`globals.css:26-44`) and the `:root.dark` override (`globals.css:123-133`) carry the pre-
   Amendment-4 hexes (e.g. light meadow `#7A9275`, foggy `#8AA9B6`). Phase 1 swaps all nine role
   values to the ratified Graphite light/dark values (Constitution Principle V) — this is the token
   swap that auto-propagates the re-skin (US1). The comment block still says "Mist & Meadow" and is
   updated to "Graphite" in Phase 1.

3. **Fonts are wired via `next/font/google` (build-time self-hosting), not `next/font/local`.**
   `apps/web/app/layout.tsx:3,8-17` imports `Inter` + `DM_Serif_Display` from `next/font/google`,
   binding `--font-sans` / `--font-display`. `next/font/google` **downloads the font files at build
   and serves them from the app origin** — there is no runtime request to Google's CDN, so it is
   "self-hosted" in the sense Principle V / FR-010 require and is compatible with the nonce-based
   CSP. **Decision:** swap `DM_Serif_Display` → `Outfit` via `next/font/google` (keep `Inter`),
   repoint `--font-display` to `"Outfit"`. This is the minimal change, adds **no new runtime
   dependency** (FR-004), and retires DM Serif Display. `next/font/local` (committing the OFL `.woff2`
   files in-repo) is an equivalent OFL-compliant alternative if the team later wants the files
   vendored; not needed now.

4. **`--font-display` already drives every heading/title/numeral/wordmark via the `font-display`
   utility (~30 sites).** Repointing `--font-display` to Outfit auto-migrates all of them; no per-
   site edit is needed for the typeface swap. The retirement check (SC-007, "DM Serif Display
   appears nowhere") greps `DM_Serif` / `"DM Serif Display"` after Phase 1 — current references are
   only `layout.tsx` (the import) and `globals.css` (the token), both changed in Phase 1, plus a few
   stale code comments to clean up (`(auth)/layout.tsx:9`, `welcome-banner.tsx:15`,
   `role-placeholder.tsx:44`).

5. **Dark-mode elevation shadow (FR-020).** `--shadow-soft: 0 1px 2px rgba(0,0,0,0.04)`
   (`globals.css:40`) is defined once and not overridden for dark mode, where a 0.04 black shadow is
   effectively invisible. Phase 1 confirms a dark-appropriate value — either add a `:root.dark`
   `--shadow-soft` with a deeper alpha, or accept border-only elevation in dark — and records the
   choice. This is a small Phase-1 token confirmation, not a `[PLAN-DECISION]`.

6. **Two new tokens are real `@theme` tokens (not `@theme inline` aliases).** `--color-on-accent`
   (`#F8F9FA`, light only — dark filled-accent foreground uses the existing `--color-bg` token) and
   `--color-meadow-text` (`#346A56` light / `#63B292` dark, so it needs a `:root.dark` override).
   Both live in the real `@theme` block; `--color-muted` stays out of `@theme inline` (FR-007).

7. **OTP is one shared component across both verify flows.** `OtpPanel`
   (`components/ui/auth/otp-panel.tsx`, props `{ email, action, successHref, helperText }`) is
   rendered by `signup-form.tsx:86` (`action=verifySignupOtp`, success → onboarding) and
   `forgot-form.tsx:75` (`action=verifyResetOtp`, success → reset-password continuation). The
   password-reset code is entered on the **`/forgot-password` "check email" surface**, not on
   `/reset-password`. Only `action`/`successHref` differ — exactly the spec's "same component, only
   the success handoff target differs." **Freezing `OtpPanel`'s props API** is what keeps the OTP
   task and the auth-screens task on disjoint files (the call sites pass props; they are not edited
   for the OTP redesign).

8. **`baseline-section.tsx` lives under `components/anchor/` but is rendered only by the Account
   page** (`account/page.tsx:9,63`), not by the calibration route. Its redesign concern — the
   has-anchor pill text fix (FR-017) — is therefore **Account-scoped**; the calibration task must
   not touch it.

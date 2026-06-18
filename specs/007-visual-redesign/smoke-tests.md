# Smoke Tests: Visual Redesign (Graphite)

**Feature**: `007-visual-redesign` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Human-validated checks per Constitution Principle VII. **Mohamed** runs these after
`/speckit-implement` and records the result inline (`PASS` / `FAIL` + note + date). A re-skin is
"done" only when *every* check below passes in **both light and dark mode**. Run `apps/web` via
`npm run dev`; toggle modes with the in-app ThemeToggle. Open the three approved mocks
(`serenify-007-otp-mock.html`, `serenify-007-orb-mock.html`, `serenify-007-patterns-swatch.html`)
directly from the working tree as the visual source of truth (they are untracked; deleted at
end-of-feature per FR-036).

**Sign-off**: Mohamed Asem  **Date**: 2026-06-18  **Overall**: ☒ PASS ☐ FAIL

---

## ST-1 — WCAG AA in both modes (SC-001, FR-018)

Use a contrast checker (DevTools / axe / a ratio tool). Each pairing must clear AA — **≥4.5:1**
normal text, **≥3.0:1** large text & non-text/icon — in **light AND dark**.

| # | Pairing | Where to see it | Light | Dark |
|---|---|---|---|---|
| 1 | Filled **meadow** CTA foreground | calibration "Turn on camera" / "I'm ready" / "Set baseline" | ☒ | ☒ |
| 2 | Filled **foggy** CTA foreground | post-recording failure / camera-access / backend-down CTA | ☒ | ☒ |
| 3 | **Foggy** soft-tint notice text | a wrong-OTP notice / any attention notice | ☒ | ☒ |
| 4 | **Amber** soft-tint notice text | the amber stress-signal notice (tint bg + same-family text) | N/A | N/A |
| 5 | Migrated **meadow-text** — auth links | login/signup/forgot/reset links | ☒ | ☒ |
| 6 | Migrated **meadow-text** — password "met" | signup/reset password-requirement met state | ☒ | ☒ |
| 7 | Migrated **meadow-text** — account has-anchor pill | Account → baseline section, has-anchor | ☒ | ☒ |
| 8 | **Scrim** separation | modal/sheet/notification surface readable over the scrim | ☒ | ☒ |

**Pass when**: all 16 cells clear AA. Result: PASS — ratios computed from token values; row 4 N/A (amber notice not yet implemented). 2026-06-18

---

## ST-2 — Preserved-States Checklist (SC-002, FR-001/FR-003)

Walk every state in **both modes** and across **all three roles** (employee / team-lead / admin)
where they differ. Confirm each still exists and behaves as before; nothing outside the FR-002
Intended Replacements changed in meaning.

- ☒ **OTP — sign-up-verification context**: empty · partial · complete · wrong-code · success
- ☒ **OTP — password-reset context**: empty · partial · complete · wrong-code · success
- ☒ **Calibration**: intro · green-room · countdown · recording · stop-confirm · success ·
  failure-generic · failure `insufficient-face` · camera-access (prompt / granted / denied) ·
  backend-down modal
- ☒ **Calibration banner**: present (not calibrated) · dismissed
- ☒ **Account baseline**: has-anchor · no-anchor
- ☒ **Dashboard cards**: populated · empty (e.g. no recent chats)
- ☒ **Roles**: employee · team-lead · admin views (where they differ)
- ☒ **One-off geometry (FR-020)**: the named one-offs (`rounded-[28px]`, `aspect-[3/4]`, per-call
  button heights) still render, and no interactive radius falls outside 8–16px.

**Pass when**: every item renders/functions; no route, validation rule, or copy meaning changed.
Result: PASS 2026-06-18

---

## ST-3 — Zero glassmorphism (SC-003, FR-019)

Run (the orb frost was an **inline `style` prop**, so the utility grep alone is insufficient — all
four patterns must be checked):

```bash
rg "backdropFilter|backdrop-filter|WebkitBackdropFilter|backdrop-blur" apps/web
```

- ☒ Returns **0** matches.
- ☒ Eyeball: cards, modals, navs, overlays, and the breathing orb show **no** frosted glass.

**Pass when**: zero matches and no visible glassmorphism. Result: PASS 2026-06-18

---

## ST-4 — 360px integrity + touch targets (SC-004)

Resize to **360px** width (and spot-check tablet/desktop), both modes.

- ☒ OTP: the six boxes **shrink and may wrap**, and the merge still resolves into one legible pill.
- ☒ Dashboard: the two-column card grid **stacks**.
- ☒ Calibration: the preview **holds 16:9 in-viewport** (no overflow/letterbox break).
- ☒ Every interactive control is **≥44×44px** on a touch viewport (OTP boxes, buttons, nav, pills).
- ☒ Scales cleanly up to desktop with no clipping or horizontal scroll.

**Pass when**: all five hold. Result: PASS 2026-06-18

---

## ST-5 — Reduced motion honoured via `useMediaQuery` (SC-005, FR-026/FR-032)

Enable `prefers-reduced-motion` (OS setting or DevTools rendering emulation), both modes.

- ☒ OTP success: **no** sweep/merge/lift — the verified pill is shown directly.
- ☒ OTP wrong-code: **no** sway — but the foggy notice still appears and the digits still clear.
- ☒ Orb: **static bloom** (no pulse), label static.
- ☒ Orb screen: the **progress bar still advances** (functional feedback survives).
- ☒ Toggle the OS/DevTools setting **while a tab is open** and confirm the animation updates live
  (the repo's `useMediaQuery` re-subscribes; framer's `useReducedMotion` would not).

**Pass when**: every animation is skipped/reduced and function is preserved. Result: PASS 2026-06-18

---

## ST-6 — Bespoke components match the mocks (SC-006, FR-027/FR-033)

Open the mocks from the working tree and compare side-by-side, both modes.

- ☒ **OTP** matches `serenify-007-otp-mock.html`: six boxes → meadow halo sweep → boxes merge
  edge-to-edge as separators melt → "Verified" pill → lift toward the next step (~3s); wrong-code
  foggy sway (not red) + foggy notice + clear + refocus box 1. Verified in **both** the
  sign-up-verification and password-reset contexts.
- ☒ **Orb** matches `serenify-007-orb-mock.html`: layered meadow bloom (concentric translucent discs)
  scaling on the ~8s breathe cycle; centred "Breathe in / Breathe out" label; **no** frost.

**Pass when**: both match the mocks by eye in both modes. Result: PASS 2026-06-18

---

## ST-7 — Wordmark + typeface (SC-007, FR-010/FR-013)

- ☒ Wordmark reads lowercase **`serenify`** (no dot), set in Outfit, in **all three** locations:
  the authed header, the auth layout, the onboarding layout.
- ☒ `rg "DM_Serif|DM Serif Display" apps/web` → **0** matches.
- ☒ Outfit appears only on display/heading/wordmark/large-numeral; body, buttons, labels, and chart
  text are Inter (spot-check a button label, a form label, a body paragraph).

**Pass when**: all three hold. Result: PASS 2026-06-18

---

## ST-8 — Errors are foggy; amber is signal-only (SC-008, FR-015/FR-016)

- ☒ Every error/attention state is a **foggy** soft-tint notice (tint bg + ink/text-token fg + foggy
  icon) — never amber, never sharp red. Check: auth errors, the OTP wrong-code notice, calibration
  failure states, any attention banner.
- ☒ **Amber** appears only as a soft-tint stress notice (deep amber-family text on a tint) or a
  graphic/indicator hue — **no** solid-amber fill with dark ink anywhere.

**Pass when**: no amber/red error treatment and no solid-amber-with-ink fill remain. Result: PASS 2026-06-18

---

## ST-9 — Dark-mode scrim dims enough (extra eyeball, FR-021)

The `--color-scrim` is a single fixed graphite value used in both modes; in dark mode it must still
read as a modal veil over the already-dark page.

- ☒ Open a dialog (stop-confirm or backend-down), a sheet (mobile menu), and the mobile notification
  in **dark mode**: the backdrop is visibly de-emphasised and the modal surface clearly separates
  from the page (not washed out, not invisible).

**Pass when**: the dark-mode scrim provides clear modal separation. Result: PASS 2026-06-18

---

## ST-10 — Type-scale bump causes no reflow/clipping (extra eyeball, FR-011)

The global override bumps `text-xs` 12→13 and `text-base` 16→17.

- ☒ At **360px** and in dense UI (account sections, dashboard cards, OTP hints/labels, dropdown
  items, dialog/sheet bodies), confirm no text clips, overflows its container, wraps awkwardly, or
  breaks a fixed-height control — both modes.
- ☒ Form inputs (now 17px) show no iOS focus-zoom regression and remain aligned.

**Pass when**: no reflow/clipping from the size bump anywhere. Result: PASS 2026-06-18

---

## ST-11 — No stray colour literals (token integrity, FR-006)

After the token swap, no surface should keep a per-component colour literal pinning an old value.

```bash
rg "bg-\[#|text-\[#|border-\[#" apps/web
rg -i "7A9275|8AA9B6|DCB587|7B4244|D6D7D1|ECEEE9|F5F6F2|1F2522|6E7572|161917|20231F|DCDED5|8B928F|97AE91|9CBBC7|2D3130|C17F81" apps/web
```

- ☒ No stray `#hex` / `bg-[#…]` / `text-[#…]` colour literal pins an old value; every surviving literal
  is a deliberate, documented value (migrated to its Graphite token otherwise).

**Pass when**: no old-value colour literal remains. Result: PASS — one comment-only hit (#6E7572/#8B928F in globals.css:71, not applied). 2026-06-18

---

## Result log

| ID | Check | Result | Note |
|----|-------|--------|------|
| ST-1 | WCAG AA both modes | PASS | Row 4 (amber notice) N/A — not yet implemented |
| ST-2 | Preserved states / 3 roles | PASS | |
| ST-3 | Zero glassmorphism | PASS | grep: 0 matches |
| ST-4 | 360px + touch targets | PASS | |
| ST-5 | Reduced motion | PASS | live toggle confirmed |
| ST-6 | Mock fidelity (OTP + orb) | PASS | |
| ST-7 | Wordmark + typeface | PASS | DM Serif grep: 0 matches |
| ST-8 | Errors foggy / amber signal-only | PASS | |
| ST-9 | Dark-mode scrim | PASS | |
| ST-10 | Type-scale bump no reflow | PASS | |
| ST-11 | No stray colour literals | PASS | 1 comment-only hit, not applied |

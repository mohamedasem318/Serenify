# Quickstart: Visual Redesign (Graphite)

**Feature**: `007-visual-redesign` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

A re-skin, not a behavioural change — so "verify" means *looks right + nothing lost*, across both
modes, 360px→desktop, and reduced-motion. This is the loop Phase 3 and `smoke-tests.md` formalise.

## Run

```bash
# from repo root
cd apps/web
npm run dev          # Next.js 16 dev server
```

- Before writing any Next code, read `node_modules/next/dist/docs/` — this Next has breaking changes
  vs. training data (`apps/web/AGENTS.md`).
- Theme: next-themes, `attribute="class"`, storage key `serenify-theme`. Toggle via the in-app
  ThemeToggle (top-right on auth/onboarding; header on authed) to exercise **both modes**.
- Real-phone / LAN testing: if the app is dead over a LAN IP, it's the Next 16 cross-origin dev
  block — set `allowedDevOrigins` (not a crypto/secure-context issue).

## The visual source of truth (untracked, repo root)

Open these directly from the working tree while implementing; they are **never committed** and are
deleted at end-of-feature (FR-036):

- `serenify-007-otp-mock.html` — the six-box OTP merge (P2-B).
- `serenify-007-orb-mock.html` — the breathing-orb bloom (P2-E-orb).
- `serenify-007-patterns-swatch.html` — CTA foreground, role notices, meadow-link fix patterns.

## Verify (maps to Success Criteria)

Walk every in-scope surface (auth, onboarding, home dashboard, account, the full calibration flow,
shared dialogs/sheets/notifications) in **light AND dark**:

| Check | How | SC |
|---|---|---|
| Graphite palette + Outfit/Inter + lowercase `serenify` (no dot) in all 3 wordmark spots | Eyeball both modes | SC-007 |
| Filled meadow/foggy CTAs carry near-white (light) / bg (dark) fg, AA-clear | DevTools contrast on a meadow + a foggy CTA | SC-001 |
| Small meadow text (auth links, password "met", account has-anchor pill) uses `--color-meadow-text`, AA-clear | Inspect the migrated sites | SC-001 |
| Errors/attention = **foggy** soft-tint; amber soft-tint/graphic only; never red | Trigger a wrong OTP, an auth error, a calibration failure | SC-008 |
| Scrim is graphite, not raw black, both modes | Open a dialog, a sheet, the mobile notification | SC-001 |
| **Zero glassmorphism** | `rg "backdropFilter|backdrop-filter|WebkitBackdropFilter|backdrop-blur" apps/web` → 0 hits | SC-003 |
| **DM Serif gone** | `rg "DM_Serif|DM Serif Display" apps/web` → 0 hits | SC-007 |
| Preserved states intact | Walk the spec's Preserved-States Checklist, 3 roles | SC-002 |
| 360px integrity | Resize to 360px: OTP boxes wrap, dashboard grid stacks, preview holds 16:9; touch targets ≥44px | SC-004 |
| Reduced-motion honoured | OS/DevTools `prefers-reduced-motion`: OTP shows verified pill directly / skips sway; orb static but progress bar still advances | SC-005 |
| OTP + orb match mocks | Side-by-side with the two mock HTMLs | SC-006 |

## Tests

```bash
cd apps/web
npm run test         # Vitest + RTL — incl. new OtpPanel + BreathingOrb specs (Principle VII)
npm run test:e2e     # Playwright role e2e (employee/team-lead/admin) must still pass — a re-skin
                     # must not break role-gated flows
```

## Guardrails while implementing

- **Stop and report** rather than make any out-of-scope change (app logic, routing, data model,
  Supabase, ML, API contract, auth logic, or a new dependency) — FR-004 / spec Edge Cases.
- Change **real `@theme` tokens only**; never edit `@theme inline`, never point an alias at a literal,
  keep `--color-muted` out of `@theme inline` (FR-007).
- Reduced motion is gated via the repo's `useMediaQuery` hook, **never** framer's `useReducedMotion`.
- Report anything removed/replaced and trace it to FR-002 (FR-003); an untraceable removal is a defect.

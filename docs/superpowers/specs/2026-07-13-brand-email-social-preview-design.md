# Serenify Brand Email and Social Preview Design

## Scope

Polish the two Supabase Auth email templates, add a deliberate share preview for
`serenify.tech`, and verify the existing force-re-sign-in password reset behavior
before resolving BACKLOG issue #38.

## Email Rendering

Email clients cannot inherit Serenify's in-app theme. The templates therefore
keep a light default and their existing `prefers-color-scheme: dark` treatment.
The wordmark remains selectable HTML text for accessibility and deliverability.
It mirrors the application header at 24px, regular Outfit weight, unit line
height, and zero letter spacing. Arial remains the final fallback because Gmail
may decline to load the external Outfit web font.

Both CTA links use table-cell `align="center"` plus inline `text-align:center`.
This is intentionally redundant for compatibility with older email rendering
engines. No remote images or scripts are added to transactional emails.

## Social Preview

The root layout publishes canonical Open Graph and Twitter metadata for
`https://serenify.tech`. A 1200x630 Next.js Open Graph image route renders a
fixed dark Graphite composition with the existing Serenify icon, lowercase
wordmark, and the product description, "Workplace stress, gently noticed."
The image is intentionally theme-independent because link unfurlers do not
receive an authenticated user's theme setting.

## Password Reset Verification

The existing reset server action already calls `auth.signOut()` after a
successful `auth.updateUser()`. A focused unit test will prove the order and
ensure errors do not sign the user out. BACKLOG #38 will be marked resolved and
the matching GitHub issue closed in the same delivery change.

## Constraints

- No service-role key, database, RLS, API, inference, model, or secret changes.
- No Graphite token remapping.
- No amber or crimson use; this work has no stress or destructive state.
- Email HTML remains usable without external fonts.
- Metadata and template behavior receive automated contract coverage.

# Contract — the shared wordmark (`components/brand/wordmark.tsx`)

**Feature**: 013-public-surface-and-legal | **Plan**: [../plan.md](../plan.md) §8 | **Location decision**: [../research.md](../research.md) §8

Implements constitution v1.13.0 Amendment 17 (Principle V, Wordmark block): **one** shared definition, five in-tree consumers, and two named hand-sync exceptions whose obligation is enforced by a test rather than by a comment.

## §8 Wordmark

**The shared definition:** `apps/web/components/brand/wordmark.tsx`.

```tsx
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight", className, "lowercase")}>
      <span className="text-ink">seren</span>
      <span className="text-meadow-text">ify</span>
    </span>
  );
}
```

Size and spacing come from the caller's `className` (the five sites differ: `text-4xl sm:text-5xl` on the auth and onboarding layouts, `text-2xl` in the app header, and the new navbar/footer sizes). No dot, no terminal punctuation — there is no place in the markup for one.

**`lowercase` is passed after the caller's `className`, and the order is load-bearing.** `cn()` is `tailwind-merge`, which resolves conflicting utilities in favour of the **last** one. Written the other way round — `cn("… lowercase …", className)` — a caller passing `capitalize` would silently win, because both are in the same `text-transform` group and the caller's class comes later; the wordmark would render "Serenify" and no test would notice. Applying `lowercase` last is what makes **FR-030 structural rather than conventional**: casing cannot be overridden from a call site, while size and tracking still can — which is exactly what five sites with five different sizes need. A component test asserts that a caller passing `capitalize` still renders lowercase, so the ordering cannot be "tidied" back without failing CI.

> Why `components/brand/` and not `components/ui/`: [`research.md`](../research.md) §8.

**The five in-tree consumers** (all three existing ones currently render single-colour and change visibly):

| Site | File | Today |
|---|---|---|
| Public navbar | `components/public/public-navbar.tsx` | new |
| Public footer | `components/public/public-footer.tsx` | new |
| Authed app header | `components/header/header.tsx:26–28` | single-colour `text-ink` |
| Auth-pages layout | `app/(auth)/layout.tsx:41–43` | single-colour `text-ink` |
| Onboarding layout | `app/(onboarding)/layout.tsx:39–41` | single-colour `text-ink` |

**The two hand-sync exceptions**, and how the obligation is kept honest:

`app/opengraph-image.tsx:52` (Satori cannot load Outfit) and `supabase/templates/{confirmation,recovery}.html:38` (inline-styled email HTML) cannot consume the component. A comment is not a mechanism, so the obligation becomes a **test that is the contract** — `tests/unit/brand/wordmark-sync.test.ts`, running in the `web` CI job:

1. Parses `app/globals.css` for the live values of `--color-ink` and `--color-meadow-text` in **both** themes.
2. Reads `app/opengraph-image.tsx` from disk and asserts the wordmark is split into two elements coloured with the **dark-theme** values (the card is dark-themed: `#101214` background) — `seren` `#E2E5E8`, `ify` `#63B292`.
3. Reads both email templates and asserts (a) the light-mode inline styles split `seren`/`ify` with the light values `#1C2023`/`#346A56`, and (b) the `prefers-color-scheme: dark` and `[data-ogsc]` blocks override **both** halves with the dark values.
4. Asserts the shared component names the token classes, and that no file outside `components/brand/` contains a hand-typed `serenify` wordmark span.

A change on either side of the boundary — component, token value, or exception file — fails CI. That is what "any change to the wordmark MUST update them in the same pull request" means once it is enforced rather than remembered.

**Scope discipline.** This **implements** Amendment 17. It must not re-amend the constitution. Issue **#155** (`--color-on-accent`, `--color-scrim` unregistered in Principle V) is noted, not owned, and not fixed here.

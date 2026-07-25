# Contract — `lib/consent/evaluate.ts` (the consent evaluator)

**Feature**: 013-public-surface-and-legal | **Plan**: [../plan.md](../plan.md) §6 | **Decision**: [../research.md](../research.md) §6.2 | **Types**: [../data-model.md](../data-model.md) §6.1

The pure module boundary every consent gate depends on. Both gates (`contracts/consent-gates.md`) call only these three functions; neither reads the registry directly, and neither compares timestamps.

## §6.2 The `evaluate.ts` surface

```ts
// apps/web/lib/consent/evaluate.ts   (pure)
/** The revision currently shown to a user being prompted — the newest published one. */
export function currentRevision(key: ConsentTextKey): ConsentRevision;

/** The revision a user must hold at or after: the newest MATERIAL revision.
 *  Cosmetic revisions published after it do NOT move the requirement. */
export function bindingRevision(key: ConsentTextKey): ConsentRevision;

/** The gate. True iff the held version's registry index >= the binding revision's index. */
export function satisfiesConsent(key: ConsentTextKey, heldVersionIds: readonly string[]): boolean;
```

## What callers may rely on

- **Version identity is the only input.** `satisfiesConsent` reads registry indices, never `decided_at` and never a wall clock. `decided_at` is stored as evidence and is never a gate input (`research.md` §6.2).
- **Cosmetic descent.** A cosmetic revision published after the binding one does not move the requirement, so it re-prompts nobody. A material revision moves it, so it re-prompts everyone holding only earlier versions.
- **First revision is material by definition** — the first ask is always a material one (`research.md` §6.2).
- **A non-registry version id never satisfies the gate.** A well-formed but fabricated value is inert (`research.md` §6.3, §6.6, and risks **R7**/**R8** in `plan.md` §15).
- **Purity.** `registry.ts` imports no `server-only`, so both modules load under Vitest and the exhaustive table-driven suite of `research.md` §12.2 can cover every registry shape crossed with every held-version case without a database.

## Who resolves the version id

The **server** resolves the id from the registry at write time. A version id submitted by a client is compared, never stored: a form carrying a stale id is rejected and re-rendered (`contracts/consent-gates.md` §7.1). The database independently constrains the stored shape with the two `CHECK`s in `data-model.md` §6.5.

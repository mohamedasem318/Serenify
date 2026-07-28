# Phase 1 Data Model — Public Surface & Legal (013)

**Branch**: `013-public-surface-and-legal` | **Date**: 2026-07-25 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

One new table (`public.user_consents`), one new migration, one additive edit to an existing trigger, and one in-repo registry module that is not a database object at all. Nothing else in the schema is touched — see `plan.md` §2 (**Storage**) and §3.1.

**This file is the single source for the migration SQL and for the `document_version` CHECK regexes.** Every other artifact cross-references it and does not restate them. Section numbers are the plan's own; the full map is in `plan.md` §4.1.

| § | Contents |
|---|---|
| §6.1 | Registry shape — `ConsentTextKey`, `Materiality`, `ConsentRevision`, `CONSENT_REGISTRY` |
| §6.5 | Table shape, migration shape, RLS, grants, immutability trigger, alternatives rejected |
| §6.6 | The additive `handle_new_user()` edit |

---

## §6.1 Registry shape

The version registry is a **pure TypeScript module**, not a table (the decision and its rejected alternatives are in [`research.md`](./research.md) §6.1 and §6.3).

```ts
// apps/web/lib/consent/registry.ts   (pure — NO `server-only` import, so Vitest can load it)
export type ConsentTextKey = "terms_privacy" | "camera_inference";
export type Materiality = "material" | "cosmetic";

export type ConsentRevision = {
  /** `<consent_key>@YYYY-MM-DD.<n>` — the value stored in user_consents.document_version. */
  readonly versionId: string;
  /** Publication date. EVIDENCE ONLY — never an input to the gate (see §6.2). */
  readonly publishedOn: string;
  /** Human judgment made at publish time. NEVER derived from a text comparison. */
  readonly materiality: Materiality;
  /** Why this classification was chosen. Required; the reviewer reads this. */
  readonly rationale: string;
};

export const CONSENT_REGISTRY: Readonly<Record<ConsentTextKey, readonly ConsentRevision[]>>;
```

`versionId` is the join key between the registry and the stored row: `user_consents.document_version` holds exactly this string, and the two `CHECK`s in §6.5 constrain its shape independently of the application. The pure functions that read this registry are specified in [`contracts/consent-evaluate.md`](./contracts/consent-evaluate.md); the CI-enforced append-only guards over its entries are in [`research.md`](./research.md) §6.1.

---

## §6.5 Table shape, migration shape, RLS

One table, one row per accepted revision, append-only.

```sql
-- supabase/migrations/20260726000000_user_consents.sql
CREATE TABLE public.user_consents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_key      text        NOT NULL CHECK (consent_key IN ('terms_privacy','camera_inference')),
  document_version text        NOT NULL
                     CHECK (document_version ~ '^(terms_privacy|camera_inference)@\d{4}-\d{2}-\d{2}\.\d+$')
                     CHECK (document_version LIKE consent_key || '@%'),
  -- The withdrawal seam (FR-043). Only 'granted' is admissible today; feature 018
  -- widens this CHECK and inserts a NEW row. DECLINING WRITES NO ROW AT ALL, so
  -- 'declined' is deliberately absent — admitting it would invite writing one.
  decision         text        NOT NULL DEFAULT 'granted' CHECK (decision IN ('granted')),
  decided_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Re-accepting the same revision is a no-op, not a duplicate (ON CONFLICT DO NOTHING).
  CONSTRAINT user_consents_one_per_revision UNIQUE (user_id, consent_key, document_version)
);

CREATE INDEX user_consents_lookup_idx
  ON public.user_consents (user_id, consent_key, decided_at DESC);

-- Immutability: nothing may ever edit a consent record (FR-043b, SC-013).
CREATE OR REPLACE FUNCTION public.user_consents_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'user_consents rows are immutable' USING ERRCODE = '42501';
END; $$;
ALTER FUNCTION public.user_consents_immutable() OWNER TO postgres;

CREATE TRIGGER user_consents_no_update
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.user_consents_immutable();

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents FORCE  ROW LEVEL SECURITY;

CREATE POLICY user_consents_select_self ON public.user_consents
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_consents_insert_self ON public.user_consents
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
-- No UPDATE policy. No DELETE policy. No manager policy. No admin policy.

REVOKE ALL ON public.user_consents FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;
```

**Why `UPDATE` is blocked by a trigger but `DELETE` is not.** `DELETE` is withheld the same way the questionnaire tables withhold it — no policy, no grant — which stops every client role. It is deliberately **not** trigger-blocked, because a `BEFORE DELETE` raise would also fire on the `ON DELETE CASCADE` from `auth.users` and make genuine account deletion impossible. Editing a consent record and deleting an account are different acts; only the first is forbidden here. `UPDATE` gets the trigger as well as the missing grant because a future migration could re-grant `UPDATE` by accident, and "earlier rows are never overwritten" is the load-bearing promise of the whole model.

**Why `decision` exists with a single admissible value.** FR-043 requires a shape that does not preclude withdrawal. Feature 018 widens the CHECK to `('granted','withdrawn')` and inserts a new row — one `ALTER TABLE`, no new column on an existing history, no backfill, no restructuring. A presence-of-row design ("a row means granted") would force 018 to add a column or a second table, and "what is this person's current state" would become a two-table question. This is the standard consent-ledger shape and is what an auditor expects.

**Alternatives rejected:**
- **Two tables**, one per consented text. Doubles the RLS surface, the grants, the tests, and the evaluator for zero benefit; the two texts differ only in a key value.
- **Columns on `profiles`** (`terms_accepted_at`, `camera_consent_version`). Structurally cannot hold a history — accepting a revision would overwrite the previous answer, which FR-043b forbids in as many words. It would also widen the `profiles` SELECT whitelist that feature 004 deliberately narrowed.
- **A JSONB history column on `profiles`.** Same overwrite hazard (a rewrite of the whole array on every accept), no per-row constraints, no per-row uniqueness, and unindexable for the gate query.

---

## §6.6 The additive `handle_new_user()` edit

Ships in the same migration. The decision, the trust analysis, and the rejected alternatives are in [`research.md`](./research.md) §6.6.

```sql
-- Additive edit to public.handle_new_user(): the profiles INSERT is unchanged.
IF NEW.raw_user_meta_data ? 'terms_privacy_version' THEN
  INSERT INTO public.user_consents (user_id, consent_key, document_version)
  VALUES (NEW.id, 'terms_privacy', NEW.raw_user_meta_data->>'terms_privacy_version')
  ON CONFLICT DO NOTHING;   -- the CHECKs above reject a malformed value outright
END IF;
```

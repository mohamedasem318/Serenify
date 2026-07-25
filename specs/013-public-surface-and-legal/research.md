# Phase 0 Research — Public Surface & Legal (013)

**Branch**: `013-public-surface-and-legal` | **Date**: 2026-07-25 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Phase-0 output: the decisions the spec parked, each with its rationale and the alternatives rejected, plus the two analyses that had to be done before any code could be designed (the signup seam, the root-route takeover) and the testing strategy those decisions imply.

**Section numbers are the plan's own and are preserved unchanged**, so every existing `§n.n` cross-reference in `spec.md`, `plan.md`, and the contracts still resolves — only the file changed. The full map is in `plan.md` §4.1.

| § | Decision |
|---|---|
| §6.1 | A1 — how MATERIAL / COSMETIC is recorded |
| §6.2 | A2 — how "this user's consent predates this revision" is evaluated |
| §6.3 | A3 — where the version registry lives |
| §6.4 | A4 — where a declined prompt becomes reachable again |
| §6.6 | Recording the signup acknowledgement — the one genuinely awkward seam |
| §8 | Where the shared wordmark component lives |
| §11 | Routing — the root-route takeover |
| §12 | Testing strategy (Principle VII) |

---

## §6 — Consent data model and the re-consent mechanism

The four decisions the spec parked, each with rationale and rejected alternatives. **These rules apply symmetrically to both consented texts** — the Terms/Privacy acknowledgement and the camera-and-inference wording. Neither is built without the other; they share one registry, one table, one evaluator, and one set of tests.

### §6.1 Decision A1 — how MATERIAL / COSMETIC is recorded

**Decision.** A literal, hand-written field on each entry of an in-repo registry.

> The registry module's exact shape — `ConsentTextKey`, `Materiality`, `ConsentRevision`, `CONSENT_REGISTRY`, and the `versionId` format — is single-sourced in [`data-model.md`](./data-model.md) §6.1 and is not restated here.

Publishing a revision = editing the wording **and** appending a registry entry, in the **same PR**. The reviewer sees the diff of the text next to the classification and the stated reason. That is what makes it a human judgment rather than a computation.

**Guards (unit-tested, `web` CI job):**
- every entry has an explicit `materiality` and a non-empty `rationale`;
- `versionId` values are unique, well-formed, and prefixed with their own key;
- entries are ordered by `publishedOn` ascending;
- **append-only**: a frozen fixture snapshot of every previously published entry is compared field-by-field; editing or removing a published entry fails CI. History is the point (FR-043b), so history is enforced, not trusted.

**Rejected:**
- **Derived from a text diff or content hash.** Forbidden outright by FR-043a. A hash cannot tell a typo fix from a scope change, and it would flip materiality on a whitespace edit.
- **A database column set through an admin publishing UI.** No such surface exists, none is owned by any planned feature, and building one here would open a privileged write path in a product that is still fighting to *close* self-serve surfaces (#62). It also means a migration or a manual production insert for every copy tweak.
- **A git commit trailer** (e.g. `Consent-Materiality: material`). Invisible at runtime — the app cannot read git — so the gate would still need a runtime source, and the trailer becomes a second place to drift.

### §6.2 Decision A2 — how "this user's consent predates this revision" is evaluated

**Decision: version identity, not timestamp comparison.**

> The three functions this decision produces — `currentRevision`, `bindingRevision`, `satisfiesConsent` — are single-sourced in [`contracts/consent-evaluate.md`](./contracts/consent-evaluate.md) and are not restated here.

The first published revision of each text is `material` by definition — the first ask is always a material one.

**Why version identity is more robust than timestamp comparison:**

1. **It compares one clock to nothing.** A timestamp rule compares `user_consents.decided_at` (the database clock) against a `publishedOn` written by hand in a registry or a migration and made live by a deploy. Those three moments are never the same instant. Clock skew, a revision deployed a day after its stated date, a hotfix rolled back — each silently produces a wrong answer, and the answer is *whether a person is asked for consent*.
2. **It survives the deploy race exactly.** A user holding the old page in a tab when v2 deploys submits at `t > publishedOn(v2)` having read **v1**. A timestamp rule concludes they consented to v2. Version identity records what they actually saw — and the signup and gate forms carry the rendered version id, so a stale form is **rejected and re-rendered**, never mis-recorded (§7.1).
3. **A timestamp rule cannot express cosmetic descent.** To decide whether a user's timestamp falls after the last *material* revision, you must consult the registry anyway. So the registry is load-bearing either way; adding timestamps as the comparison input introduces a second, weaker source of truth that can disagree with the first.
4. **FR-039 already requires storing the version.** Once `document_version` is on the row, evaluating on it costs nothing. Evaluating on time means the auditable field and the enforced field are different fields.
5. **Auditability.** "Which wording did this person agree to?" is answered by reading one column, not by reconstructing which revision was live at an instant.

`decided_at` is still stored, NOT NULL — FR-035 and FR-039 require *when*. It is **evidence**, never the gate input.

**Rejected:** `consent.decided_at >= revision.published_at`, for the five reasons above. Also rejected: an integer `version_number` column compared with `>=`. It reads elegantly but throws away the identity of the accepted wording, which is precisely what FR-039 demands be recoverable.

### §6.3 Decision A3 — where the version registry lives

**Decision: an in-repo constants module** (`apps/web/lib/consent/registry.ts`), not a database table.

**Consequences for migrations.** Publishing a revision is a pull request and **zero migrations**. This feature ships **exactly one** migration, ever, for consent. A DB registry would force one of two bad shapes: a seed migration per revision (a schema migration for a comma), or a runtime insert path plus the admin surface to drive it.

**Consequences for FR-039 ("which wording was shown").** The stored `document_version` is opaque to Postgres but fully resolvable in the repository:

```
user_consents.document_version  →  CONSENT_REGISTRY entry  →  the PR/commit that added it
                                                           →  the exact rendered text at that commit
```

The wording itself lives in `lib/legal/copy.ts` and `lib/consent/copy.ts` in git. Git is append-only, signed by the platform, and *already* the publication mechanism — so it is stronger provenance than a DB row holding a copy of the text, which is mutable by anyone with write access. Each document page also **renders its own version id and publication date**, so a reader can see what they are accepting, and the registry rationale explains why it was or was not a re-consent event.

**Trust boundary.** The version id is never taken from the client at write time (§7.1, §7.2): the server resolves it from the registry itself, and a form carrying a stale id is rejected rather than recorded. The database independently constrains its shape with two `CHECK`s on `document_version` — the format, and the prefix equalling `consent_key`.

> Both `CHECK` expressions are single-sourced in the migration in [`data-model.md`](./data-model.md) §6.5 and are not restated here.

A **reconciliation test** asserts every distinct `document_version` shape the code can produce is a registry member, and a documented one-line query lists any stored value that is not — so a fabricated-but-well-formed id is inert (it never satisfies `satisfiesConsent`) *and* detectable.

**Rejected: a `consent_document_versions` table.** Its only genuine advantage is a foreign key. It costs a publishing surface nobody owns, a migration or manual insert per revision, and a duplicate of a fact git already holds authoritatively. It also invites the failure this design exists to prevent — an in-place `UPDATE` to a published version row.

**Rejected: a content hash as the version id.** It changes on a whitespace fix, it reads as noise in an audit trail, and materiality would still have to be attached out of band — so it buys nothing and costs legibility.

### §6.4 Decision A4 — where a declined prompt becomes reachable again

Because declining writes **nothing** (FR-042), there is no "declined" state to recover from. The absence of a satisfying record *is* the state, so every path that evaluates the gate is automatically a path back to the prompt. Concretely, per text:

**Terms/Privacy**
- *At signup*: the acknowledgement is a field on the form. "Reachable again" = the form re-renders with the box unchecked and the reason shown. Entered data is preserved (§7.1).
- *After signup (a material revision)*: the app-shell entry gate is a **render decision made on every authenticated request**, not a stored dismissal. Declining or closing the tab changes nothing; the next navigation into any authed route presents it again. While it stands, `/terms`, `/privacy`, and **Sign out** remain reachable (FR-043d).

**Camera / inference**
- *`/onboarding` (the anchor step)* and *`/app/calibrate`*: the gate is presented on every arrival while no satisfying record exists. Declining returns the user to `/app`; nothing is written. Arriving again — via the existing `CalibrationBanner` on `/app`, or via Account → Baseline — presents it again.
- *`/app/monitor`*: same evaluation; a user without consent gets the consent surface instead of the capture stage.
- *The deliberate, discoverable route back*: the existing **Account → Baseline** section (`components/anchor/baseline-section.tsx`) gains one line when consent is absent, naming the camera-and-inference consent and offering the control that opens it. This is where a user who declined and later changed their mind will look, and it already exists as the home of "your calm baseline".

**Explicitly not built**: a "consent settings" page or a withdrawal control. That is feature **018** (FR-043, Non-Goals).

### §6.6 Recording the signup acknowledgement — the one genuinely awkward seam

With email confirmation ON, `supabase.auth.signUp()` returns a user but **no session**. The request is unauthenticated, so it cannot satisfy the `TO authenticated` INSERT policy. The acknowledgement must nonetheless be recorded (FR-035).

**Decision.** Reuse the seam `full_name` already uses: the server action passes the acknowledged version id in `options.data`, and the existing `handle_new_user()` trigger — extended additively in this feature's migration — writes the consent row at auth-user creation.

> The additive edit to `public.handle_new_user()` — the `profiles` INSERT unchanged, a `user_consents` row written from `raw_user_meta_data->>'terms_privacy_version'` with `ON CONFLICT DO NOTHING` — is single-sourced with the rest of the migration SQL in [`data-model.md`](./data-model.md) §6.6 and is not restated here.

**Stated plainly: `raw_user_meta_data` is client-controllable on self-serve signup.** The existing trigger says so at `20260517000030_profile_trigger.sql:4–7` and is why `role` and `manager_id` are never read from it.

**And stated equally plainly: the version id is not a secret, so this seam is bypassable and it weakens SC-006.** `lib/consent/registry.ts` ships in the web bundle, so the current version id is readable by anyone. A caller who skips the product's UI entirely and speaks to Supabase Auth directly with the publishable anon key can call `signUp` with `options.data.terms_privacy_version` set to the **real current id** and obtain a fully satisfying `terms_privacy` consent row — without the acknowledgement ever being rendered, let alone checked. The shell gate will not catch that user, because their row is genuinely valid by every check the system can make. A caller who supplies *no* metadata gets an account with no consent row and **is** caught by the shell gate on first sign-in; only the deliberate-forgery case slips through.

**Which requirement is weakened, and by how much.** **SC-006** ("account creation cannot be completed without acknowledgement in 100% of attempts") holds for 100% of accounts created through the product's own signup surface — every real user path, JS and no-JS alike, because both funnel through the one server-side gate in §7.1. It does **not** hold against a caller who bypasses the surface entirely. That is not a hole this feature can close: any client-side origination of an account is forgeable by a client, and the acknowledgement cannot be made unforgeable while an unauthenticated party may create an account at all.

Three things make it acceptable to proceed, and none of them is "trust the client":

1. **The root cause is `/signup` being open self-serve**, which is issue **#62** — a ⛔ pre-production deploy blocker, an explicitly separate auth-posture concern that this feature does not address and must not be read as closing. Once account creation is invite-gated, the bypass has no unauthenticated caller to exploit. **The residual is bounded by #62's own gate**: #62 must close before real user data is processed, and so must this.
2. **The blast radius is one forged row for the forger's own account.** RLS scopes the write to `auth.uid()`; nobody can fabricate a consent record for another user, and nothing else in the product is unlocked by it. There is no privilege escalation and no path to another person's data.
3. **It is detectable.** A forged id is by construction a registry member, so the §6.3 reconciliation query will not flag it — but the row's provenance is: a `terms_privacy` consent whose `decided_at` precedes or coincides with account creation while no corresponding signup ever rendered is visible in the auth logs. Recorded as **R8** rather than claimed as a defense, because after-the-fact detection is not prevention.

*An earlier draft of this section claimed a fabricated value "grants nothing" because registry membership is the gate. That is true only for values that are not registry members, and the registry is public. The claim is withdrawn; the accurate statement is above.*

**Rejected:**
- **A `SECURITY DEFINER` RPC granted to `anon`.** An unauthenticated caller could then write consent rows for arbitrary user ids. Strictly worse.
- **Insert after `signUp` from the server action.** There is no session; the insert fails.
- **Record nothing at signup; let the shell gate record it at first sign-in.** Fails FR-035 (the acknowledgement must be recorded) and turns "prompted exactly once" into two asks for every new user.

---

## §8 — Where the shared wordmark component lives

**Location rationale:** `components/brand/` rather than `components/ui/`. `components/ui/` is the shadcn primitive namespace (`button`, `card`, `sheet`, …) and is regenerated from `components.json`; the wordmark is brand identity fixed by the constitution, not a primitive. A dedicated namespace also makes the Principle V rule greppable.

> The component itself, its five in-tree consumers, and the two hand-sync exceptions with their enforcing test are in [`contracts/wordmark.md`](./contracts/wordmark.md).

---

## §11 — Routing: the root-route takeover

**Decision: keep both existing behaviours in the root page component, and change only its terminal branch.**

`app/page.tsx` today does exactly three things (`page.tsx:20–29`): forward a `?code=`, redirect a signed-in visitor to `/app`, redirect everyone else to `/login`. It moves to `app/(public)/page.tsx` and the **third** branch becomes "render the landing page". The first two are untouched, line for line.

**Precedence, in this order:**
1. **`?code=` first.** A Supabase link landing on `/` forwards to `/auth/callback?code=…` before anything else. It must be first: a signed-in user in another tab clicking a recovery link would otherwise be redirected to `/app` and the code lost.
2. **Signed-in second.** `getUser()` → redirect to `/app`. The proxy's onboarding gate then bounces an un-onboarded user onward, exactly as today.
3. **Landing last.** Anonymous visitors get the public page.

**Why not move this into `proxy.ts`.** The proxy already computes `user` for every matched request, so the redirect would be free there and would let `/` drop `force-dynamic`. Rejected because the proxy is the load-bearing auth and CSP gate for the whole app, its `redirectTo` helper clears `url.search` (which would eat the `?code=`), and the change would put the two behaviours FR-017 protects into the file with the highest blast radius in the repo. Keeping them where they already work makes the diff provably behaviour-preserving for both.

**The cost is small and worth naming.** `/` stays `export const dynamic = "force-dynamic"`, so the landing page is not statically generated. In practice this is near-free for anonymous visitors: with no session cookie, `supabase.auth.getUser()` short-circuits without a network round-trip, and the proxy already runs on every request regardless. If TTFB proves disappointing in production, moving *only* the signed-in redirect into the proxy is a clean follow-up — recorded as a BACKLOG candidate in P8, not done here.

**Route-group mechanics.** Only one `page.tsx` may resolve to `/`, so this is a **move**, not an addition: `app/page.tsx` is deleted in the same commit that adds `app/(public)/page.tsx`. Per `apps/web/AGENTS.md`, confirm route-group + root-page behaviour against `node_modules/next/dist/docs/` before implementing — do not infer it.

**Proof** (§12): a pure `resolveRootRoute({ code, isSignedIn })` unit module returning `{ kind: "callback" | "app" | "landing" }` — the same technique `resolveCalibrateMode` uses to make a Server Component's load-bearing decision directly testable — plus two narrow Playwright checks and two smoke tests.

---

## §12 — Testing strategy (Principle VII)

Weighted to **database-level and server-level proof plus unit tests and a human smoke**, not e2e. This repository has a documented history of green e2e masking real defects on exactly this class of behaviour — cross-session, cross-tab, async timing — and re-consent is precisely that class. e2e is used only where a real browser is genuinely required.

### §12.1 The four layers

| Layer | Mechanism | Runs in |
|---|---|---|
| **Database** | Static parse of the migration SQL — `apps/api/tests/test_consent_privacy.py`, mirroring `test_privacy.py` / `test_chat_storage_rls.py` / `test_questionnaire_privacy.py`. No live DB, fully CI-runnable, because **the privacy boundary is the schema/RLS/grant shape**. | `python` job |
| **Server / pure** | Vitest over `lib/consent/{registry,evaluate}.ts`, `lib/landing/story-script.ts`, `lib/bands.ts`, `resolveRootRoute`, both copy modules, and the wordmark sync contract. | `web` job |
| **Component** | Vitest + RTL for the gate surfaces, the story card's state machine, and the team section's a11y. | `web` job |
| **Layout** | `playwright.layout.config.ts` — real browser, real layout, **no database**, chromium only. | local / manual |

Plus a **live psql RLS probe** (the repo's documented `SET LOCAL ROLE` + `set_config('request.jwt.claims', …, true)` per-transaction impersonation) run by hand against local Supabase, and the human smoke pass.

### §12.2 How each required proof is obtained

**"Declining or abandoning a gate creates no consent record."**
- *DB*: the static gate asserts `decision`'s CHECK enumerates exactly `('granted')`; that no `INSERT INTO public.user_consents` appears in the migration **outside the `handle_new_user()` function body**, and that no `INSERT … SELECT` sources `auth.users` or `public.profiles` (no backfill); and that the only INSERT policy is the owner-self one. The one INSERT that does appear — inside `handle_new_user()` ([`data-model.md`](./data-model.md) §6.6) — fires only on auth-user creation and is therefore structurally incapable of writing a row for a user who already exists, so it satisfies FR-041 rather than violating it.
- *Server*: unit tests over the consent-write action with an injected fake writer — the decline path returns having made **zero** write calls; the abandon path never invokes the action at all, so zero is trivially provable.
- *Component*: RTL tests asserting the gate's decline control calls no writer and leaves the surface presentable again.

**"A material revision re-prompts 100% of users whose consent predates it; a cosmetic revision re-prompts zero."**
- *Server, exhaustive*: a table-driven Vitest suite over `bindingRevision()` and `satisfiesConsent()` with fixture registries covering every shape — first-ever revision; material after material; cosmetic after material; several cosmetics after one material; material after cosmetic — crossed with every held-version case (none, the binding one, one before, one after, an unknown id). Each cell asserts the boolean. No users, no database, no timing — which is exactly why it can be exhaustive where an e2e suite cannot.
- *Component*: the shell gate and camera gate rendered against a stubbed registry, asserting blocked/not-blocked matches the evaluator.

**"Every consent record identifies both when it was given and which wording was shown."**
- *DB*: `decided_at` NOT NULL; `document_version` NOT NULL with both CHECKs (format, and prefix equals `consent_key`) — asserted by the static gate.
- *Server*: every write path is asserted to pass a version id resolved from the registry, never one taken from the request. Plus the reconciliation test of §6.3.

**"Declining modifies zero prior records, deletes zero readings or sessions, and writes zero withdrawal or revocation state."**
- *DB*: the static gate asserts the immutability trigger exists on `BEFORE UPDATE`; that no `UPDATE` or `DELETE` policy or grant exists on `user_consents`; that the migration contains no `DELETE FROM`/`UPDATE` touching `window_readings` or `monitoring_sessions` and never alters or triggers on them; and that no column or CHECK value expressing withdrawal or revocation exists.
- *Live probe*: as an `authenticated` user, `UPDATE` own row → `42501`; `DELETE` own row → 0 rows / permission denied; `SELECT` another user's row → 0 rows.

**"A user who declined the camera consent can still complete the weekly work-environment check-in."**
- *Component*: `/app`'s questionnaire path rendered for a user with **no** `camera_inference` record; the weekly work-environment card renders and submits normally.
- *Static*: an import-graph assertion that no module under `lib/questionnaire/` or `components/questionnaire/` imports anything from `lib/consent/` — the two are structurally unable to interact.

**"The hero card's outer dimensions vary by zero pixels across a full story cycle at every supported width."**
- *Layout*: `tests/layout/landing-hero-stability.spec.ts` under `playwright.layout.config.ts` (no database needed — the landing page is unauthenticated). At **320, 375, 414, 768 px**: record the card's `getBoundingClientRect()`, step through **all 17 beats** via the chapter markers plus clock advance, and after each beat assert `width` and `height` deltas are **exactly 0**, and that `scrollWidth === clientWidth` and `scrollHeight === clientHeight` on both the card and the swap area (no internal scrolling). Also asserts the document has no horizontal overflow at each width (SC-008).
- *Layout, narration no-wrap (§10.3 Position 3 constraint)*: in the same spec, at **320 px**, assert the narration element renders on **one line** for **every** beat — computed as `Math.round(el.scrollHeight / parseFloat(getComputedStyle(el).lineHeight)) === 1`. The fixed-height narration line (FR-009) has no room for a second line, so a wrap either clips or forces the fixed height up; the approved closing beat (§10.3 Position 3) is the longest narration string and therefore the binding case. Failing this is a copy-length problem, not a CSS problem — it means the string, not the layout, must change, and that requires re-approval.
- *Unit*: exactly one panel carries `data-active` at every beat index; the thread never exceeds 4; the closing beat's narration string matches the approved constant character-for-character, with its two clauses in the approved order (chat clause first — reversing them would make the line false, §10.3).

**"Both root-route behaviours survive the landing page takeover."**
- *Server*: `resolveRootRoute` unit table — `{code:"abc"} → callback` (including when signed in), `{signedIn:true} → app`, `{} → landing`.
- *e2e (narrow)*: two checks appended to the existing auth specs — a signed-in employee visiting `/` lands on `/app`; `/?code=test` redirects to `/auth/callback?code=test`.
- *Smoke*: a **real** Supabase confirmation and recovery email, clicked on a real device (ST-8).

**Story invariants (SC-002, SC-011).** Unit tests over `story-script.ts`: exactly 17 beats; exactly 6 chapters; total duration ≈42 s; the chapter containing the resolved false alarm has a **lower index** than the chapter containing the first companion beat (the thesis, asserted as an invariant); the panel set is exactly the four named panels; every band label used is a member of `BAND_LABEL`'s three values and nothing else.

**Copy invariants (SC-004, SC-005).** As §10.1 and §9.3: zero forbidden-claim matches with the mock's three literals as negative fixtures; every `MANAGER_VISIBILITY_PASSAGES` member carries its own not-yet-live marker; zero numeric quality metrics (a digit adjacent to F1 / AUC / ROC / recall / accuracy / precision / `%`) across both copy modules; "subject-disjoint" present without numbers.

**Accessibility (SC-009).** RTL tests: every interactive element on the public surface is reachable and has an accessible name; the team section exposes eight distinctly-named links and zero `href="#"`; chapter markers expose `aria-current`; activating a name card sets `aria-pressed` and the highlight persists without hover.

### §12.3 What is deliberately **not** e2e

Re-consent across a published revision, the decline-writes-nothing guarantee, and the material/cosmetic distinction are **not** driven through Playwright. Reproducing "publish a revision, then observe 100% of pre-existing users re-prompted" in a browser suite means seeding users, mutating a module between runs, and racing session state — the exact conditions under which this repo's e2e has gone green while the behaviour was broken. The evaluator is pure and the storage rules are schema-shaped, so both are provable at a layer that cannot lie about timing. The browser's job is the human smoke pass.

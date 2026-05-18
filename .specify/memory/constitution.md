<!--
SYNC IMPACT REPORT
==================
Version change: (initial) → 1.0.0
Bump rationale: First ratification of the Serenify constitution. No prior
version exists; therefore this is a MAJOR-equivalent initial publication.

Principles defined (10):
  I.    Privacy by Architecture (NON-NEGOTIABLE)
  II.   Subject-Disjoint ML Evaluation (NON-NEGOTIABLE)
  III.  Modality Isolation
  IV.   LLM Provider Abstraction
  V.    Calm-First Design Language
  VI.   Responsive & Accessible by Default
  VII.  Mandatory Testing Per PR
  VIII. Spec-Driven Workflow
  IX.   Secrets Discipline (NON-NEGOTIABLE)
  X.    Dataset Stewardship (NON-NEGOTIABLE)

Sections added:
  - Technology Stack (Locked)
  - Architecture Constraints
  - Development Workflow & Quality Gates
  - Governance

Sections removed: none (no prior file content).

Template alignment audit:
  ✅ .specify/templates/plan-template.md — "Constitution Check" is a generic
     gate; the per-feature plan will reference these principles by number.
     No structural change required.
  ✅ .specify/templates/spec-template.md — generic; no constitution-specific
     placeholders to update.
  ✅ .specify/templates/tasks-template.md — generic; testing tasks expected
     to enforce Principle VII when /speckit-tasks runs.
  ⚠ docs/DECISIONS.md, docs/PROGRESS.md, docs/CHANGELOG.md, docs/MODELS.md
     — referenced by this constitution but not yet created. To be authored
     during feature 001 setup.
  ⚠ CLAUDE.md — exists; verify it does not contradict Principle V/VI
     visual or voice guidance during the next /speckit-plan cycle.

Deferred TODOs: none. All placeholders concretely filled.
-->

# Serenify Constitution

Serenify is a multi-modal workplace stress detection web platform built as a
graduation project by Fatma Al-Zahraa Emad, Gehad Mohamed, Hebatullah El
Gazoly, and Mohamed Assem (dashboard lead) at the domain `serenify.tech`. It
is trained and demonstrated on the StressID dataset (Inria + EURECOM,
NeurIPS 2023 Datasets & Benchmarks Track) under a non-commercial academic
license — research and demonstration only.

This document is the project rulebook. Every pull request, feature spec,
plan, task list, and design artifact MUST comply. Violations are blocking.
Conflicts between this constitution and any other document are resolved in
favor of the constitution unless an amendment is logged per the Governance
section.

## Core Principles

### I. Privacy by Architecture (NON-NEGOTIABLE)

Privacy is engineered into the data flow, not bolted on by policy. The
following invariants MUST hold at all times:

- Raw video frames, raw audio waveforms, and raw physiological waveforms
  (rPPG-derived or sensor-derived) MUST NEVER leave the device or backend
  inference layer to reach the manager-facing layer. Managers see only
  graded stress levels, aggregates, and trends derived downstream of model
  inference.
- Per-individual stress trends ARE visible to a direct manager. This is an
  intentional product decision aligned with Serenify's "be heard and felt"
  philosophy — not a surveillance tool. Employees control granularity via a
  three-position privacy slider: `full detail` / `summary only` (DEFAULT) /
  `off during specified hours`.
- Every employee MUST have access to a "this is what your manager sees right
  now" transparency view from their settings page, rendering the exact data
  visible to their direct manager.
- An opt-in "I'd like to talk" button MUST surface a discreet check-in flag
  to the direct manager. It MUST NOT reveal what triggered the request.
- Manager hierarchy: a direct manager sees their direct reports only.
  Skip-level managers and above see only aggregated org-wide data and MUST
  NEVER see individual employees.
- The 12 StressID subjects who withheld image-diffusion consent — subject
  IDs `dmbd, 45lx, cxj0, 5f7t, y9z6, u3v9, 7m3c, x1q3, 9j3o, c3m7, a1k9,
  h8s1` — MUST NEVER have their video frames surfaced in any public-facing
  demo, screenshot, screencast, thesis figure, marketing site, or
  documentation.

**Rationale**: Workplace stress monitoring is a high-trust domain. Any
ambiguity about what leaves the device, what a manager sees, or what a
subject consented to is unacceptable. These rules are architectural, not
configurable.

### II. Subject-Disjoint ML Evaluation (NON-NEGOTIABLE)

Reported model metrics MUST come from subject-disjoint splits keyed on
subject ID — `LeaveOneGroupOut` (LOSO) or `GroupKFold`. Random
record-level splits are forbidden for any reported number.

Additional ML rules:

- Per-subject baseline normalization is REQUIRED for physiological features:
  every subject's feature vectors MUST be centered against that subject's
  Baseline/Relax recording before training or evaluation.
- Per-user calibration is REQUIRED at runtime. Every user completes a
  ~90-second calm baseline on first login. All predictions delivered to the
  app MUST be deltas from that baseline, not absolute thresholds. Calibration
  data lives in the user's Supabase row.
- Inference at deployment time MUST use rolling 30-second windows with a
  10-second stride for the video (rPPG) pipeline. 30s is the physiological
  minimum for meaningful HRV from rPPG; shorter windows are unreliable.
- Pre-trained model artifacts MUST live in `packages/ml-*/models/` and MUST
  have a versioned entry in `docs/MODELS.md` recording: model name, training
  date, evaluation method, macro-F1, per-class recall, confusion matrix
  link, and dataset version. Models without a `docs/MODELS.md` entry MUST
  NOT be loaded in production.

**Rationale**: StressID is small and subject-correlated. Random splits leak
identity and inflate metrics, producing models that fail on unseen users.
Per-subject normalization and per-user calibration absorb between-subject
variance and let the system generalize beyond the dataset.

### III. Modality Isolation

Each input modality is isolated into its own package, behind a common
inference interface:

- `packages/ml-video/` — webcam + rPPG pipeline
- `packages/ml-audio/` — vocal stress features
- `packages/ml-physio/` — direct sensor signals (HR, EDA, etc.)

Each package MUST expose the same inference contract (input shape, output
schema, confidence/quality signal). Adding a new modality MUST be a config
change in the inference service plus a new package — never a rewrite of
shared code. Cross-modality fusion lives in a separate fusion layer (see
feature 015) and consumes the common interface only.

**Rationale**: Modalities arrive at different times (video first, then
audio, then physio, then fusion). Coupling them would force every modality
addition to thrash the inference service. Isolation also makes per-modality
testing tractable.

### IV. LLM Provider Abstraction

All LLM access MUST go through a single `LLMProvider` adapter interface in
`packages/llm-client/`. Application code MUST NEVER import a vendor SDK
directly.

- Primary provider: Groq (Llama-3.3-70B) via API.
- Fallback provider: local LM Studio (Gemma-3-4B or similar small open
  model) exposed via Cloudflare Tunnel.
- Provider selection MUST be controllable by config — swapping providers
  MUST NOT require code changes outside `packages/llm-client/`.
- All prompts MUST live as versioned files in
  `packages/llm-client/prompts/`. Inline prompt strings in application code
  are a constitutional violation.
- The chatbot MUST implement dual-mode stress detection: a cheap per-message
  stress-score prompt (every turn) and a session-level rollup prompt (every
  N turns) that reconciles with the physiological signal stream.

**Fine-tuning clause (open decision, must close before audio modality lands
in feature 013):** Default is prompting-only. If the team chooses to
fine-tune later, the fine-tuned model MUST (a) be served behind the same
`LLMProvider` interface so app code does not change, (b) be evaluated on a
documented held-out set with metrics published in `docs/MODELS.md`, and
(c) NEVER be trained on real Serenify user data — only public or synthetic
data is permissible. The open decision MUST be logged in
`docs/DECISIONS.md` until resolved.

**Rationale**: Provider lock-in and prompt sprawl are the two failure modes
for LLM-driven products. The adapter and versioned prompt directory
neutralize both. The training-data restriction protects user trust.

### V. Calm-First Design Language

Serenify's surface MUST feel calm. Calm is enforced by these
non-negotiable rules:

**Palette — "Mist & Meadow"** (locked; no additions without amendment):
- Light: bg `#ECEEE9`, surface `#F5F6F2`, ink `#1F2522`, muted `#6E7572`,
  meadow accent `#7A9275`, foggy accent `#8AA9B6`, amber `#DCB587`, border
  `#D6D7D1`.
- Dark: bg `#161917`, surface `#20231F`, text `#DCDED5`, muted `#8B928F`,
  meadow accent `#97AE91`, foggy accent `#9CBBC7`, amber `#DCB587`, border
  `#2D3130`.
- **Red is forbidden anywhere in the UI.** Stress signals use amber
  (`#DCB587`) in both modes. The colors `red`, `#FF0000` family, and any
  hue in the 340–20° red sector MUST NOT appear in stress states, errors,
  charts, or icons.

**Visual finish**:
- Flat base. Optional 3–5% paper-noise texture on the page background ONLY,
  toggled via a `--texture-opacity` CSS variable.
- No glassmorphism anywhere — not in cards, modals, navs, or overlays.
- Elevation MUST use 0.5px borders and a soft `0 1px 2px rgba(0,0,0,0.04)`
  shadow. Aggressive lifts and large drop shadows are forbidden.
- Corner radii are 8–16px. Sharp corners (≤4px) are forbidden on
  interactive surfaces.
- Whitespace is generous; cramming is a violation. White space signals
  calm.

**Typography**: Inter for all UI text. DM Serif Display is reserved for
hero/display moments and MUST be used sparingly — not for body, buttons,
labels, or chart text.

**Iconography**: Lucide library only. Stroke weight MUST be consistent
across the surface.

**Voice & copy**:
- Calm, not perky. No exclamation marks in default copy.
- Never alarmist. Prefer "noticed something" over "detected". Avoid
  clinical or warning language ("alert", "abnormal", "elevated risk").
- First-person plural is acceptable occasionally ("we're seeing this
  trend") — Serenify is a partner, not a surveillance system.
- Never moralize. Suggest, don't prescribe. ("Want to take a break?" not
  "You should take a break.")

**Rationale**: A stress-detection product that looks or sounds alarming is
self-defeating. The palette and voice are the product's primary
intervention — they must not betray the goal.

### VI. Responsive & Accessible by Default

Every screen MUST function correctly at 360px minimum viewport width and
adapt cleanly up to desktop. Mobile-first responsive design is required.

- Touch targets MUST be ≥ 44×44px on touch-capable viewports.
- Both light and dark modes are equal-priority. They MUST be designed in
  tandem — no "we'll add dark mode later" shortcuts.
- `prefers-color-scheme` MUST be respected by default, with a manual
  override available to the user.
- `prefers-reduced-motion` MUST be respected. Framer Motion is permitted
  but only when motion is subtle and opt-out is wired. Heavy parallax,
  large translate animations, and auto-playing motion are forbidden.

**Rationale**: Employees access wellness tools across phones and desktops,
in offices and at home. Excluding mobile or motion-sensitive users is
inconsistent with the brand stance of "be heard and felt."

### VII. Mandatory Testing Per PR

Every PR MUST ship with tests appropriate to the layer it touches. Merges
without passing tests are forbidden.

- **Backend**: pytest for FastAPI routes and ML pipeline functions. Target
  coverage ≥ 70% on business logic (router handlers, pipeline transforms,
  service modules). UI glue and boilerplate are exempt from the 70% floor
  but MUST still have at least one happy-path test where they exist.
- **Frontend**: Vitest + React Testing Library for component logic.
  Playwright provides one end-to-end happy-path test per role (`employee`,
  `team_lead`, `admin`). These three Playwright tests are part of the CI
  gate.
- **ML packages**: pytest with locked fixture-based regression tests on
  representative StressID feature vectors. The fixtures MUST catch
  preprocessing regressions (e.g., a baseline-normalization bug would
  change the fixture output and fail the test).
- **Smoke tests**: every feature MUST ship with a `smoke-tests.md` in its
  `specs/NNN-feature-slug/` folder listing human-validated checks
  (e.g., webcam permission flow on Safari, low-light signal quality,
  mobile viewport behavior). Mohamed runs these manually after
  `/speckit.implement` completes; results MUST be recorded in the file.

**Rationale**: ML systems with multi-stage preprocessing fail silently in
ways that unit tests miss. Fixture-locked regression tests, role-scoped
e2e, and human smoke tests together catch the failure modes that any one
layer alone would miss.

### VIII. Spec-Driven Workflow

Serenify is built with SpecKit. Work proceeds spec → plan → tasks →
implement, in that order. Implementation without a spec is forbidden.

- Each feature lives in `specs/NNN-feature-slug/` and MUST contain
  `spec.md`, `plan.md`, `tasks.md`, and `smoke-tests.md`.
- Decisions are logged append-only in `docs/DECISIONS.md`. Decisions are
  never deleted; reversals are appended as new entries that reference the
  original.
- Progress is tracked in `docs/PROGRESS.md`.
- Spec amendments (deviations from an approved spec discovered during
  implementation) are logged in `docs/CHANGELOG.md`, since SpecKit itself
  has no formal amendment mechanism.
- Claude Code MAY commit and push its own work directly to feature
  branches. Mohamed reviews PRs/commits before merging branches to `main`.
- Provisional feature ordering (subject to change; record changes in
  `docs/CHANGELOG.md`):
  `001-auth-and-roles`, `002-demo-seed-data`,
  `003-employee-dashboard-shell`, `004-webcam-and-rppg`,
  `005-per-user-calibration`, `006-stress-inference-service`,
  `007-questionnaire`, `008-llm-client-and-chatbot`,
  `009-recommendations`, `010-privacy-controls-and-transparency`,
  `011-team-lead-dashboard`, `012-admin-dashboard`,
  `013-audio-modality`, `014-physio-modality`, `015-fusion`.

**Rationale**: A four-person team building an ML product needs a single
source of truth per feature. Spec-driven development makes scope explicit,
makes decisions auditable, and prevents the "what were we building again?"
failure that kills graduation projects.

### IX. Secrets Discipline (NON-NEGOTIABLE)

Secrets MUST NEVER appear in the repository.

- `.env.local`, `.env.production`, and any `*.env` file MUST be gitignored.
- Production secrets are set in the Vercel, DigitalOcean, and Supabase
  environment-variable panels — never in code, never in committed config,
  never in CI workflow YAML in plaintext.
- Hardcoded API keys, hostnames pointing at private services, database
  connection strings, JWT signing secrets, or LLM API tokens in any
  committed file are a constitutional violation. Review MUST block the
  merge and the secret MUST be rotated immediately.
- Mohamed's personal secrets reference file at
  `C:\Users\moham\secrets\serenify.txt` is reference-only and MUST NEVER
  be pasted into the repository, into commits, into PR descriptions, into
  issue comments, or into any committed documentation. Claude Code MUST
  NOT read from or echo this file into any committed artifact.

**Rationale**: Leaked credentials are the highest-impact, hardest-to-undo
mistake in a public graduation-project repo. Treating any secret in a
diff as a hard block — not a warning — is the only reliable defense.

### X. Dataset Stewardship (NON-NEGOTIABLE)

The StressID dataset is licensed for non-commercial academic use only.

- No Serenify-derived product feature may be commercialized while it uses
  StressID data, directly or indirectly (including fine-tuned weights and
  derived statistics).
- The 12 subjects who withheld image-diffusion consent (listed in
  Principle I) MUST NEVER appear in public-facing artifacts of any kind:
  screenshots, screencasts, thesis figures, posters, presentations,
  marketing pages, social posts, or external documentation. This applies
  to derived visualizations too (e.g., a face-keypoint overlay over one of
  their frames).
- Demo accounts in the application MUST use synthetic names. The real
  teammate names (Fatma, Gehad, Hebatullah, Mohamed) are reserved for the
  public "About / Team" page only and MUST NOT be used as demo employees,
  test fixtures, or sample manager rows.

**Rationale**: A signed academic license is a real obligation. Violating
consent terms — even unintentionally, on a single thesis figure — is the
kind of mistake that ends academic careers and reputations.

## Technology Stack (Locked)

The following stack is locked. Any substitution requires a constitutional
amendment (see Governance) and a decision entry in `docs/DECISIONS.md`.

| Layer                | Technology                                                |
|----------------------|-----------------------------------------------------------|
| Frontend             | Next.js 16 (App Router; `proxy.ts` replaces `middleware.ts`) on Vercel |
| Backend + ML serving | FastAPI on a DigitalOcean Droplet                         |
| Database / Auth / Storage / Realtime | Supabase (Postgres-based)                  |
| Primary LLM          | Groq — Llama-3.3-70B via API                              |
| Fallback LLM         | Local LM Studio (Gemma-3-4B or similar) via Cloudflare Tunnel |
| Transactional email  | Resend (production); Supabase email until Resend domain verified |
| DNS / CDN / Tunnel   | Cloudflare (free tier)                                    |
| Error tracking       | Sentry                                                    |
| Product analytics    | PostHog Cloud                                             |
| CI/CD                | GitHub Actions                                            |
| Component library    | shadcn/ui (install deferred until feature 003 per `docs/DECISIONS.md`) |
| Styling              | Tailwind CSS v4                                           |
| Icons                | Lucide                                                    |
| Charts               | Recharts                                                  |
| Animation            | Framer Motion (sparingly, `prefers-reduced-motion` respected) |
| Type system (FE)     | TypeScript strict mode                                    |
| Type system (BE)     | Python type hints + Pydantic                              |

TypeScript strict mode and Python type hints are mandatory across all
application code. `any` (TS) and untyped `Any`/`dict` (Python) MUST be
justified in code review if introduced.

## Architecture Constraints

**Repository structure (target):**

```text
serenify/
├── .specify/memory/constitution.md
├── specs/NNN-feature-slug/{spec.md, plan.md, tasks.md, smoke-tests.md}
├── docs/{DECISIONS.md, PROGRESS.md, CHANGELOG.md, MODELS.md}
├── CLAUDE.md
├── apps/web/                    # Next.js frontend
├── apps/api/                    # FastAPI backend
└── packages/{ml-video, ml-audio, ml-physio, llm-client}
```

Deviations from this layout require a decision entry in
`docs/DECISIONS.md`.

**Transport rules:**

- Frontend talks to backend via a typed API client. Untyped `fetch` calls
  in application code are forbidden.
- Real-time prediction streams and live signal-quality indicators travel
  over WebSockets, not polling.

**Boundary rule:**

- Raw signal data (frames, audio buffers, raw waveforms) MUST stay within
  the backend inference layer. Any module outside `apps/api/` and
  `packages/ml-*` that touches a raw signal type is a constitutional
  violation and MUST be flagged in review.

## Development Workflow & Quality Gates

The following gates MUST pass before a feature branch may be merged to
`main`:

1. **Spec gate** — `spec.md`, `plan.md`, `tasks.md`, and `smoke-tests.md`
   all exist in `specs/NNN-feature-slug/` and are populated (no
   placeholder bracket tokens remain).
2. **Constitution Check** — the plan's Constitution Check section
   explicitly addresses each affected principle. Violations require a
   `Complexity Tracking` entry justifying them.
3. **Test gate** — backend (pytest), frontend (Vitest + RTL), Playwright
   role e2e (where touched), and ML fixture tests all pass in CI.
4. **Secrets scan** — no new `*.env*` files, no hardcoded keys, no
   pointers to private services in committed code (Principle IX).
5. **Smoke test gate** — Mohamed has signed off on `smoke-tests.md` for
   the feature, with results recorded in the file.
6. **Privacy review** — for any feature touching signal capture, signal
   transport, manager-facing views, or aggregation: an explicit note in
   `plan.md` confirming Principle I invariants hold.
7. **Mohamed's review** — Claude Code may push to feature branches;
   Mohamed reviews and approves the merge to `main`.

## Governance

This constitution supersedes all other practices, conventions, and
preferences in the repository. Where `CLAUDE.md`, agent-specific guides,
or informal team conventions conflict with this document, the constitution
wins.

**Amendments:**

- Any team member may propose an amendment by opening a PR that modifies
  `.specify/memory/constitution.md` and adds an entry to
  `docs/DECISIONS.md` describing the change and rationale.
- Amendments require approval from Mohamed (project lead).
- The amendment PR MUST update the version line at the bottom of this
  file per semantic versioning:
  - **MAJOR** — removal or backward-incompatible redefinition of a
    principle, or removal of a numbered section.
  - **MINOR** — addition of a new principle or section, or materially
    expanded guidance.
  - **PATCH** — clarifications, wording, typos, non-semantic refinements.
- The Sync Impact Report HTML comment at the top of this file MUST be
  updated to reflect the change.
- Any templates referencing changed content MUST be updated in the same
  PR, or explicitly listed as deferred in the Sync Impact Report.

**Compliance review:**

- Every PR description SHOULD reference any principle it materially
  intersects with (e.g., "Touches Principles I, V, VII").
- Mohamed performs a final compliance read before merging to `main`.
- Quarterly (every ~3 months while the project is active) a brief
  retro entry in `docs/PROGRESS.md` confirms the constitution is still
  reflecting reality. Drift discovered in retro MUST be resolved via
  amendment, not silence.

**Authority of this document:**

- This file is the rulebook that gates every future PR.
- Claude Code, all human contributors, and any automated tooling MUST
  treat the principles above as binding. Where a principle is marked
  NON-NEGOTIABLE, even a unanimous team override requires a logged
  amendment first — the rule must change in writing before behavior may.

**Version**: 1.0.0 | **Ratified**: 2026-05-16 | **Last Amended**: 2026-05-16

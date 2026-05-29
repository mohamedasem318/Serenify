# Phase 0 Research: Onboarding Video Anchor Flow

Long-form treatment of the plan's 📌 DECISION-1 … 📌 DECISION-18. Each entry
follows **Decision / Rationale / Alternatives considered**. The headline table
is at the end.

---

## R-1 — Backend runtime: Python 3.12 (📌 DECISION-1)

**Decision**: Pin `apps/api/` to Python 3.12.

**Rationale**: The trained artifact pins `mediapipe==0.10.13`
(`metadata.json.dependencies`). That release publishes manylinux/macOS/Windows
wheels for CPython 3.10–3.12 only; there is no 3.13 wheel and a source build is
not viable on a 2GB droplet. 3.12 is the newest supported, maximizing the
runtime's supported life.

**Alternatives**: 3.11 (works, but leaves a version of headroom on the table);
3.13 (rejected — no mediapipe wheel); unpinned (rejected — non-reproducible,
Principle II).

## R-2 — Dependency manifest: `pyproject.toml` + `uv` (📌 DECISION-2/3)

**Decision**: `pyproject.toml` (PEP 621) with `uv` managing the venv and a
committed `uv.lock`. ML deps pinned exactly to `metadata.json` values.

**Rationale**: `uv.lock` is hash-locked and transitive-complete, so the droplet
and the dev machine resolve identically — the reproducibility Principle II
implies for model artifacts extends to the runtime that loads them. `uv` is one
fast tool for venv+install+lock. scikit-learn is the load-bearing pin: joblib
unpickling is sensitive to the sklearn major.minor (`MODEL_HANDOFF.md` §7).

**Alternatives**: `requirements.txt` + manual exact pins (works and is
universally understood, but no transitive lock/hashes; rejected for weaker
reproducibility); `pip-tools` (rejected — two-step compile/sync and no venv
management; `uv` subsumes it); Poetry (heavier, slower resolver).

## R-3 — `apps/api/` shape & `packages/ml-video/` install (📌 DECISION-4/5)

**Decision**: Thin FastAPI app (routers + auth + config + schemas) that imports
all extraction logic from an editable-installed `packages/ml-video/` package
(`import ml_video`).

**Rationale**: Constitution Principle III mandates the pipeline live in
`packages/ml-video/`; the API is a transport shell. Editable install gives a
stable import name, isolated deps, package-local tests, and a clean Docker
`COPY` + `install`. `compute_anchor(path)` is the only function the 004 endpoint
needs; `load_model()` returns a `Predictor` whose predict path stays unexposed
until 005.

**Alternatives**: extraction inline in the router (rejected — violates Principle
III, untestable in isolation); `PYTHONPATH` sibling import (rejected — implicit,
Docker-hostile, couples CWD to repo layout); a single merged package (rejected —
conflates transport with modality logic).

## R-4 — Local-only service; deploy deferred (📌 DECISION-7)

**Decision**: 004 ships a locally-runnable service + a pinned `Dockerfile`; no
droplet deploy.

**Rationale**: The spec requires only a working local backend the web app can
call against. A full deploy (droplet provisioning, systemd/Docker on the box,
CORS/TLS, CI publish) is a separate ops concern that would balloon 004. The
Dockerfile de-risks the later deploy without doing it now.

**Alternatives**: full droplet deploy in 004 (rejected — out of spec scope,
large surface); no Dockerfile at all (rejected — leaves the later deploy a
from-scratch design).

## R-5 — Privacy storage & the column-grant problem (📌 DECISION-12) — the crux

**Decision**: `anchor_vector BYTEA`, `anchor_captured_at TIMESTAMPTZ`,
`anchor_model_version TEXT` on `public.profiles`, all nullable, no CHECK. Convert
`authenticated`'s table-level SELECT into an explicit **column whitelist that
excludes all three anchor columns**; expose calibration status only through a
scope-guarded `has_anchor()` SECURITY DEFINER function; widen the UPDATE
whitelist to the three anchor columns; leave the RLS policies untouched.

**Rationale**: This is the load-bearing Principle I decision. Postgres RLS is
**row**-scoped; the existing `profiles_select_admin` and
`profiles_select_direct_reports` policies grant managers SELECT on *whole rows*
of other users. Adding `anchor_vector` to the row would expose the biometric
vector to managers. A column-level `REVOKE SELECT (anchor_vector)` is a **no-op**
while `authenticated` holds the table-level SELECT grant — exactly the gotcha
security-slice-1 documented for column UPDATE (verified there with
`has_column_privilege`; see `docs/DECISIONS.md` 2026-05-25 and the
pg-column-revoke memory). The only mechanism that actually blocks the column is
to drop the table SELECT and re-grant a whitelist. Excluding all three anchor
columns from that whitelist makes them unreadable by *every* client role (owner,
team_lead, admin) — they become write-only from PostgREST in 004, and Principle I
holds structurally rather than by policy convention. `BYTEA` (float32) is the
compact, lossless representation the model contract suggests (`MODEL_HANDOFF.md`
§4, ~12 KB/user); it decodes to a `(2958,)` array for the 005 rolling-window
loop without issue.

**Why all three columns are excluded (stricter posture, chosen 2026-05-27)**:
an earlier draft left `anchor_captured_at` + `anchor_model_version` readable,
reasoning FR-019 scopes the invariant to the *vector*. Mohamed elected the
stricter posture — a manager knowing whether/when a report calibrated could be
used to pressure them ("why haven't you set up the app yet?"), undercutting the
Principle I "managers see aggregates, not individuals" trust story. The owner
therefore cannot read `anchor_captured_at` directly either; banner visibility
comes from a self-scoped `has_anchor(target_user)` SECURITY DEFINER function
(`search_path = ''`, `OWNER TO postgres`, scope guard raising if
`target_user <> auth.uid()`, EXECUTE granted only to `authenticated`). One added
SECURITY DEFINER construct for a real, bounded privacy gain. See
`docs/CHANGELOG.md` / `docs/DECISIONS.md` 2026-05-27.

**Alternatives**:
- *Separate `anchor_calibrations` table with owner-only RLS* — cleanest privacy
  model, but the constitution says "calibration data lives in the user's
  Supabase row" and the spec/DDL mandate columns on `profiles`. Rejected on the
  explicit constraint.
- *Column-level REVOKE only* — rejected: no-op under the table grant (the
  slice-1 finding).
- *Rewrite manager/admin SELECT policies to exclude the column* — impossible;
  RLS cannot express column scope.
- *CHECK on byte length* — rejected: app-layer validation is sufficient; a CHECK
  adds DB cost without proportional safety.

## R-6 — `POST /anchor`, JWT, health, formats (📌 DECISION-8/9/10/11)

**Decision**: Single `multipart/form-data` POST returning base64 float32 bytes;
JWT-verified (`SUPABASE_JWT_SECRET`, HS256, `aud=authenticated`); raw bytes
deleted in a `finally`; `GET /healthz` gated on model-loaded; accept MP4+WebM,
else 415.

**Rationale**: The upload is a one-shot request/response — a typed POST is the
right transport (no streaming → no WebSocket). Returning base64 float32 (not a
JSON array) keeps the payload ~16 KB and lossless for the `BYTEA` re-encode. JWT
verification with the shared secret is the standard Supabase pattern and needs no
DB round-trip — which is what lets the backend hold zero DB credentials
(resolved decision 2). Deleting raw bytes unconditionally honors Principle I.
`/healthz` lets the web app fail fast (FR-048). MP4+WebM are exactly the browser
`MediaRecorder` defaults and both decode via OpenCV's FFmpeg backend (FR-047).

**Alternatives**: WebSocket upload (rejected — needless connection lifecycle);
backend writes to Supabase via service-role (rejected by resolved decision 2 —
keeps a service-role key out of the backend, privacy-cleaner); JSON float array
response (rejected — ~6× larger, float-formatting drift); transcoding to a single
format server-side (rejected — unnecessary, adds ffmpeg invocation cost).

## R-7 — Web recorder: boundary, state machine, device/codec/upload (📌 DECISION-13)

**Decision**: Client Component recorder driven by an explicit reducer; device
picker handles the labels-after-grant quirk; `localStorage` device memory;
codec probe; typed multipart client; web writes the vector to Supabase.

**Rationale**: All capture APIs are client-only, so the recorder is a Client
Component behind a thin server role-gate. An explicit state machine makes the
many sub-states (permission denied, retry, 3-fail escape, upload vs extract
failure) tractable and unit-testable. `enumerateDevices()` returning blank labels
pre-grant is a known browser behavior; the "Default camera" placeholder → real
labels after first grant handles it without a confusing empty dropdown. A typed
client satisfies the transport rule. The web doing the DB write (resolved
decision 2) keeps the service credential-free.

**Alternatives**: ad-hoc `useState` flags (rejected — the sub-state matrix is too
large to track safely); server-action upload proxy (rejected — would route raw
bytes through `apps/web/`, violating the boundary rule; the bytes must go
straight to `apps/api/`); forcing one codec (rejected — breaks a browser family).

## R-8 — Banner, `/app/calibrate`, onboarding integration (📌 DECISION-14)

**Decision**: `sessionStorage`-dismissed banner on `/app`; a dedicated
employee-only `/app/calibrate` route reusing the recorder; onboarding renders the
anchor step as in-page client state (employee `completeOnboarding` returns ok
instead of redirecting).

**Rationale**: `sessionStorage` encodes "this session only" precisely (clears on
tab close), matching FR-023/024 without a localStorage eviction scheme. A
dedicated route (vs modal) is linkable, refreshable, and reuses the recorder
verbatim (resolved decision 8). The onboarding integration is shaped by `proxy.ts`
step 5: once `full_name` is set, `/onboarding` bounces to `/app`, so the anchor
step must be in-page state after the name save rather than a new navigation — and
a refresh degrades gracefully to the banner.

**Alternatives**: modal/sheet on `/app` (rejected by resolved decision 8 — not
linkable/refreshable); redirect to `/onboarding` for recalibration (rejected —
proxy bounces it); `localStorage` dismissal until completion (rejected by
resolved decision 4 — session-only is the chosen behavior); relaxing the proxy
onboarding gate to keep `/onboarding` open post-name (rejected — more proxy
surface than the in-page approach, and skip-state isn't DB-derivable).

## R-9 — Cross-tab anchor broadcast (📌 DECISION-15)

**Decision**: Extend `apps/web/lib/auth-broadcast.ts` with a
`serenify-anchor-captured` marker; the existing `cross-tab-auth.tsx` listener
`router.refresh()`es sibling tabs on the onboarding step / `/app/calibrate`.

**Rationale**: FR-035 says reuse the feature-003 pattern. That file is already
the single source of truth for cross-tab markers and the listener already
subscribes to `window "storage"`; a sibling helper + one listener branch is
strictly additive. `router.refresh()` (not hard navigate) lets the server
components recompute `has_anchor(auth.uid())` and naturally fall through to
`/app` without the step/banner — matching how 003 handled propagation.

**Alternatives**: a parallel `BroadcastChannel` (rejected — FR-035 says reuse;
two mechanisms invite drift); hard `router.push("/app")` (rejected — bypasses the
server recompute the refresh gives for free).

## R-10 — Security headers (📌 DECISION-16)

**Decision**: Per-route `camera=(self)` for `/onboarding` + `/app/calibrate` in
`next.config.ts` (site-wide deny stays); FastAPI origin added to CSP
`connect-src` in `proxy.ts` from `NEXT_PUBLIC_API_URL` (dev
`http://127.0.0.1:8000`); COEP unset.

**Rationale**: Static `Permissions-Policy` lives in `next.config.ts` (per the
slice-5 split documented in `proxy.ts`); Next's `headers()` supports per-`source`
arrays, so the two capture routes get a narrower policy while `/(.*)` keeps
`camera=()`. Microphone stays denied (audio is 013). The CSP is per-request in
`proxy.ts::buildCsp`, so the new origin is added there. COEP stays unset because
MediaPipe runs server-side — no WASM/crossOriginIsolation needed in the browser
(FR-039).

**Alternatives**: relaxing camera site-wide (rejected — violates least-privilege
/ FR-036); a static CSP (rejected — the existing CSP is nonce-bearing and must be
per-request); hardcoding the prod origin (rejected — env-var keeps it
deploy-configurable, `[TBD by deployment]`).

## R-11 — Demo synthetic anchor (📌 DECISION-17)

**Decision**: One shared deterministic anchor (`mulberry32(42)` → 2958 float32 →
11832 LE bytes → `\x…` bytea) injected into every demo profile via the
service-role admin client.

**Rationale**: Deterministic + reproducible (FR-031/032); one anchor for all is
simpler than per-user and equally valid for UI smoke-testing (predictions on demo
users are nonsense by design). service_role bypasses RLS and the `authenticated`
whitelist, so the seed can write the otherwise-unwritable `anchor_vector`. A TS
PRNG keeps generation in the existing TS seed toolchain (no Python in the seed
path).

**Alternatives**: per-demo-user anchors (rejected — more code, no UI benefit);
NumPy generation (rejected — the seed is TypeScript; would add a Python shell-out);
real recorded anchors (rejected — privacy + non-determinism).

## R-12 — Testing strategy (📌 DECISION-18)

**Decision**: pytest with a synthetic no-face clip (failure path) + mocked
FaceMesh (happy path, fixture-locked vector); Playwright with mocked MediaRecorder
+ route-intercepted backend.

**Rationale**: Committing a real face video is privacy-fraught and
non-deterministic; mocking FaceMesh validates the LBP-TOP/motion/concat math and
the endpoint contract deterministically, while the synthetic no-face clip
exercises the real `FeatureExtractionError` path end-to-end. CI cannot spend 60s
recording real video per test, so the Playwright shim stubs capture and the
backend call — the specs assert the *flow*, which is what the e2e layer should
own; the recording mechanics are a smoke-test (human) concern (FR-045).

**Alternatives**: committed real clip (rejected — privacy + flakiness);
shorten-duration env var under test (rejected — changes behavior under test);
60s real recording in CI (rejected — slow, flaky).

---

## Headline outputs

| Topic | Decision | One-line rationale |
|---|---|---|
| Backend Python | 3.12 | mediapipe 0.10.13 has no 3.13 wheel; 3.12 newest supported. |
| Manifest / lock | `pyproject.toml` + `uv.lock` | Hash-locked reproducibility; one tool for venv+install+lock. |
| ML pins | exact from `metadata.json` (sklearn 1.6.1 …) | joblib load is sklearn-version-sensitive. |
| API shape | thin FastAPI; logic in `packages/ml-video/` | Principle III; testable in isolation. |
| ml-video install | editable package (`import ml_video`) | Stable import, Docker-clean, own deps/tests. |
| Deploy | local-only in 004; Dockerfile forward artifact | Spec needs only a local service; deploy is a separate ops task. |
| Anchor storage | `BYTEA` float32, nullable, no CHECK | Compact/lossless; app-layer validation; 005-compatible. |
| **Anchor privacy** | **SELECT column-whitelist excludes all three anchor columns; `has_anchor()` boolean for status** | Column REVOKE is a no-op under a table grant; whitelist is the only mechanism that blocks the manager/admin row-SELECT; status via a scope-guarded SECURITY DEFINER fn keeps even the timestamp from managers (Principle I). |
| Endpoint | `POST /anchor` multipart → base64 float32 | One-shot; typed POST, no WebSocket; ~16 KB payload. |
| Auth | JWT (`SUPABASE_JWT_SECRET`, HS256), 401 | No DB round-trip → backend holds zero DB credentials. |
| Health | `GET /healthz` gated on model-loaded | Fail fast before a 60s recording (FR-048). |
| Formats | MP4 + WebM via cv2/FFmpeg, else 415 | Matches MediaRecorder defaults across browsers. |
| Recorder | Client Component + reducer state machine | Capture APIs are client-only; sub-state matrix needs a machine. |
| Banner | `sessionStorage` dismissal; `/app/calibrate` route | Session-only is precise; dedicated route reuses the recorder. |
| Cross-tab | extend `auth-broadcast.ts`; `router.refresh()` | Reuse the 003 pattern (FR-035); refresh recomputes server state. |
| Headers | per-route `camera=(self)`; CSP `connect-src` += API origin; COEP unset | Least-privilege; CSP is per-request in `proxy.ts`; no browser WASM. |
| Demo anchor | one shared `mulberry32(42)` blob via service-role | Deterministic; service-role writes past the whitelist. |
| Tests | mocked FaceMesh (happy) + no-face clip (fail); mocked MediaRecorder (e2e) | Deterministic, privacy-clean, no 60s CI recording. |

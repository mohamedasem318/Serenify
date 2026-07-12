# Serenify Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Serenify's RLS-as-user FastAPI backend at `https://api.serenify.tech` on a cost-controlled 4 vCPU / 8 GiB Azure Container App and ship Graphite-branded Supabase auth emails.

**Architecture:** Keep the existing Supabase Cloud and Next.js boundaries. After local release verification, check Azure student-credit balance and provision a fresh private registry plus Azure Container App with scale-to-zero, then front it with Azure managed TLS and Cloudflare DNS. Keep security, email design, and infrastructure changes in separate commits.

**Tech Stack:** FastAPI, Azure Container Apps, Azure CLI, Cloudflare DNS, Supabase Auth/Postgres RLS, Resend SMTP, HTML email, Vitest, pytest.

## Global Constraints

- No service-role key anywhere in executable repository code or configuration.
- Production data access is RLS-as-user through the caller JWT and publishable/anon key.
- `get_my_anchor()` remains the self-scoped `SECURITY DEFINER` exception.
- The inference server must not use `--reload`.
- Graphite colors and Outfit/Inter roles must match Constitution Principle V in light and dark modes.
- Azure Container App compute must be 4 vCPU / 8 GiB, `minReplicas=0`, `maxReplicas=1`.
- Use only Azure student credit and free Cloudflare, Supabase, Resend, and managed certificate options.
- Do not modify, hide, stash, clean, or commit unrelated user-owned worktree files.

---

### Task 1: Ratify Azure Container Apps

**Files:**
- Modify: `.specify/memory/constitution.md`
- Modify: `docs/DECISIONS.md`

**Interfaces:**
- Consumes: Constitution v1.10.0 Governance amendment rules.
- Produces: Constitution v1.11.0 that authorizes Azure Container Apps and Azure secret panels.

- [ ] **Step 1: Run the mandatory constitution pre-hook**

Run: `& .specify/extensions/git/scripts/powershell/initialize-repo.ps1`

Expected: existing repository is detected and left unchanged.

- [ ] **Step 2: Amend the constitution and sync report**

Add Amendment 14 with the rationale that Azure for Students replaces DigitalOcean for backend
and ML serving. Change the locked stack row to:

```markdown
| Backend + ML serving | FastAPI on Azure Container Apps (Azure for Students)            |
```

Change the production secret-panel list from `Vercel, DigitalOcean, and Supabase` to
`Vercel, Azure, and Supabase`. Set the version line to `1.11.0` and amended date to
`2026-07-12`. Record the same decision append-only in `docs/DECISIONS.md`.

- [ ] **Step 3: Validate the amendment**

Run: `rg -n "DigitalOcean|Backend \+ ML serving|Version" .specify/memory/constitution.md`

Expected: DigitalOcean appears only in historical amendment text; the live stack row says Azure
Container Apps and the version is 1.11.0.

- [ ] **Step 4: Commit**

```powershell
git add .specify/memory/constitution.md docs/DECISIONS.md
git commit -m "docs(constitution): authorize azure container apps"
```

### Task 2: Remove Repository Service-Role Tooling

**Files:**
- Modify: `apps/web/tests/unit/runtime-secret-posture.test.ts`
- Modify or delete: `apps/web/tests/e2e/setup/admin-client.ts`
- Modify: callers under `apps/web/tests/e2e/`
- Modify or delete: `scripts/lib/supabase-admin.ts`
- Modify: callers under `scripts/`
- Modify: `apps/api/tests/test_inference_replay_local.py`

**Interfaces:**
- Consumes: publishable/anon Supabase clients and RLS policies.
- Produces: repository-wide guard preventing service-role or admin-client reintroduction.

- [ ] **Step 1: Expand the failing posture test first**

Update the guard to scan production and executable tooling roots and reject:

```typescript
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "service-role",
  "createAdminClient",
  "supabaseServiceRoleKey",
  ".auth.admin",
];
```

Run: `npm run test -- tests/unit/runtime-secret-posture.test.ts`

Expected: FAIL on the existing e2e, seed, or replay references.

- [ ] **Step 2: Remove or replace privileged tooling**

Delete obsolete admin-only helpers. Where a test still needs a user, create it through the public
signup flow and set up role-owned data through migrations or authenticated fixtures. The replay
harness must accept a user access token and anon key, forwarding the token exactly as production
does.

- [ ] **Step 3: Verify security behavior**

Run: `npm run test -- tests/unit/runtime-secret-posture.test.ts lib/env/schema.test.ts`

Run: `uv run --project apps/api pytest apps/api/tests/test_supabase_user.py apps/api/tests/test_inference_replay_local.py -q`

Expected: all selected tests pass and repository scan returns no executable service-role use.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/tests apps/api/tests scripts
git commit -m "fix(security): remove remaining service-role tooling"
```

### Task 3: Redesign and Preview Auth Emails

**Files:**
- Modify: `apps/web/tests/unit/supabase-email-templates.test.ts`
- Modify: `supabase/templates/confirmation.html`
- Modify: `supabase/templates/recovery.html`
- Create: `scripts/preview-auth-emails.mjs`
- Create: `tmp/email-previews/confirmation.html` (generated, not committed)
- Create: `tmp/email-previews/recovery.html` (generated, not committed)

**Interfaces:**
- Consumes: Supabase `{{ .ConfirmationURL }}` and `{{ .Token }}` template values.
- Produces: compatible email HTML and deterministic browser previews with substituted sample data.

- [ ] **Step 1: Write failing visual-contract tests**

Require lowercase wordmark, Outfit and Inter font loading/fallbacks, `headline`/`wordmark` dark
overrides, Graphite light/dark values, a 520 px maximum content width, and no amber/crimson.

Run: `npm run test -- tests/unit/supabase-email-templates.test.ts`

Expected: FAIL because current templates do not load fonts and do not override headline colors.

- [ ] **Step 2: Implement the Graphite templates**

Use a single presentation table, a 4 px meadow top rule, lowercase ink wordmark, Outfit heading,
Inter body/action text, meadow CTA, bordered OTP fallback, and explicit `!important` dark classes
for every inline foreground and surface. Preserve both Supabase variables.

- [ ] **Step 3: Add deterministic preview generation**

The Node script reads both templates, replaces the URL with
`https://serenify.tech/auth/callback?token=preview`, replaces the token with `482731`, and writes
only under `tmp/email-previews`.

Run: `node scripts/preview-auth-emails.mjs`

Expected: two preview HTML files are generated without unresolved Supabase variables.

- [ ] **Step 4: Verify visuals and tests**

Run: `npm run test -- tests/unit/supabase-email-templates.test.ts`

Render both previews at 1280x900 and 360x800 in light and dark color schemes. Confirm heading/body
contrast, no horizontal overflow, and visible CTA/OTP content.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/tests/unit/supabase-email-templates.test.ts supabase/templates scripts/preview-auth-emails.mjs
git commit -m "fix(email): align auth templates with graphite"
```

### Task 4: Provision and Bind the Azure Backend

**Files:**
- No repository files unless an existing deployment document requires current resource values.

**Interfaces:**
- Consumes: the verified local API image, remaining Azure student credit, and Cloudflare-managed `serenify.tech` DNS.
- Produces: healthy `https://api.serenify.tech` on 4 vCPU / 8 GiB with managed TLS.

- [ ] **Step 1: Confirm empty state and credit balance without secrets**

Run Azure resource-group/resource listings, public DNS queries, and the Azure consumption/balance
commands available to the student subscription. Record remaining credit and the absence of the
deleted resources without printing environment variable values.

- [ ] **Step 2: Build and provision fresh resources**

```powershell
az group create -n serenify-prod-rg -l francecentral
az acr create -g serenify-prod-rg -n serenifyacr38443bf9 --sku Basic
az acr build -g serenify-prod-rg -r serenifyacr38443bf9 `
  -t serenify-api:production -f apps/api/Dockerfile .
```

Create a Container Apps environment and `serenify-api` app from that private image with external
port 8000, 4 CPU, 8Gi memory, `minReplicas=0`, and `maxReplicas=1`. Store runtime values as Azure
Container App secrets and references. Expected: a healthy first revision and HTTPS `/healthz`.

- [ ] **Step 3: Configure DNS validation and custom domain**

Create Cloudflare DNS records required by Azure: `api` CNAME to the new Container App FQDN and
`asuid.api` TXT to the Container App custom-domain verification ID. Keep Cloudflare proxying off
until Azure validates and issues the managed certificate. Bind `api.serenify.tech` and the free
managed certificate using Azure CLI help-discovered commands.

- [ ] **Step 4: Verify HTTPS and origin behavior**

Run: `Invoke-RestMethod https://api.serenify.tech/healthz`

Expected: HTTP 200 with `status=ready` and the locked model version. Verify CORS from
`https://serenify.tech` and confirm no deployed command contains `--reload`.

- [ ] **Step 5: Measure and report credit lifetime**

Capture Azure Cost Management usage after the test window, separate the always-on Basic registry
cost from active Container Apps compute, and calculate conservative credit-lifetime scenarios for
idle scale-to-zero and expected demo traffic. Do not leave test-only duplicate resources active.

### Task 5: Configure Supabase Auth Delivery and Final Verification

**Files:**
- Modify only existing deployment documentation if necessary; never commit SMTP credentials.

**Interfaces:**
- Consumes: verified `serenify.tech` Resend domain and the two committed Supabase templates.
- Produces: confirmation and recovery emails delivered from the production domain.

- [ ] **Step 1: Verify Resend/Supabase free-tier configuration**

Confirm the Resend domain DNS records and Supabase custom SMTP settings without displaying the
SMTP password. Confirm Site URL and redirect allow-list use `https://serenify.tech`.

- [ ] **Step 2: Install template HTML in Supabase Auth**

Apply the committed confirmation and recovery subjects/content through supported Supabase CLI,
Management API, or dashboard configuration. Do not introduce a service-role key.

- [ ] **Step 3: Send real auth-flow tests**

Trigger one confirmation and one password-recovery email through public application flows. Verify
links return to the production site and that the received messages match the browser previews.

- [ ] **Step 4: Run repository and deployment verification**

Run focused Vitest and pytest suites, TypeScript typecheck, Next.js build, graph update, secret
scan, Azure health checks, DNS resolution, and certificate inspection. Passing e2e tests are
supporting evidence, not the sole proof of correct behavior.

- [ ] **Step 5: Final commit for documentation only, if changed**

```powershell
git add docs/PROGRESS.md docs/CHANGELOG.md
git commit -m "docs(deploy): record production cutover"
```

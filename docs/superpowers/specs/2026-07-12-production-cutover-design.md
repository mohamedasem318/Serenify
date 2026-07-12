# Serenify Production Cutover Design

**Date:** 2026-07-12
**Status:** Approved by Mohamed on 2026-07-12

## Objective

Finish Serenify's production deployment using the existing Azure for Students resources,
publish the FastAPI backend at `https://api.serenify.tech`, keep all runtime data access
RLS-as-user, and ship branded Supabase authentication emails without introducing a paid
service dependency.

## Constraints

- Azure student credit is the only paid-resource budget. Cloudflare, Supabase, Resend, and
  certificate features must remain on their free tiers.
- No service-role key may be required by production or repository tooling.
- Backend requests must forward the caller JWT and rely on Supabase RLS.
- The inference server must run without `--reload` so per-session smoothing buffers survive.
- The production compute envelope must match the previous ACI allocation: 4 vCPU and 8 GiB.
- Scale-to-zero remains enabled to avoid idle Container Apps compute charges. A cold start of
  roughly 40 seconds is accepted for this student deployment.
- Existing user-owned dirty and untracked files remain untouched.

## Architecture

The Next.js frontend continues to use Supabase Cloud for database and authentication. The
FastAPI and ML image runs as one Azure Container App with one maximum replica, 4 vCPU, 8 GiB,
external HTTPS ingress, and a zero minimum replica count. Cloudflare remains authoritative DNS
for `serenify.tech`; `api.serenify.tech` points to the Container App and Azure supplies the free
managed TLS certificate.

On 2026-07-12 Mohamed deleted the prior Azure resource groups to stop credit consumption. The
production test therefore starts from an empty Azure subscription: balance is checked first,
one fresh resource group is created, and the image registry plus Container App are provisioned
only when the local release candidate is ready. There is no legacy Azure rollback target.

## Constitution Amendment

Constitution v1.10.0 locks backend hosting to a DigitalOcean Droplet. The deployment changes
that locked stack row to Azure Container Apps under Azure for Students and updates the secrets
panel wording accordingly. This is a stack substitution and therefore a MINOR amendment to
v1.11.0, recorded in the constitution sync report and `docs/DECISIONS.md`.

## Security Cleanup

Commit `f885c5d` remains the isolated audit point for removal of the runtime admin invite route
and runtime service-role dependency. A second scoped commit removes service-role usage from
test, seed, and replay tooling and expands the runtime posture test to cover every production
source root. Historical documentation may describe the old path as history, but no executable
repository path may request or construct a service-role client.

## Email Design

Confirmation and recovery emails use the Graphite palette in both light and dark modes. The
lowercase `serenify` wordmark and headings use Outfit; body, labels, and the CTA use Inter.
Remote font declarations improve capable clients while system fallbacks preserve legibility in
clients that block web fonts.

Every element with an inline foreground receives a class-level dark-mode override using
`!important`, fixing the current dark heading on dark surface regression. The composition is a
single restrained surface with one meadow top rule, a high-contrast heading, one meadow action,
an OTP fallback, and calm security copy. Amber and crimson are absent because these emails are
neither stress indicators nor destructive actions.

A local preview artifact substitutes representative URLs and OTP values without modifying the
source templates. The preview is checked at desktop and 360 px widths in light and dark modes.

## Deployment Sequence

1. Ratify and commit the v1.11.0 constitution amendment.
2. Remove repository service-role tooling and verify RLS-as-user guards.
3. Redesign, test, and preview both auth email templates.
4. Check remaining Azure student credit, then create a fresh private registry and Container App
   at 4 vCPU / 8 GiB with `minReplicas=0` and `maxReplicas=1`.
5. Add Cloudflare validation/DNS records and bind an Azure managed certificate.
6. Verify `https://api.serenify.tech/healthz` and authenticated application behavior.
7. Measure registry and Container Apps consumption, report the projected credit lifetime, and
   leave only the explicitly accepted production resources active.

## Verification

- Constitution sync/version checks and no stale locked-stack references.
- Repository-wide secret posture scan and focused web/API tests.
- Email structural tests, WCAG AA contrast calculations, and browser screenshots.
- Container App revision health, resources, ingress, certificate, DNS, CORS, and custom-domain
  health checks.
- No `--reload` in the deployed command or image metadata.

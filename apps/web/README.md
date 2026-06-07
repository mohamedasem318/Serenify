# Serenify Web

The Next.js 16 application for Serenify. Auth flows, employee/team-lead/admin dashboards.

## Quickstart

See `specs/001-auth-and-roles/quickstart.md` at repo root for local setup (Supabase + .env.local + first-admin bootstrap).

## Local development: calibration (camera + API)

The calibration recorder uses the camera (`getUserMedia`), which the browser only
grants in a **secure context** — `http://localhost`, `http://127.0.0.1`, or HTTPS.
The default dev setup is **all-localhost**, so a fresh `npm run dev` records out of
the box:

1. **Open the app at `http://localhost:3000`** — a secure context, so the camera
   works. Loading it from a **LAN IP over plain HTTP blocks the camera, even on
   desktop** (it's not a secure context).
2. Keep all three on localhost: `NEXT_PUBLIC_API_URL` (apps/web `.env.local`,
   default `http://127.0.0.1:8000`), the API's `ALLOWED_ORIGINS` (apps/api `.env`,
   comma-separated, includes `http://localhost:3000` — each must equal an origin you
   load, no trailing slash), and the origin you open in the browser.
3. **Start the API bound to all interfaces:** `uv run uvicorn app.main:app --host
   0.0.0.0 --port 8000`. The bare `--port 8000` binds loopback only, so a non-
   loopback `NEXT_PUBLIC_API_URL` is connection-refused → the readiness gate
   (`/healthz`) reports "temporarily unavailable" and recording never starts. See
   `apps/api/README.md`.

### Device / phone camera testing (deferred to deployment)

Testing the camera on a real phone over the LAN needs **HTTPS** — a phone won't
grant the camera to a LAN IP over plain HTTP — **plus** the LAN IP in
`NEXT_PUBLIC_API_URL` and the LAN page origin added to `ALLOWED_ORIGINS` (e.g.
`http://localhost:3000,http://<lan-ip>:3000`), with the API bound to `0.0.0.0`. Stand up HTTPS (a dev tunnel or a deploy preview)
for this; it is **not** the default dev path. Camera smoke checks (cross-browser,
device) live in `specs/005-calibration-capture-flow/smoke-tests.md`.

## Stack

- Next.js 16 App Router, TypeScript strict
- Supabase (Auth + Postgres + RLS)
- Tailwind v4 (design tokens in `globals.css` under `@theme`)
- Vitest + Playwright

## Conventions

- Architecture context: `PROJECT_SYSTEM_PROMPT.md` in the Claude project knowledge
- Binding rules: `.specify/memory/constitution.md`
- Architectural decisions: `docs/DECISIONS.md` (append-only)
- Deferred work: `docs/BACKLOG.md`

# Serenify Web

The Next.js 16 application for Serenify. Auth flows, employee/team-lead/admin dashboards.

## Quickstart

See `specs/001-auth-and-roles/quickstart.md` at repo root for local setup (Supabase + .env.local + first-admin bootstrap).

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

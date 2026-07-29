# `video/` — Remotion project for the Serenify launch video

React-as-video. The source of truth for what gets built is
[`docs/video/serenify-launch-video-beat-sheet.md`](../docs/video/serenify-launch-video-beat-sheet.md).
**Nothing from that beat sheet is built yet** — this directory is the pipeline
only, plus the two checks that prove the pipeline is worth having.

## Why it is here and not in `apps/`

The root `package.json` declares `workspaces: ["apps/*", "packages/*"]`. Putting
this project under either glob would fold ~270 Remotion packages into the root
lockfile, so every `npm ci` — including the one CI runs before it lints
`apps/web` — would install a video toolchain to run unit tests. It would also
re-hoist `node_modules` for everyone working on `apps/web` or `apps/api`.

So `video/` sits at the repo root, **outside both globs**, with its own
`package-lock.json` and its own `node_modules`. The consequences, all
intentional:

- The root lockfile is untouched. `npm ci` at the root installs exactly what it
  installed before.
- CI never sees this directory. All three jobs in `.github/workflows/ci.yml` are
  scoped — `speckit-skills guard` reads `.claude/` and `.gitignore`, `web` runs
  everything through `-w apps/web`, `python` runs in `apps/api` and
  `packages/ml-video`. None of them glob the repo root. No CI change was needed
  and none was made.
- Root `tsconfig.json` includes only `scripts/**/*.ts` and root
  `vitest.config.mts` only `scripts/__tests__/**`, so neither picks this up.
- You must `npm install` here separately, once.

## Setup

```bash
cd video
npm install
```

## Dev studio

```bash
cd video
npm run studio
```

Opens Remotion Studio — live preview, timeline scrubbing, hot reload on save.

**If port 3000 is busy** (a `next dev` for `apps/web` usually is), pass another:
`npm run studio -- --port 3411`. Remotion serves the bundle over HTTP and fails
with a confusing "this is not a valid Remotion project" error if it lands on the
Next dev server instead of its own.

## Render

```bash
cd video
npm run render:hello   # -> out/hello-world.mp4
npm run render:probe   # -> out/web-component-probe.mp4

# or, generally:
npx remotion render <CompositionId> out/<name>.mp4 --port 3411
```

Both compositions are 1920x1080, h264, 30fps. `out/` is gitignored — renders are
regenerable and MP4s do not belong in git history.

The first render downloads a Chrome Headless Shell (Remotion rasterises frames in
a real browser); later renders reuse it.

## The two compositions

Neither is a beat. They exist to keep the pipeline honest.

| Composition | What it proves |
|---|---|
| `HelloWorld` | The toolchain produces a 1920x1080 MP4. Imports nothing from `apps/web`, so if it renders and the probe does not, the fault is in the app bridge rather than in Remotion. |
| `WebComponentProbe` | **The one that matters.** Imports the real `apps/web` `<Wordmark />` through the app's own `@/` alias and renders it with its real Tailwind v4 theme tokens. |

`<Wordmark />` is the probe because it fails loudly rather than subtly: two
tokenised colours (`text-ink` on `seren`, `text-meadow-text` on `ify`), a
tokenised font, and a `lowercase` rule. A broken CSS pipeline yields one flat
colour in the wrong typeface — obvious in a frame grab.

Verified 2026-07-29: it renders with `#EAEBEC` (`--color-bg`), the correct
two-tone split, and Outfit.

## How `apps/web` components are made to work

Three pieces, in `remotion.config.ts` and `src/tailwind.css`:

1. **`@` alias → `../apps/web`.** Webpack has no idea about the app's
   `tsconfig.json` paths, so without this every internal import inside an
   imported component (`@/lib/utils`, `@/components/...`) fails to resolve.

2. **`react` / `react-dom` pinned to this project's copies.** Because `video/`
   is outside the workspaces, a file under `apps/web` resolves `react` by
   walking *up* to the root hoisted copy — two React instances in one bundle,
   which means hooks throw and context silently returns defaults. The alias
   collapses them to one.

3. **Tailwind via `@remotion/tailwind-v4`, with `src/tailwind.css` importing
   `apps/web/app/globals.css` verbatim.** No palette is re-declared here; the
   `@theme` tokens are the shipped app's. `@source` directives are required
   because Tailwind v4 scans downward from the CSS file's own directory, which
   would otherwise miss every utility used in `apps/web`.

### Caveats when pulling in further components

- **Client-only components need care.** Anything importing `server-only`, or
  reading Supabase/`next/headers` at module scope, will not bundle. Prefer
  presentational components, or pass data in as props.
- **`next/font` does not exist here.** `globals.css` sets
  `--font-display: "Outfit"`, but in the app it is `next/font` that actually
  loads the file. Remotion loads it via `@remotion/google-fonts` instead — see
  `src/WebComponentProbe.tsx`. Any component depending on a font token needs the
  same treatment or it silently falls back to a generic face.
- **`next/image` and `next/link` will need shimming** if a component reaches for
  them.

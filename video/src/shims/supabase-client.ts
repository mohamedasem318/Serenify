/**
 * Video-side shim for `@/lib/supabase/client`, aliased in `remotion.config.ts`.
 *
 * The real module imports `@/lib/env/client`, which **parses the public env at module
 * scope** and throws `Invalid public environment configuration` when
 * `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` are absent. A Remotion bundle has no Next env
 * pipeline, so importing it fails the render outright — and it is reached transitively from
 * `lib/api/monitoring-reads`, which `SessionTrend` imports for its DEFAULT loader even when
 * the video injects `load` itself.
 *
 * The alternative was a webpack `DefinePlugin` seeding placeholder `NEXT_PUBLIC_*` values.
 * This is narrower and better: it puts nothing env-shaped in the bundle, and it makes the
 * guarantee structural rather than conventional — **the video cannot reach Supabase**,
 * because the only client factory in its bundle throws. Every data-driven component in the
 * video is fed by props (`load`, `state`, `points`), which is what a video needs anyway:
 * a network read is not frame-deterministic.
 */
export function createClient(): never {
  throw new Error(
    "video/: Supabase is not reachable from the video bundle. Feed the component data " +
      "through props (SessionTrend's `load`, OpSurfaces' `state`) — a network read is not " +
      "frame-deterministic and would make the render non-reproducible.",
  );
}

/**
 * Video-side shim for `@/lib/env/client`, aliased in `remotion.config.ts`.
 *
 * The real module validates the public env **at module scope** and throws
 * `Invalid public environment configuration` when `NEXT_PUBLIC_*` are absent. A Remotion
 * bundle has no Next env pipeline, so any component that transitively imports an API client
 * (`lib/api/anchor-client`, `chat-client`, `monitoring-client`) or the Supabase browser client
 * fails the whole render at import time — before a single frame is drawn.
 *
 * Shimming at the ENV boundary rather than at each client is deliberate: the importers are a
 * moving set (four today), and chasing them one at a time means the render breaks again the
 * next time `apps/web` adds one. This is the single choke point.
 *
 * The values are obviously-fake placeholders, and that is the point — they must never look
 * like credentials that someone could mistake for real ones in a public repository. Nothing in
 * the video can reach the network anyway: `src/shims/supabase-client.ts` throws, and every
 * data-driven component in the film is fed from props computed off the current frame.
 */
/** Field names match `lib/env/schema.ts` — `supabaseUrl` / `supabaseAnonKey` / `apiUrl`. */
export const clientEnv = {
  supabaseUrl: "https://video-bundle.invalid",
  supabaseAnonKey: "not-a-key-the-video-never-makes-a-request",
  apiUrl: "https://video-bundle.invalid",
} as const;

export type ClientEnv = typeof clientEnv;

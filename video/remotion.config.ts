import path from "node:path";

import { enableTailwind } from "@remotion/tailwind-v4";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setEntryPoint("./src/index.ts");

// NOT `__dirname`. Remotion evaluates this config from inside `@remotion/cli`'s
// own dist directory, so `__dirname` points there and every alias below would
// resolve under `node_modules/@remotion/cli/dist/...`. The CLI only finds this
// file by looking in the current working directory in the first place, so cwd
// IS the project root whenever the config is loaded at all.
const HERE = process.cwd();
const WEB = path.resolve(HERE, "../apps/web");

Config.overrideWebpackConfig((config) => {
  const withTailwind = enableTailwind(config);

  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...withTailwind.resolve?.alias,

        // ── Shims, and they MUST come before the bare `@` below ──────────────
        //
        // Webpack matches non-`$` alias keys by PREFIX, in insertion order, and takes
        // the first hit. `@` matches everything under the app, so any more specific
        // key placed after it is dead. Order here is load-bearing.
        //
        // Each one exists because a real `apps/web` component reaches for something
        // that cannot exist in a Remotion bundle. `apps/web` is never modified for the
        // video — the video is downstream of the product — so the boundary is here.
        //
        //  · chat-pill — `components/notification.tsx` imports one CONSTANT from it, and
        //    the pill imports a server-action module, which drags
        //    `next/dist/server/lib/trace` in and fails on `@opentelemetry/api`.
        //  · next/link + next/navigation — both read Next's router context and throw
        //    outside an app-router tree. Nothing in the video navigates.
        //  · supabase/client — imports `@/lib/env/client`, which PARSES THE PUBLIC ENV AT
        //    MODULE SCOPE and throws when `NEXT_PUBLIC_SUPABASE_*` are absent. Reached
        //    transitively from `lib/api/monitoring-reads`, which `SessionTrend` imports for
        //    its default loader even when the video injects `load`.
        //  · use-media-query — THE LOAD-BEARING ONE. A Remotion render is frame-addressed
        //    and does not advance the wall clock, seek rAF, or seek CSS transitions, so every
        //    framer-motion / `transition:` / `setTimeout` animation in `apps/web` would run at
        //    whatever speed the renderer happened to manage. The shim answers
        //    `prefers-reduced-motion` as TRUE so each component takes its own shipped STATIC
        //    variant, and the video re-authors that component's declared motion values
        //    frame-by-frame in `src/app/motion.tsx`. Width queries are still answered honestly.
        "@/components/chat-pill": path.resolve(HERE, "src/shims/chat-pill.tsx"),
        "@/lib/supabase/client": path.resolve(HERE, "src/shims/supabase-client.ts"),
        //  · env/client — validates `NEXT_PUBLIC_*` AT MODULE SCOPE and throws when they are
        //    absent, so any component transitively importing an API client kills the render at
        //    import time. Shimmed at the env boundary rather than per-client because the set of
        //    importers moves; this is the one choke point. Placeholders only — nothing in the
        //    video can reach the network (see supabase-client.ts).
        "@/lib/env/client": path.resolve(HERE, "src/shims/env-client.ts"),
        "@/hooks/use-media-query": path.resolve(HERE, "src/shims/use-media-query.ts"),
        //  · the chat route's SERVER ACTIONS — imported by `chat-shell.tsx:15`. Same
        //    `@opentelemetry/api` failure as the pill, and pointless even if it bundled: a
        //    frame cannot await a round-trip and stay deterministic. Beat 10 drives the shell
        //    through `initialDetail`, computed from the frame.
        "@/app/(authed)/app/chat/actions": path.resolve(HERE, "src/shims/chat-actions.ts"),
        "next/link": path.resolve(HERE, "src/shims/next-link.tsx"),
        "next/navigation": path.resolve(HERE, "src/shims/next-navigation.ts"),

        // The alias `apps/web` uses for itself (its `tsconfig.json` paths).
        // Without it every internal import inside an imported component —
        // `@/lib/utils`, `@/components/...` — fails to resolve under webpack.
        "@": WEB,

        // This project sits outside the root npm workspaces, so it has its own
        // node_modules. Files under apps/web resolve `react` by walking UP to
        // the repo-root hoisted copy, which would put TWO React instances in one
        // bundle — hooks throw, context silently returns defaults. Pinning the
        // specifier (webpack treats a non-`$` key as a prefix match, so
        // `react/jsx-runtime` is covered too) collapses them to one.
        react: path.resolve(HERE, "node_modules/react"),
        "react-dom": path.resolve(HERE, "node_modules/react-dom"),
      },
    },
  };
});

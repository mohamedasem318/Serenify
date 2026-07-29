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

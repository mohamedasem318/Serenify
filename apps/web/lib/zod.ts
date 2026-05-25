import { z } from "zod";

/**
 * App-wide Zod entry point. Import `z` from here, never directly from `"zod"`.
 *
 * Zod 4 ships a JIT validator compiler that builds parsers with
 * `new Function(...)` and runs a `new Function("")` capability probe. A strict
 * Content-Security-Policy without `'unsafe-eval'` blocks both: Zod swallows the
 * thrown error and falls back to the interpreted validator (functionally
 * identical), but the blocked call still fires a `securitypolicyviolation`
 * report in the browser on every schema build. `jitless: true` skips the
 * compile AND the probe (zod `v4/core/util.js` `allowsEval`), so the app keeps a
 * strong `script-src` (no `'unsafe-eval'`) with zero violation noise.
 *
 * The flag is read at schema BUILD time (`!globalConfig.jitless` is captured
 * when `z.object(...)` is constructed — zod `v4/core/schemas.js`), so it MUST be
 * set before any schema is built. Routing every schema module through this
 * barrel guarantees that: importing `z` from here runs the side effect before
 * the importing module's `z.object`/`z.string` calls evaluate.
 *
 * See docs/security/05-csp-header.md (slice-5 empirical finding).
 */
z.config({ jitless: true });

export { z };

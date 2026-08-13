import { execFileSync } from "node:child_process";

/**
 * Fail fast, and in plain words, when the dev-server port is already taken.
 *
 * WHY THIS EXISTS. Both Playwright configs now run with `reuseExistingServer: false`
 * outside CI (2026-08-14, from the #261 post-mortem). Reuse is a silent, expensive
 * failure mode: a `next dev` that has taken an ECONNRESET keeps LISTENING while serving
 * nothing usable, so Playwright's `url` probe says "ready", every later run inherits the
 * same dead server, and failures snowball — 9 → 27 in #261, sweeping in specs that had
 * passed in 600 ms. Two whole runs were garbage before anyone suspected the server. A
 * cold start costs ~12 s on a warm `.next`, about 2.5% of a 7.9-minute run, which is a
 * good price for never debugging that again.
 *
 * The cost of turning reuse off is that a developer with `npm run dev` already open now
 * gets an error instead of a run. That trade is deliberate — a loud immediate error
 * beats a silent expensive one — but only if the error says what to do. Playwright's own
 * message ("…or set reuseExistingServer:true in config.webServer") points at exactly the
 * setting we just disabled on purpose, so it would send the next person to re-introduce
 * the bug. Hence this pre-flight, which runs first and says the useful thing instead.
 *
 * Synchronous on purpose: a Playwright config module is evaluated synchronously, so the
 * probe is a one-shot TCP connect in a throwaway `node -e` (~50 ms, once per run).
 */
export function assertPortFree(port: number, configName: string) {
  // CI always starts from a clean machine and already ran with reuse off; skip the probe
  // rather than spend the process spawn on every job.
  if (process.env.CI) return;

  // ONLY THE RUNNER PROCESS MAY ASK THIS. Playwright re-evaluates the config file inside
  // every worker it spawns, and by then Playwright's OWN dev server is listening on the
  // port — so an unguarded probe reports "already in use" against the server it just
  // started and fails the run it was meant to protect. Measured the first time this
  // shipped: 3 failed / 9 did not run, one failure per worker, every message pointing at
  // a port conflict that did not exist. `TEST_WORKER_INDEX` is set in the worker's
  // environment before the config is loaded, so its presence is the reliable "I am not
  // the runner" signal.
  if (process.env.TEST_WORKER_INDEX !== undefined) return;

  // exit 1 = something accepted the connection (port busy); exit 0 = refused or timed out.
  const probe = [
    "const net=require('node:net');",
    `const s=net.connect(${port},'127.0.0.1');`,
    "s.on('connect',()=>{s.destroy();process.exit(1)});",
    "s.on('error',()=>process.exit(0));",
    "setTimeout(()=>{s.destroy();process.exit(0)},1000);",
  ].join("");

  try {
    execFileSync(process.execPath, ["-e", probe], { stdio: "ignore" });
    return; // port is free
  } catch {
    /* busy — fall through to the message */
  }

  throw new Error(
    [
      ``,
      `Port ${port} is already in use, and ${configName} deliberately does NOT reuse an`,
      `existing dev server.`,
      ``,
      `Stop whatever is on the port, then re-run. Usually that is your own dev server:`,
      ``,
      `  • quit the terminal running \`npm run dev\`, or`,
      `  • Windows:  npx kill-port ${port}`,
      `    macOS/Linux:  lsof -ti:${port} | xargs kill`,
      ``,
      `Do NOT "fix" this by setting reuseExistingServer:true. That is the #261 failure`,
      `mode: a dev server that has died mid-request keeps listening, Playwright's readiness`,
      `probe accepts it, and every run after that inherits a broken server — the reason`,
      `this guard exists. Playwright starting its own server costs ~12 s.`,
      ``,
    ].join("\n"),
  );
}

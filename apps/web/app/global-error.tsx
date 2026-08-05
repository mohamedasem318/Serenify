"use client";

import { useEffect } from "react";

/**
 * The boundary above the root layout (#203). `app/error.tsx` renders INSIDE the tree
 * the root layout defines, so a failure in the root layout itself — headers(), the
 * font pipeline, <Providers> — skips it and, before this file existed, fell through
 * to Next's unstyled DefaultGlobalError. This file replaces that last screen.
 *
 * IT REPLACES THE DOCUMENT, SO IT BRINGS ITS OWN EVERYTHING. Next mounts
 * global-error in place of the root layout: no globals.css, no Tailwind utilities,
 * no next/font variables, no <Providers> (so no next-themes class). That is why the
 * Mist & Meadow values below are INLINED as a private token block rather than
 * consumed via the usual utilities — each `--ge-*` pair is copied from
 * app/globals.css (light `@theme` / `:root.dark`) and must be kept in sync by hand
 * if the palette ever changes. Dark mode follows `prefers-color-scheme`: the
 * next-themes manual override lives in localStorage behind a provider this page
 * exists to survive losing, so the OS preference is the honest best signal here.
 *
 * The CSP allows this: style-src carries 'unsafe-inline' (see proxy.ts — Radix's
 * runtime <style> needs it), so the inline block renders under the same policy as
 * the rest of the app.
 *
 * Copy and discipline are app/error.tsx's, verbatim: nothing from the error object
 * reaches the screen — no message, no stack, no digest. Console only.
 */

/* Hallmark · component: error-page · genre: editorial (inherited) · theme: Mist & Meadow (inlined)
 * states: default · hover · focus · active · disabled — loading/error/success are the page itself
 * contrast: on-accent on foggy 5.3:1 light / bg-on-foggy 8.3:1 dark · ink on bg ~13:1 both
 */
const styles = `
  :root {
    --ge-bg: #EAEBEC;
    --ge-ink: #1C2023;
    --ge-muted: #585D61;
    --ge-foggy: #356E88;
    --ge-on-accent: #F8F9FA;
    --ge-meadow-text: #346A56;
    --ge-radius-control: 8px;
    --ge-font-sans: "Inter", system-ui, sans-serif;
    --ge-font-display: "Outfit", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ge-bg: #101214;
      --ge-ink: #E2E5E8;
      --ge-muted: #939A9F;
      --ge-foggy: #74B6CE;
      /* Filled-accent fg flips to the deep bg on the lighter dark-mode foggy,
         mirroring the Button foggy variant's dark:text-bg. */
      --ge-on-accent: #101214;
      --ge-meadow-text: #63B292;
    }
  }
  html, body {
    margin: 0;
    min-height: 100%;
    overflow-x: clip;
    background-color: var(--ge-bg);
    color: var(--ge-ink);
    font-family: var(--ge-font-sans);
  }
  .ge-main {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.5rem;
    text-align: center;
  }
  .ge-stack { width: 100%; max-width: 24rem; }
  .ge-title {
    margin: 0 0 0.5rem;
    font-family: var(--ge-font-display);
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .ge-note {
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--ge-muted);
  }
  .ge-retry {
    display: flex;
    width: 100%;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--ge-radius-control);
    background-color: var(--ge-foggy);
    color: var(--ge-on-accent);
    font: inherit;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 150ms ease-out;
  }
  .ge-retry:hover { opacity: 0.9; }
  .ge-retry:active { opacity: 0.8; }
  .ge-retry:disabled { opacity: 0.5; cursor: not-allowed; }
  .ge-home {
    display: flex;
    min-height: 2.75rem;
    margin-top: 0.75rem;
    align-items: center;
    justify-content: center;
    border-radius: var(--ge-radius-control);
    color: var(--ge-meadow-text);
    font-size: 0.875rem;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .ge-home:hover { text-decoration: none; }
  /* Focus is instant and never animated; the foggy ring clears 3:1 on the page in
     both modes (same pair the app's focus-visible ring uses). */
  .ge-retry:focus-visible, .ge-home:focus-visible {
    outline: 2px solid var(--ge-foggy);
    outline-offset: 2px;
  }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The developer channel, and the only place the error goes (no message, no
    // stack, no digest on screen — same rule as app/error.tsx).
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Serenify</title>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <main className="ge-main">
          <div className="ge-stack">
            <h1 className="ge-title">This didn&rsquo;t load</h1>
            <p className="ge-note">
              Something on our side didn&rsquo;t finish. Trying again usually
              settles it.
            </p>
            <button type="button" className="ge-retry" onClick={reset}>
              Try again
            </button>
            {/* A full navigation on purpose: the router state is part of what may
                have failed, so the escape hatch must leave it behind (same reasoning
                as app/error.tsx's escape hatch). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="ge-home">
              Back to Serenify
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

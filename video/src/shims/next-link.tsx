import React from "react";

/**
 * Video-side shim for `next/link`, aliased in `remotion.config.ts`.
 *
 * `next/link` is a client component that reaches for the Next router context; outside a Next
 * app there is no router, so it throws on render. Every link in the video is decoration — the
 * cursor is drawn and the "navigation" is the next beat — so an `<a>` with the same className
 * is visually identical and behaviourally inert.
 *
 * `prefetch`, `replace`, `scroll` and `shallow` are swallowed so they never reach the DOM as
 * unknown attributes (React would warn, and a warning per frame is 2430 warnings a render).
 */
export const Link: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string | undefined };
    prefetch?: unknown;
    replace?: unknown;
    scroll?: unknown;
    shallow?: unknown;
  }
> = ({ href, prefetch: _p, replace: _r, scroll: _s, shallow: _sh, children, ...rest }) => (
  <a href={typeof href === "string" ? href : ((href as { pathname?: string }).pathname ?? "#")} {...rest}>
    {children}
  </a>
);

export default Link;

/**
 * Video-side shim for `next/navigation`, aliased in `remotion.config.ts`.
 *
 * The real module reads Next's router context and throws outside an app router tree. Nothing
 * in the video navigates — every "navigation" is the next beat, and every click is a drawn
 * cursor — so these return inert values rather than wiring a fake router.
 *
 * `usePathname` returns the authed dashboard path because that is what the components which
 * call it (the header's active-state nav, the chat pill) would see during the beats they
 * appear in. If a beat ever needs a different active tab, pass it explicitly rather than
 * making this stateful.
 */
export const usePathname = () => "/app";
export const useSearchParams = () => new URLSearchParams();
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
});
export const useParams = () => ({});
export const redirect = () => {
  throw new Error("next/navigation redirect() is not available in the video bundle");
};
export const notFound = () => {
  throw new Error("next/navigation notFound() is not available in the video bundle");
};

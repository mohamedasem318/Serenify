import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaptureProbe } from "@/components/capture-probe/capture-probe";

/**
 * Flag-gated mobile capture probe (docs/triage/mobile-capture-diagnosis.md).
 *
 * OFF BY DEFAULT: `NEXT_PUBLIC_CAPTURE_PROBE` is unset in every normal environment,
 * so this route is a 404 in production and in dev — it exists only in a build made
 * deliberately for a diagnostic session (`--build-env NEXT_PUBLIC_CAPTURE_PROBE=1`).
 * The flag is read as a literal member access so the check is inlined at build time.
 *
 * Ephemeral by construction: the client component talks to no backend and persists
 * nothing (see capture-probe.tsx header). Unlinked + noindex; requires no account.
 */

export const metadata: Metadata = {
  title: "Camera check",
  robots: { index: false, follow: false },
};

export default function CaptureProbePage() {
  if (process.env.NEXT_PUBLIC_CAPTURE_PROBE !== "1") notFound();
  return <CaptureProbe />;
}

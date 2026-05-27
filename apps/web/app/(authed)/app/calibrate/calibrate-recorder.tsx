"use client";

import { useRouter } from "next/navigation";

import { AnchorRecorder } from "@/components/anchor/anchor-recorder";

/**
 * Client wrapper for the calibrate route: a Server Component cannot pass the
 * onComplete/onSkip callbacks across the RSC boundary, so the navigation lives
 * here. Both paths return to /app, where has_anchor recomputes (banner gone on
 * success).
 */
export function CalibrateRecorder() {
  const router = useRouter();
  return (
    <AnchorRecorder
      context="calibrate"
      onComplete={() => router.replace("/app")}
      onSkip={() => router.replace("/app")}
    />
  );
}

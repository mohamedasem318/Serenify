"use client";

import { notFound } from "next/navigation";

import { CameraPill } from "@/components/monitor/camera-pill";
import { OpSurfaces } from "@/components/monitor/op-surfaces";

/** Non-production real-CSS harness for the cold-start responsive layout contract. */
export default function ColdStartHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="p-4 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface px-6 pb-6 pt-16 shadow-soft sm:min-h-[480px] sm:px-10 sm:pb-10">
          <div className="absolute right-4 top-4 z-10">
            <CameraPill status="off" pinned={false} onTogglePin={() => {}} />
          </div>
          <OpSurfaces
            state={{ op: "permission", band: null, skipCause: null }}
            starting
            onAllow={() => {}}
            onRetryBlocked={() => {}}
          />
        </div>
      </div>
    </main>
  );
}

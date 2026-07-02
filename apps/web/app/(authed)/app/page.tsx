import { redirect } from "next/navigation";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";
import { RecentChatsCard } from "@/components/home/recent-chats-card";
import { ThingsThatMightHelpCard } from "@/components/home/things-that-might-help-card";
import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";
import { WelcomeBanner } from "@/components/home/welcome-banner";
import { QuestionnaireCoordinator } from "@/components/questionnaire/questionnaire-coordinator";
import { RolePlaceholder } from "@/components/role-placeholder/role-placeholder";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "employee" | "team_lead" | "admin";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single<{ full_name: string | null; role: Role }>();

  if (!profile) {
    redirect("/onboarding");
  }

  if (profile.role === "employee") {
    // Calibration status comes ONLY from has_anchor (Principle I — the anchor
    // columns are not readable by any client role). Show the banner only on an
    // explicit `false`; treat null/error conservatively as "no banner".
    const { data: hasAnchor } = await supabase.rpc("has_anchor", {
      target_user: user.id,
    });

    return (
      <div className="mx-auto w-full max-w-6xl space-y-10 pb-12">
        {hasAnchor === false && <CalibrationBanner />}
        <WelcomeBanner fullName={profile.full_name} />
        {/* 009 / FR-012: the check-in card is its OWN full-width row so the expanded lane plot
            gets the real ~1104px desktop drawing area (DC-002) — a half-width column would
            cramp the lanes into the rejected totem proportions. The two secondary cards move
            to a grid BELOW. US4 (008 T048): the card recaps TODAY and expands in place; it
            needs the user id (to run the browser-side RLS reads as the user) + has_anchor
            (null/error → undefined, treated conservatively as calibrated — matches the banner
            logic; only an explicit `false` routes to calibrate-first). */}
        <TodaysCheckinCard userId={user.id} hasAnchor={hasAnchor ?? undefined} />
        {/* Stacks to one column until 880px (mock breakpoint) so neither secondary card
            is squeezed into the cramped 2-col band that md (768) would create. */}
        {/* items-start so each card sizes to its own content — the recent-chats card is
            height-capped independently and must not be stretched to match its neighbour. */}
        <div className="grid grid-cols-1 items-start gap-6 min-[880px]:grid-cols-2">
          <ThingsThatMightHelpCard />
          <RecentChatsCard />
        </div>
        {/* Feature 012 / US4: the questionnaire coordinator — session-end product feedback
            (for a just-ended session) and the weekly work-environment check-in. It mounts
            ALONGSIDE the Today card and trend without changing their rendering (T062/T064),
            and renders nothing when no surface is due. */}
        <QuestionnaireCoordinator userId={user.id} />
      </div>
    );
  }

  return <RolePlaceholder role={profile.role} />;
}

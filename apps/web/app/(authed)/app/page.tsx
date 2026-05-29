import { redirect } from "next/navigation";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";
import { RecentChatsCard } from "@/components/home/recent-chats-card";
import { ThingsThatMightHelpCard } from "@/components/home/things-that-might-help-card";
import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";
import { WelcomeBanner } from "@/components/home/welcome-banner";
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[3fr_2fr]">
          <TodaysCheckinCard />
          <div className="flex flex-col gap-6">
            <ThingsThatMightHelpCard />
            <RecentChatsCard />
          </div>
        </div>
      </div>
    );
  }

  return <RolePlaceholder role={profile.role} />;
}

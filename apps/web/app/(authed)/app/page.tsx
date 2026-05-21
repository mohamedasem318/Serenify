import { redirect } from "next/navigation";

import { RecentChatsCard } from "@/components/home/recent-chats-card";
import { ThingsThatMightHelpCard } from "@/components/home/things-that-might-help-card";
import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";
import { WelcomeBanner } from "@/components/home/welcome-banner";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "employee" | "team_lead" | "admin";

const ROLE_COPY: Record<Role, string> = {
  employee: "You're signed in as an employee.",
  team_lead: "You're signed in as a team lead.",
  admin: "You're signed in as an admin.",
};

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
    return (
      <div className="mx-auto w-full max-w-6xl space-y-10 pb-12">
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

  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
        {profile.full_name ?? "Hello"}
      </h1>
      <p
        data-testid="role-banner"
        className="text-base leading-relaxed text-muted"
      >
        {ROLE_COPY[profile.role]}
      </p>
      <p className="text-sm leading-relaxed text-muted">
        Your workspace is being built. Real features arrive in upcoming
        releases — for now this page just confirms your role.
      </p>
    </section>
  );
}

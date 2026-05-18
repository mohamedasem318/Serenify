import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLE_COPY = {
  employee: "You're signed in as an employee.",
  team_lead: "You're signed in as a team lead.",
  admin: "You're signed in as an admin.",
} as const;

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
    .single<{ full_name: string | null; role: keyof typeof ROLE_COPY }>();

  if (!profile) {
    redirect("/onboarding");
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

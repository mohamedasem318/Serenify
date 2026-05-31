import { redirect } from "next/navigation";

import { ChatPill } from "@/components/chat-pill";
import { DevHistoryRefresh } from "@/components/dev-history-refresh";
import { Header } from "@/components/header/header";
import { createClient } from "@/lib/supabase/server";

type Role = "employee" | "team_lead" | "admin";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    .maybeSingle<{ full_name: string | null; role: Role }>();

  const fullName = profile?.full_name ?? null;
  const role: Role = profile?.role ?? "employee";
  const email = user.email ?? "";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* DEV-ONLY: re-sync the stale server tree (e.g. the calibration banner) after a
          browser Back that dev serves from disk cache. True no-op in prod, where
          force-dynamic already emits no-store. See DevHistoryRefresh. */}
      <DevHistoryRefresh />
      <Header fullName={fullName} email={email} role={role} />
      <main className="flex-1 px-4 pt-6 sm:px-6 sm:pt-8">{children}</main>
      {role === "employee" && <ChatPill />}
    </div>
  );
}

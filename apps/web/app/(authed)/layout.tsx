import { redirect } from "next/navigation";

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
      <Header fullName={fullName} email={email} role={role} />
      <main className="flex-1 px-4 sm:px-6">{children}</main>
    </div>
  );
}

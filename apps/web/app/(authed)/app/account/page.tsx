import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotificationsPlaceholder } from "@/components/account/notifications-placeholder";
import { PrivacyPlaceholder } from "@/components/account/privacy-placeholder";
import { ProfileSection } from "@/components/account/profile-section";
import { SecuritySection } from "@/components/account/security-section";
import { SignOutSection } from "@/components/account/sign-out-section";
import { BaselineSection } from "@/components/anchor/baseline-section";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account — Serenify" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
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
    .maybeSingle<{ full_name: string | null; role: "employee" | "team_lead" | "admin" }>();

  const initialFullName = profile?.full_name ?? "";
  const email = user.email ?? "";

  // The calm-baseline section is an employee-only concept (only employees have an
  // anchor flow — Principle I). team_lead / admin have no baseline, so the section
  // is omitted entirely rather than shown empty. Whether-set comes from the
  // scope-guarded has_anchor(auth.uid()) boolean — never a date (📌 DECISION-23 /
  // FR-041). Conservative on null/error: treat as not-set (the safe, additive copy).
  const isEmployee = profile?.role === "employee";
  let hasAnchor = false;
  if (isEmployee) {
    const { data } = await supabase.rpc("has_anchor", { target_user: user.id });
    hasAnchor = data === true;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 py-8 sm:py-12">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Account
        </h1>
        <p className="text-base leading-relaxed text-muted">
          Your profile, your settings, and what stays private.
        </p>
      </header>

      <ProfileSection initialFullName={initialFullName} email={email} />
      <Separator />
      <SecuritySection />
      {isEmployee && (
        <>
          <Separator />
          <BaselineSection hasAnchor={hasAnchor} />
        </>
      )}
      <Separator />
      <PrivacyPlaceholder />
      <Separator />
      <NotificationsPlaceholder />
      <Separator />
      <SignOutSection />
    </div>
  );
}

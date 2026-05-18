import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your Serenify password" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const stateParam = typeof params.state === "string" ? params.state : null;
  const emailParam = typeof params.email === "string" ? params.email : null;
  const initialSent = stateParam === "reset_sent";
  return (
    <ForgotForm initialSent={initialSent} initialEmail={emailParam ?? null} />
  );
}

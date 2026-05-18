import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your Serenify account",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const stateParam = typeof params.state === "string" ? params.state : null;
  const emailParam = typeof params.email === "string" ? params.email : null;
  const initialCheckEmail =
    stateParam === "check_email" && !!emailParam;
  return (
    <SignupForm
      initialCheckEmail={initialCheckEmail}
      initialEmail={emailParam ?? null}
    />
  );
}

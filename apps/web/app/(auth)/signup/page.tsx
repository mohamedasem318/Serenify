import type { Metadata } from "next";

import { currentRevision } from "@/lib/consent/evaluate";

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
  // Resolved HERE, on the server, and handed down as a prop. The client bundle never
  // imports the registry: it would ship the whole published consent history to every
  // visitor's browser in order to render one string. This is also the value the
  // acknowledgement's hidden input carries, which is what lets the action detect a page
  // that was rendered against a revision since superseded (§7.1 step 2).
  const termsVersionId = currentRevision("terms_privacy").versionId;

  return (
    <SignupForm
      initialCheckEmail={initialCheckEmail}
      initialEmail={emailParam ?? null}
      termsVersionId={termsVersionId}
    />
  );
}

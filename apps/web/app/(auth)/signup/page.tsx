import type { Metadata } from "next";

import { refusalFromParam, SIGNUP_REFUSED_STATE } from "@/lib/auth/signup-refusal";
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
  // #184: a refused no-JS POST lands back here with a fixed enum marker; rebuild the
  // SignUpResult it stands for so the form's existing branches render the refusal.
  // Anything outside the enum rebuilds nothing (the URL is input, not content).
  const initialRefusal =
    stateParam === SIGNUP_REFUSED_STATE
      ? refusalFromParam(typeof params.reason === "string" ? params.reason : null)
      : null;
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
      initialRefusal={initialRefusal}
      termsVersionId={termsVersionId}
    />
  );
}

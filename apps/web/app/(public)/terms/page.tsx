import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { TERMS_LEDE, TERMS_SECTIONS, TERMS_TITLE } from "@/lib/legal/copy";

/**
 * Feature 013 — `/terms` (T029).
 *
 * Every string comes from `lib/legal/copy.ts`. There is not one inline literal in this
 * file, including the page title, because the whole point of §9.3's copy rule is that
 * reviewing the legal text means reading one module rather than hunting a component tree
 * for the sentence that got edited in a page file.
 *
 * Renders for a signed-out visitor: the `(public)` shell makes no authentication call, so
 * this route has no session to read and nothing to fail.
 */
export const metadata: Metadata = {
  title: TERMS_TITLE,
};

export default function TermsPage() {
  return <LegalDocument title={TERMS_TITLE} lede={TERMS_LEDE} sections={TERMS_SECTIONS} />;
}

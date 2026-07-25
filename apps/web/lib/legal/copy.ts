/**
 * Feature 013 — every string in `/terms` and `/privacy`, as named exported constants
 * (T021, T022; `contracts/public-surface.md` §9.3 item 1).
 *
 * THIS FILE IS THE COPY REVIEW SURFACE. The two document pages render these constants and
 * contain no string literals of their own, so reviewing the legal text is reviewing one
 * module rather than a component tree. Landing copy lives in `lib/landing/copy.ts` (P6);
 * these two files are the whole surface the forbidden-claim assertion runs over.
 *
 * FR-050 governs every sentence here: each factual statement was cross-checked against
 * Constitution Principle I **and** the implementation before it was written. Where the
 * two disagreed, work stopped — a policy that misdescribes the data handling is worse
 * than none. The verification pass behind the current text is recorded in the P3 PR body.
 *
 * FR-004: no numeric quality metric appears anywhere in this file. The evaluation METHOD
 * is named ("subject-disjoint") and carries no numbers. Asserted by
 * `tests/unit/lib/legal/copy-invariants.test.ts`.
 *
 * FR-048a: every passage describing manager visibility carries its not-yet-live marker
 * WITHIN ITS OWN TEXT, and is listed in `MANAGER_VISIBILITY_PASSAGES` so a test can prove
 * it. A marker in a distant forward-looking section does not satisfy that requirement and
 * does not satisfy the test.
 *
 * Terminology is binding (`plan.md` §11 header): **calibration** = baseline capture ·
 * **monitoring session** = live camera inference · **weekly work-environment check-in** =
 * the text questionnaire. Bare "check-in" is never used.
 */

/** One rendered block inside a legal section. The chrome renders these in order. */
export type LegalBlock =
  | { readonly kind: "p"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] };

/** One anchored section of a legal document. `id` is the in-page anchor target. */
export type LegalSection = {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
};

const p = (text: string): LegalBlock => ({ kind: "p", text });
const list = (items: readonly string[]): LegalBlock => ({ kind: "list", items });

// ─────────────────────────────────────────────────────────────────────────────
// Shared — the no-legal-review notice (FR-047)
//
// Rendered as a bordered notice at the TOP of both documents, never as a footnote.
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_REVIEW_NOTICE_HEADING = "An informed draft, not reviewed by a lawyer";

export const LEGAL_REVIEW_NOTICE_BODY =
  "Serenify is a non-commercial graduation project. This document was written carefully " +
  "and in good faith, against the system as it is actually built — but it has not been " +
  "reviewed by a qualified lawyer, in Egypt or anywhere else. Qualified legal review is " +
  "required before Serenify processes real, non-demonstration personal data. Until that " +
  "review happens, read this as an honest account of how the system behaves, not as a " +
  "settled legal instrument.";

// ─────────────────────────────────────────────────────────────────────────────
// Terms of Service (T021)
// ─────────────────────────────────────────────────────────────────────────────

export const TERMS_TITLE = "Terms of Service";

export const TERMS_LEDE =
  "These terms cover what Serenify is, what it is not, and what you and the person who " +
  "provides it each agree to. They are written to be read, not skimmed past. If any " +
  "sentence here is unclear, the contact address at the end reaches a person.";

// § What Serenify is

const TERMS_WHAT_HEADING = "What Serenify is";

export const TERMS_WHAT_P1 =
  "Serenify is a workplace wellbeing tool. It reads signs of stress from a webcam during " +
  "a monitoring session you start yourself, shows you what it noticed, and offers a " +
  "conversation with an in-app companion called Ren if you want one. It also collects a " +
  "short weekly work-environment check-in, which is a text questionnaire about your " +
  "working conditions rather than about you.";

export const TERMS_WHAT_P2 =
  "Before your first monitoring session, Serenify records a short calibration — a brief " +
  "webcam capture that establishes what your ordinary, unstressed face looks like, so " +
  "later readings are compared against you rather than against an average stranger.";

export const TERMS_WHAT_P3 =
  "Serenify is a demonstration build of a graduation project. It is not a commercial " +
  "product, it is not sold, and it carries no service-level promise. Features described " +
  "here may change or be withdrawn as the project develops.";

// § Serenify is not medical care

const TERMS_NOT_MEDICAL_HEADING = "Serenify is not medical care";

export const TERMS_NOT_MEDICAL_P1 =
  "Serenify is not a medical device, and nothing it shows you is a diagnosis. A reading " +
  "is a signal, not a clinical finding. Ren is a scripted software companion, not a " +
  "therapist, counsellor, or clinician, and a conversation with Ren is not treatment.";

export const TERMS_NOT_MEDICAL_P2 =
  "Serenify is not an emergency service and does not monitor for emergencies. It cannot " +
  "call anyone on your behalf, and no one is watching it on the other end. If you are in " +
  "danger or in crisis, contact your local emergency number or a crisis line directly. " +
  "Where Serenify recognises that a conversation has turned to crisis, it responds by " +
  "showing you external support resources, and it does nothing else with that fact.";

export const TERMS_NOT_MEDICAL_P3 =
  "Do not use Serenify as a substitute for medical or psychological care, and do not " +
  "delay seeking care because of anything Serenify showed you.";

// § Who provides Serenify

const TERMS_PROVIDER_HEADING = "Who provides Serenify";

export const TERMS_PROVIDER_P1 =
  "Serenify is provided by Mohamed Asem, as an individual. There is no company and no " +
  "legal entity behind it. He is also the data controller for the personal data Serenify " +
  "handles, and he can be reached at mohamedasem318@gmail.com.";

export const TERMS_PROVIDER_P2 =
  "Serenify is a graduation project carried out in an academic setting, and the people " +
  "who built it are named on the site. The academic context explains why the project " +
  "exists; it does not make the university a party to these terms or a controller of your " +
  "data.";

// § Who may use it

const TERMS_ELIGIBILITY_HEADING = "Who may use Serenify";

export const TERMS_ELIGIBILITY_P1 =
  "Serenify is intended for adults using it in a demonstration capacity. It is not " +
  "designed for children, and it is not offered to anyone under eighteen.";

export const TERMS_ELIGIBILITY_P2 =
  "Stated plainly, because the alternative would be misleading: Serenify performs no age " +
  "verification. The requirement above is a term of use, not a control the software " +
  "enforces. Egyptian law requires a guardian's explicit written consent before personal " +
  "data of anyone under fifteen is processed, and Serenify has no flow that could obtain " +
  "or record such consent. That is one of the gaps qualified legal review would need to " +
  "close before real user data is processed.";

export const TERMS_ELIGIBILITY_P3 =
  "You are responsible for the account you create and for keeping your password to " +
  "yourself. Tell the contact address below if you believe someone else has reached your " +
  "account.";

// § What you agree to

const TERMS_ACCEPTABLE_USE_HEADING = "What you agree to";

export const TERMS_ACCEPTABLE_USE_P1 = "In using Serenify, you agree to the following.";

export const TERMS_ACCEPTABLE_USE_ITEMS: readonly string[] = [
  "Point the camera at yourself, and only when you have chosen to start a calibration or a monitoring session. Do not capture other people.",
  "Do not use Serenify to observe, assess, or draw conclusions about another person.",
  "Do not attempt to reach another person's account, readings, or conversations.",
  "Do not attempt to work around the technical limits described in the Privacy Policy, or to extract data the system does not offer you.",
  "Do not upload anything unlawful, and do not use Serenify to harass anyone.",
];

export const TERMS_ACCEPTABLE_USE_P2 =
  "Serenify may be made unavailable to an account that is used in any of these ways.";

// § The consents you give

const TERMS_CONSENT_HEADING = "The consents you give";

export const TERMS_CONSENT_P1 =
  "Serenify asks for two separate consents, and keeps them separate on purpose.";

export const TERMS_CONSENT_ITEMS: readonly string[] = [
  "Terms and Privacy — accepting this document and the Privacy Policy. This is the basis on which Serenify is used at all, so declining it means the application is not available to you.",
  "Camera and inference — permission to capture webcam video for calibration and monitoring sessions and to run inference on it. Declining this blocks calibration and monitoring sessions, and nothing else. The weekly work-environment check-in and the companion conversation both keep working.",
];

export const TERMS_CONSENT_P2 =
  "Each acceptance is recorded as its own entry: which document you accepted, which " +
  "published revision of it you were shown, and when. Accepting a later revision adds an " +
  "entry; it never overwrites or erases an earlier one. That history is what makes it " +
  "possible to answer, later, exactly which wording you agreed to.";

export const TERMS_CONSENT_P3 =
  "Declining writes nothing at all. No record of the refusal is stored, nothing already " +
  "held is deleted, and no withdrawal state is written anywhere. Declining is a pause, " +
  "not a terminal decision: you can reach the same prompt again and accept it whenever " +
  "you want to.";

export const TERMS_CONSENT_P4 =
  "Withdrawing a consent you have already given is not yet built. Egyptian and European " +
  "law both require withdrawal to be as straightforward as giving consent, and Serenify " +
  "does not meet that standard today. Until it does, the way to stop Serenify processing " +
  "your data is to write to the contact address below. This gap is one of the reasons " +
  "qualified legal review is required before real user data is processed.";

// § Changes to these terms

const TERMS_CHANGES_HEADING = "Changes to these terms";

export const TERMS_CHANGES_P1 =
  "Each published revision of this document and of the Privacy Policy carries a version " +
  "identifier and a publication date, both shown at the top of the page you are reading. " +
  "A revision is classified by hand, at the time it is published, as either material or " +
  "cosmetic, and the reason is recorded alongside it in the project's source repository.";

export const TERMS_CHANGES_P2 =
  "A material revision changes what you are agreeing to, so everyone whose recorded " +
  "acceptance predates it is asked again before they can carry on using the application. " +
  "A cosmetic revision — a typo, a clearer sentence, a corrected link — changes nothing " +
  "you agreed to and asks nobody again. Which of the two a revision is, is a judgement " +
  "made by a person and written down, never inferred by comparing texts.";

export const TERMS_CHANGES_P3 =
  "While a material revision is waiting for your acceptance, you can still read this " +
  "document and the Privacy Policy in full, and you can still sign out. A consent you " +
  "cannot read your way out of is not consent.";

// § Availability

const TERMS_AVAILABILITY_HEADING = "Availability";

export const TERMS_AVAILABILITY_P1 =
  "Serenify is offered as it is, with no promise that it will be available, accurate, or " +
  "uninterrupted. It runs on hosted services that can fail, and inference can be wrong " +
  "in both directions — it can notice strain that is not there, and miss strain that is. " +
  "The interface is written to make that uncertainty visible rather than hide it.";

export const TERMS_AVAILABILITY_P2 =
  "Serenify may be changed, suspended, or shut down at any time. If the project ends, the " +
  "data it holds is deleted rather than transferred anywhere.";

// § Liability

const TERMS_LIABILITY_HEADING = "Liability";

export const TERMS_LIABILITY_P1 =
  "Serenify is a non-commercial project provided free of charge, and its provider accepts " +
  "no liability for loss arising from your use of it, to the extent the law allows that. " +
  "Nothing here limits liability that cannot lawfully be limited — including liability " +
  "for death or personal injury caused by negligence, and liability for fraud.";

export const TERMS_LIABILITY_P2 =
  "Your rights under Egypt's Consumer Protection Law No. 181 of 2018 and under Egypt's " +
  "Personal Data Protection Law No. 151 of 2020 are not affected by anything in this " +
  "document.";

// § Governing law

const TERMS_LAW_HEADING = "Governing law";

export const TERMS_LAW_P1 =
  "These terms are governed by the laws of the Arab Republic of Egypt, and the Egyptian " +
  "courts have jurisdiction over any dispute arising from them. Because personal data is " +
  "stored inside the European Union, the European General Data Protection Regulation also " +
  "applies to how that data is handled; the Privacy Policy explains what that means in " +
  "practice.";

// § Contact

const TERMS_CONTACT_HEADING = "Contact";

export const TERMS_CONTACT_P1 =
  "Questions about these terms, about your data, or about anything Serenify did that you " +
  "did not expect, go to Mohamed Asem at mohamedasem318@gmail.com. There is no support " +
  "desk behind that address — it reaches one person, who wrote this.";

/** The Terms of Service, in render order. Anchor ids are stable and linkable. */
export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: "what-serenify-is",
    heading: TERMS_WHAT_HEADING,
    blocks: [p(TERMS_WHAT_P1), p(TERMS_WHAT_P2), p(TERMS_WHAT_P3)],
  },
  {
    id: "not-medical-care",
    heading: TERMS_NOT_MEDICAL_HEADING,
    blocks: [p(TERMS_NOT_MEDICAL_P1), p(TERMS_NOT_MEDICAL_P2), p(TERMS_NOT_MEDICAL_P3)],
  },
  {
    id: "who-provides-serenify",
    heading: TERMS_PROVIDER_HEADING,
    blocks: [p(TERMS_PROVIDER_P1), p(TERMS_PROVIDER_P2)],
  },
  {
    id: "who-may-use-serenify",
    heading: TERMS_ELIGIBILITY_HEADING,
    blocks: [p(TERMS_ELIGIBILITY_P1), p(TERMS_ELIGIBILITY_P2), p(TERMS_ELIGIBILITY_P3)],
  },
  {
    id: "what-you-agree-to",
    heading: TERMS_ACCEPTABLE_USE_HEADING,
    blocks: [
      p(TERMS_ACCEPTABLE_USE_P1),
      list(TERMS_ACCEPTABLE_USE_ITEMS),
      p(TERMS_ACCEPTABLE_USE_P2),
    ],
  },
  {
    id: "the-consents-you-give",
    heading: TERMS_CONSENT_HEADING,
    blocks: [
      p(TERMS_CONSENT_P1),
      list(TERMS_CONSENT_ITEMS),
      p(TERMS_CONSENT_P2),
      p(TERMS_CONSENT_P3),
      p(TERMS_CONSENT_P4),
    ],
  },
  {
    id: "changes-to-these-terms",
    heading: TERMS_CHANGES_HEADING,
    blocks: [p(TERMS_CHANGES_P1), p(TERMS_CHANGES_P2), p(TERMS_CHANGES_P3)],
  },
  {
    id: "availability",
    heading: TERMS_AVAILABILITY_HEADING,
    blocks: [p(TERMS_AVAILABILITY_P1), p(TERMS_AVAILABILITY_P2)],
  },
  {
    id: "liability",
    heading: TERMS_LIABILITY_HEADING,
    blocks: [p(TERMS_LIABILITY_P1), p(TERMS_LIABILITY_P2)],
  },
  {
    id: "governing-law",
    heading: TERMS_LAW_HEADING,
    blocks: [p(TERMS_LAW_P1)],
  },
  {
    id: "contact",
    heading: TERMS_CONTACT_HEADING,
    blocks: [p(TERMS_CONTACT_P1)],
  },
];

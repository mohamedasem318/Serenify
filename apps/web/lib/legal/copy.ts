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
 * Terminology is binding (`plan.md` §11 header, amended 2026-08-12 — `docs/CHANGELOG.md`):
 * **calibration** = baseline capture · **monitoring session** = live camera inference,
 * and **"check-in" is the friendly name for exactly that** · **weekly work-environment
 * survey** = the text questionnaire. The questionnaire is NEVER called a check-in.
 *
 * That is the reverse of the rule this file shipped with, and it was reversed on purpose
 * (#198). The application's primary action has always read **Start check-in** and routes
 * to the camera; the documents said "monitoring session" and reserved "check-in" for the
 * questionnaire, so the product and its own legal text named the same button differently
 * and used the same noun for the one thing a reader most needs to tell apart — the one
 * that turns a camera on. The app wording is what users actually read, so the documents
 * moved to it rather than the other way round.
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
  "conversation with an in-app companion called Ren if you want one. Where the " +
  "application says check-in, it means exactly that: a monitoring session, with the " +
  "camera on. It also collects a short weekly work-environment survey, which is a text " +
  "questionnaire about your working conditions rather than about you, and which never " +
  "uses the camera.";

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

// § Who is legally responsible
//
// Kept deliberately separate from "Who built Serenify" below, as two sections with two
// anchors rather than two paragraphs under one heading. Legal responsibility and
// authorship are different things, and a document that runs them together either
// under-credits the people who built the project or over-assigns legal obligations to
// three of them. The structure is what makes the distinction hard to misread.

const TERMS_PROVIDER_HEADING = "Who is legally responsible";

export const TERMS_PROVIDER_P1 =
  "Serenify is provided by Mohamed Assem, as an individual. There is no company and no " +
  "legal entity behind it. He is also the data controller for the personal data Serenify " +
  "handles, and he can be reached at mohamedasem318@gmail.com.";

export const TERMS_PROVIDER_P2 =
  "He is the single point of legal responsibility for Serenify: the data controller under " +
  "Egypt's Personal Data Protection Law and under the General Data Protection Regulation, " +
  "the person these terms form an agreement with, and the person to write to about " +
  "anything in either document. That is a legal role with duties attached, and it rests " +
  "with him alone.";

// § Who built Serenify
//
// Credit, and explicitly NOT a controller designation. "Joint controller" is a defined
// status under both regimes with its own allocation of duties and liability; naming the
// team as authors must not be read as conferring it, so the section says so outright
// rather than leaving a reader to infer it.
//
// Spellings are FR-024's. Both legal documents use "Mohamed Assem" throughout — as the
// named controller and here as an author — so a reader never meets two spellings of the
// same person across the two roles. FR-046 writes the controller as "Mohamed Asem"; that
// single-s form is deliberately NOT used in either document. The landing page's team
// section keeps FR-024's full "Mohamed Assem Adel" and belongs to P7, not this phase.

const TERMS_AUTHORS_HEADING = "Who built Serenify";

export const TERMS_AUTHORS_P1 =
  "Serenify is a graduation project, and four people built it. Naming only the data " +
  "controller above would leave the impression that it is one person's work. It is not.";

export const TERMS_AUTHORS_ITEMS: readonly string[] = [
  "Mohamed Assem Adel",
  "Fatma Al-Zahraa Emad",
  "Hebatullah El Gazoly",
  "Gehad Mohamed",
];

export const TERMS_AUTHORS_P2 =
  "The project was supervised by Dr. Lamees Nasser and Dr. Safaa Mouneer.";

export const TERMS_AUTHORS_P3 =
  "This section is authorship, not data protection law. The three authors other than " +
  "Mohamed Assem are not data controllers, joint controllers, or processors of your " +
  "personal data, and nothing here makes them any of those — those are legal designations " +
  "that carry their own duties, and they rest with the controller named in the previous " +
  "section. Who built something and who is answerable for what it does with your data are " +
  "two different questions, and this document answers them separately on purpose.";

export const TERMS_AUTHORS_P4 =
  "Serenify was carried out in an academic setting. That context explains why the project " +
  "exists; it does not make the university a party to these terms, a controller of your " +
  "data, or answerable for anything Serenify does.";

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
  "Camera and inference — permission to capture webcam video for calibration and monitoring sessions and to run inference on it. Declining this blocks calibration and monitoring sessions, and nothing else. The weekly work-environment survey and the companion conversation both keep working.",
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
  "did not expect, go to Mohamed Assem at mohamedasem318@gmail.com. There is no support " +
  "desk behind that address — it reaches one person, who wrote this.";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Policy (T022)
// ─────────────────────────────────────────────────────────────────────────────

export const PRIVACY_TITLE = "Privacy Policy";

export const PRIVACY_LEDE =
  "Serenify points a camera at people and infers how stressed they are. That is a lot to " +
  "ask, so this document says exactly what happens to what it captures — what is sent, " +
  "what is thrown away, what is kept, and who can see it. Where a protection is not built " +
  "yet, it says so in the same breath as describing it.";

// § Who is responsible

const PRIVACY_CONTROLLER_HEADING = "Who is responsible";

export const PRIVACY_CONTROLLER_P1 =
  "The data controller is Mohamed Assem, as an individual, reachable at " +
  "mohamedasem318@gmail.com. There is no company and no legal entity. Serenify is a " +
  "non-commercial graduation project, and the same person who decided how your data is " +
  "handled is the person who answers that address.";

export const PRIVACY_CONTROLLER_P2 =
  "Serenify was built by four people, named in the Terms of Service under “Who built " +
  "Serenify”. Only Mohamed Assem is the data controller. The other three authors are " +
  "not controllers, joint controllers, or processors of your personal data — controller " +
  "is a legal role with duties attached, and here it belongs to one person, so there is " +
  "one person to hold to it.";

export const PRIVACY_CONTROLLER_P3 =
  "Serenify has no registered data protection officer. Given that it processes health-" +
  "related and biometric data, Egyptian law is likely to expect one. That is one of the " +
  "gaps qualified legal review would need to close.";

// § What Serenify handles

const PRIVACY_CATEGORIES_HEADING = "What Serenify handles";

export const PRIVACY_CATEGORIES_P1 = "Six kinds of data, and nothing else.";

export const PRIVACY_CATEGORIES_ITEMS: readonly string[] = [
  "Account — your name, your email address, and your role. This is what signing up creates.",
  "Calibration — a numeric vector derived from a short webcam capture, describing what your ordinary, unstressed face looks like, plus when it was taken and which model version read it. The video itself is not part of it.",
  "Monitoring session readings — a monitoring session is what the application calls a check-in. For each scored window of one, the time it was captured and a graded band: calm, uneasy, or tense. Where a window could not be scored, the reason is kept instead, such as low light or being out of frame.",
  "Weekly work-environment survey — your answers to a short questionnaire about your working conditions: an overall sentiment and, when it is negative, a roadblock and the kind of support you would want.",
  "Companion conversation — the messages you and Ren exchange, and the titles of those conversations.",
  "Consent records — for each consent you have accepted, which document it was, which published revision of it you were shown, and when. One entry per acceptance; accepting a later revision adds an entry rather than replacing the earlier one.",
];

export const PRIVACY_CATEGORIES_P2 =
  "Serenify sets cookies only to keep you signed in. There are no analytics cookies and " +
  "no advertising cookies, which is why the site has no consent banner to dismiss. Your " +
  "light or dark mode preference is remembered by your browser and is never sent anywhere.";

// § Your camera

const PRIVACY_CAMERA_HEADING = "What happens to your camera";

export const PRIVACY_CAMERA_P1 =
  "This is the part most worth reading closely, so it is written without hedging.";

export const PRIVACY_CAMERA_P2 =
  "Video is transmitted. During a calibration or a monitoring session, your browser " +
  "records short clips and uploads them to Serenify's inference service, which runs on " +
  "Microsoft Azure. The reading is not computed on your device, and this document will " +
  "not tell you otherwise.";

export const PRIVACY_CAMERA_P3 =
  "The clip is then deleted. The inference service writes each upload to a temporary file, " +
  "reads it, and deletes that file before the request ends — on every outcome, including " +
  "when the read fails, when the model errors, and when the request is abandoned partway. " +
  "The deletion is not a cleanup step that could be skipped; it is written so that it runs " +
  "whether or not anything went wrong, and there is a dedicated test whose only job is to " +
  "prove it still does.";

export const PRIVACY_CAMERA_P4 =
  "Video is never stored. There is no bucket, no table, and no file path where a clip " +
  "lands, and no interface anywhere in Serenify that could retrieve one. No human being " +
  "can view or replay your video — not a manager, not an administrator, not the person who " +
  "wrote this. That is not a policy anyone chose to follow; it is that the storage and the " +
  "retrieval path were never built.";

export const PRIVACY_CAMERA_P5 =
  "Your camera is only ever active while you are on a calibration or monitoring session " +
  "screen and have started one. Serenify never captures audio.";

/**
 * The word the application actually uses, defined in the section a reader opens when they
 * want to know what the camera does. It is stated here rather than left to the Terms
 * because this is the document someone reads to answer "which button turns the camera on".
 */
export const PRIVACY_CAMERA_P6 =
  "One word, so nothing here is ambiguous: where the application says check-in, it means " +
  "a monitoring session — the camera one. The weekly work-environment survey is text, and " +
  "is never called a check-in anywhere.";

// § What is kept

const PRIVACY_RETENTION_HEADING = "What is kept, and for how long";

export const PRIVACY_RETENTION_P1 =
  "From a monitoring session, only the derived reading survives: the time, and the graded " +
  "band. The model also produces a numeric probability behind that band, and it is worth " +
  "knowing that this number is deliberately withheld — the database is configured so that " +
  "even you cannot read your own probability, only the band it became. A stress score is " +
  "the kind of number that reads as more certain than it is, so nothing in Serenify shows " +
  "you one.";

export const PRIVACY_RETENTION_P2 =
  "Readings are kept for ninety days. Stated precisely, because the distinction matters: " +
  "that is a policy, not a mechanism. No purge job runs on a schedule today, and this " +
  "document does not promise one. Account data, calibration, questionnaire answers, and " +
  "conversations are kept while your account exists.";

export const PRIVACY_RETENTION_P3 =
  "Deleting your account removes everything attached to it. Every table that holds your " +
  "data is keyed to your account so that it goes when the account goes, rather than being " +
  "cleaned up afterwards by someone remembering to.";

// § Companion conversation

const PRIVACY_CHAT_HEADING = "Your conversations with Ren";

export const PRIVACY_CHAT_P1 =
  "Companion chat content and crisis disclosures never reach a manager, an administrator, " +
  "or an employer. That is permanent and unconditional. It is not a control waiting to be " +
  "built and it carries no caveat anywhere in this document, because it is not a setting — " +
  "the database rule that governs those rows admits exactly one reader, the account that " +
  "wrote them, and there is no second rule granting anyone else a way in.";

export const PRIVACY_CHAT_P2 =
  "Your conversation is sent to a language-model provider. Being precise about how much: " +
  "a single turn produces several separate requests, not one. Ren's reply is generated by " +
  "one; a second reads the exchange to judge whether it sounds like strain or like a " +
  "crisis; two more summarise the conversation and give it a title. Each of those carries " +
  "a window of the conversation itself — recent messages, not just the line you last " +
  "typed. Your first name is included too, in the instructions that tell Ren how to " +
  "address you.";

export const PRIVACY_CHAT_P3 =
  "Sent with them, when there is one, is a short hedged note about your most recent stored " +
  "reading. That note carries a band, never video and never a number. Nothing flows back " +
  "the other way: a stress band derived from a conversation is written only to that " +
  "conversation and never reaches any camera-side surface.";

export const PRIVACY_CHAT_P4 =
  "Serenify keeps your conversations so you can return to them. You can delete a " +
  "conversation, and deleting it removes its messages.";

// § Crisis

const PRIVACY_CRISIS_HEADING = "If a conversation turns to crisis";

export const PRIVACY_CRISIS_P1 =
  "If you disclose thoughts of suicide, self-harm, or harming someone else, Serenify " +
  "responds by showing you support resources — verified external services, chosen by " +
  "country where that is known. It does exactly that and nothing more.";

export const PRIVACY_CRISIS_P2 =
  "No notification is sent to a manager, an administrator, or an employer. None exists to " +
  "send. The recognition itself is never written down: it lives for the length of one " +
  "reply, decides whether to show you the support panel, and is gone. No column records " +
  "it, so no report could ever count it. Routing a mental-health crisis into an employer " +
  "chain is a permanent prohibition in this project, not a configuration.";

export const PRIVACY_CRISIS_P3 =
  "One thing that follows from how the recognition is made, and that you should not have " +
  "to work out for yourself: what you wrote is sent to the language-model provider. " +
  "Recognising a crisis is not something Serenify does on its own — it is one of the " +
  "several requests described above, and the words you typed are in it. Everything in the " +
  "paragraph before this one remains true: the result is never stored, never notifies " +
  "anyone, and never leaves a trace in your account. But the disclosure itself reaches a " +
  "third party in the ordinary course of you being answered, and a policy that stayed " +
  "quiet about that would be hiding the part that matters most.";

// § Weekly work-environment survey

const PRIVACY_WEEKLY_HEADING = "Weekly work-environment survey";

export const PRIVACY_WEEKLY_P1 =
  "The weekly work-environment survey asks about your working conditions, not about " +
  "you. It is a text questionnaire and it never uses the camera. It is treated as a " +
  "separate class of data from stress signals, and it is the one thing in Serenify " +
  "designed to reach a manager — but only ever as a count.";

export const PRIVACY_WEEKLY_P2 =
  "Answers are separated from identity before they are grouped, so what a manager would " +
  "see is how many people in a team gave each answer, never who gave which. An individual " +
  "attributed answer is not something the system declines to show; it is something the " +
  "grouping makes it unable to produce. The safeguard that makes this robust on very small " +
  "teams — suppressing a tally that is small enough to point at one person — is required " +
  "before real employee data is collected and is not built yet.";

// § Manager visibility (FR-048a) — the three passages, each carrying its own marker

const PRIVACY_MANAGER_HEADING = "What a manager can see";

export const PRIVACY_MANAGER_DEFAULT =
  "Serenify is designed so that a direct manager can see your stress-trend summary — " +
  "graded bands and trends derived after inference, never raw video and never conversation " +
  "content — by default, at the granularity Serenify calls summary only. That is the " +
  "design, and it is stated here plainly rather than softened, because a privacy promise " +
  "that quietly under-describes what a manager will eventually see becomes a lie the day " +
  "that view ships. No manager-facing surface is live today. There is no manager screen in " +
  "the application, and the database holds no rule that would let one person read another " +
  "person's readings or sessions — your readings are visible to you and to nobody else.";

export const PRIVACY_MANAGER_HIERARCHY =
  "In the designed end-state, a direct manager sees their own direct reports and no one " +
  "else; a skip-level manager, and anyone above them, sees aggregated organisation-wide " +
  "figures only and never an individual employee. No manager-facing surface is live today. " +
  "Neither of those views exists yet to be used or misused.";

export const PRIVACY_MANAGER_CONTROLS =
  "You are meant to control how much of that a manager would see. A three-position " +
  "privacy slider — full detail, summary only, or off during hours you choose — will set " +
  "the granularity, and a transparency view will show you exactly what your manager would " +
  "see, so that you never have to take this document's word for it. Both arrive with Serenify's " +
  "privacy-controls-and-transparency work. Neither is live yet. There is nothing to " +
  "configure today, and no setting you could change now would alter what anyone sees; " +
  "summary only is the default the slider will start from.";

export const PRIVACY_MANAGER_ADMIN =
  "One thing an administrator can read today, so it should not be a surprise: the account " +
  "directory — names, email addresses, and roles. That is the whole of it. An " +
  "administrator cannot read your readings, your sessions, your questionnaire answers, or " +
  "your conversations, and no rule anywhere would let them.";

// § Where the data lives

// Headings double as the in-page index labels, so they stay short enough to sit on ONE
// line inside a 44 px index row at 320 px (FR-053: no tap target whose label wraps).
const PRIVACY_PROCESSORS_HEADING = "Where your data lives";

export const PRIVACY_PROCESSORS_P1 =
  "Serenify runs on services operated by other companies. Each processes some of your " +
  "data on the controller's behalf.";

export const PRIVACY_PROCESSORS_ITEMS: readonly string[] = [
  "Supabase — the database and the sign-in system. Everything Serenify stores lives here: account details, calibration, readings, questionnaire answers, conversations, and consent records. Hosted inside the European Union, in Frankfurt, Germany.",
  "Microsoft Azure — the inference service that reads webcam video and returns a band. Runs on Azure Container Apps inside the European Union. Video passes through it and is deleted there; nothing about a clip is stored.",
  "Groq — the language-model provider behind Ren. The conversation content described above is sent there, in several requests per turn, to generate each reply and to score it. Groq operates from the United States, so a companion conversation leaves the European Union in a way nothing else in Serenify does. If Groq is unavailable the request simply fails and Ren cannot answer: nothing else stands in, and your conversation is not quietly rerouted to some other model.",
  "Vercel — serves the web application you are reading this on.",
  "Resend — sends the two account emails: address confirmation and password reset.",
  "Cloudflare — domain routing and network delivery.",
];

export const PRIVACY_PROCESSORS_P2 =
  "Serenify runs no product analytics, no advertising trackers, and no third-party session " +
  "recording. Nothing on this site is profiling you, and no data is sold or shared with " +
  "anyone for their own purposes.";

// § Egyptian law

const PRIVACY_EGYPT_HEADING = "Egyptian law";

export const PRIVACY_EGYPT_P1 =
  "Egypt's Personal Data Protection Law No. 151 of 2020, with the executive regulations " +
  "issued under Ministerial Decision No. 816 of 2025, governs this processing. Two things " +
  "make that regime strict rather than routine here. An inference about your psychological " +
  "state is health-related data, and a face captured on video is biometric data. Both are " +
  "sensitive personal data under the law, and both attract a requirement of explicit " +
  "written consent and heightened security.";

export const PRIVACY_EGYPT_P2 =
  "Serenify also transfers personal data outside Egypt: everything it stores is held in " +
  "the European Union. Egyptian law requires a controller licence from the Personal Data " +
  "Protection Centre, and a separate permit before personal data may be transferred abroad. " +
  "Serenify holds neither. When this was written the Centre's licensing portal was not yet " +
  "operational, and enforcement of the executive regulations is expected from around " +
  "November 2026.";

export const PRIVACY_EGYPT_P3 =
  "Serenify is a demonstration build and is not processing real employee data. Obtaining " +
  "those licences, and the qualified legal review that would tell us what else is missing, " +
  "is part of what has to happen before it does.";

// § European law

const PRIVACY_EU_HEADING = "European law";

export const PRIVACY_EU_P1 =
  "Because the database sits in Frankfurt, the General Data Protection Regulation applies " +
  "to the data held there. The lawful basis Serenify relies on is your consent, asked for " +
  "separately for the two things that need it, and recorded against the specific revision " +
  "of the wording you were shown.";

export const PRIVACY_EU_P2 =
  "Serenify makes no automated decision that produces a legal or similarly significant " +
  "effect about you. A reading is shown to you, and nothing is decided on the strength of " +
  "it. No account is restricted, no report is raised, and nothing is escalated to anyone.";

// § Your rights

const PRIVACY_RIGHTS_HEADING = "Your rights";

export const PRIVACY_RIGHTS_P1 =
  "Under both regimes you can ask for the following.";

export const PRIVACY_RIGHTS_ITEMS: readonly string[] = [
  "A copy of the personal data Serenify holds about you.",
  "Correction of anything inaccurate.",
  "Deletion of your data.",
  "Restriction of processing, or objection to it.",
  "Withdrawal of a consent you previously gave.",
  "A complaint to Egypt's Personal Data Protection Centre, or to a European supervisory authority.",
];

export const PRIVACY_RIGHTS_P2 =
  "Said plainly: none of these is automated. There is no self-service export button and no " +
  "consent-management screen. Exercising any of these rights means writing to " +
  "mohamedasem318@gmail.com, and it will be done by hand. Both regimes expect withdrawing " +
  "consent to be as easy as giving it, and an email is not as easy as a checkbox. That gap " +
  "is real, it is not being hidden here, and it belongs on the list of things to fix before " +
  "real user data is processed.";

// § Security

const PRIVACY_SECURITY_HEADING = "How your data is protected";

export const PRIVACY_SECURITY_P1 =
  "Access control is enforced in the database rather than in application code, which " +
  "matters because it means a bug in a screen cannot widen it. Every table that holds " +
  "personal data carries a rule tying each row to the account that owns it, and those " +
  "rules are applied even to the database's own owner. Consent records go further: they " +
  "can be created and read by their owner and by no one else, and they cannot be edited or " +
  "deleted at all, by anyone.";

export const PRIVACY_SECURITY_P2 =
  "Data is encrypted in transit and at rest by the hosting providers. Serenify is a " +
  "student project rather than a hardened production system, and it has had no independent " +
  "security audit.";

// § Children

const PRIVACY_CHILDREN_HEADING = "Children";

export const PRIVACY_CHILDREN_P1 =
  "Serenify is not designed for children and is not offered to anyone under eighteen. " +
  "Egyptian law requires a guardian's explicit written consent before the personal data of " +
  "anyone under fifteen is processed. Serenify has no flow that could obtain or record " +
  "such consent, and it performs no age verification at all. If you believe a child has " +
  "created an account, write to the address below and it will be deleted.";

// § Evaluation

const PRIVACY_EVALUATION_HEADING = "How the model was evaluated";

export const PRIVACY_EVALUATION_P1 =
  "The model behind the readings was trained and evaluated on the StressID dataset, from " +
  "Inria and EURECOM, under a non-commercial academic licence permitting research and " +
  "demonstration only. That licence is why Serenify is not and cannot be commercialised " +
  "while it uses this model.";

export const PRIVACY_EVALUATION_P2 =
  "Evaluation was subject-disjoint: the people whose recordings the model was tested " +
  "against never appeared in the recordings it was trained on. That is the honest way to " +
  "measure this kind of model, because the easy mistake — testing on faces the model has " +
  "already learned — produces a flattering result that says nothing about a stranger.";

export const PRIVACY_EVALUATION_P3 =
  "No performance figures appear anywhere on this site, deliberately. A single number " +
  "invites a confidence the method does not support, and a reading you are shown is a " +
  "signal to consider, not a measurement to trust.";

export const PRIVACY_EVALUATION_P4 =
  "No imagery from that dataset is shown anywhere in Serenify. Twelve of its participants " +
  "withheld consent for their images to be reused, and their recordings appear in no " +
  "screen, screenshot, or figure this project produces.";

// § Not operating today (FR-049)

const PRIVACY_FORWARD_HEADING = "Planned, and not operating today";

export const PRIVACY_FORWARD_P1 =
  "This section exists so that nothing above has to be read as a quiet promise about the " +
  "future. Each of these is designed and none of it runs.";

export const PRIVACY_FORWARD_ITEMS: readonly string[] = [
  "Audio and physiological signals — the design anticipates reading tone of voice and heart-rate-derived signals alongside video. Neither is captured today. Serenify never accesses a microphone or any sensor.",
  "Manager dashboards — the views described under what a manager can see. No manager-facing surface is live today.",
  "The three-position privacy slider and the transparency view — the controls described under what a manager can see. Neither is live yet.",
  "Suppression of small-team tallies in the weekly work-environment survey — required before real employee data is collected, and not built.",
  "Self-service export, deletion, and consent withdrawal — described under your rights, and handled by hand today.",
];

// § Changes

const PRIVACY_CHANGES_HEADING = "Changes to this policy";

export const PRIVACY_CHANGES_P1 =
  "Every published revision of this document carries a version identifier and a " +
  "publication date, shown at the top of this page, and the whole history is kept in the " +
  "project's public source repository where any revision can be read as it stood. A " +
  "revision that changes what you agreed to is classified as material, by a person, at the " +
  "time it is published — and everyone whose recorded acceptance predates it is asked " +
  "again. A revision that only clarifies wording asks nobody again.";

export const PRIVACY_CHANGES_P2 =
  "If a future change makes this document say something less protective than it says " +
  "today, that change is a material one by definition, and you will be asked before it " +
  "applies to you.";

// § Contact

const PRIVACY_CONTACT_HEADING = "Contact";

export const PRIVACY_CONTACT_P1 =
  "For anything in this document, to exercise a right, or to report something Serenify did " +
  "that you did not expect: Mohamed Assem, mohamedasem318@gmail.com. It reaches one person, " +
  "who wrote this.";

/**
 * FR-048a mechanism — the passages that describe manager visibility.
 *
 * Every member MUST contain one of `NOT_YET_LIVE_MARKERS` within its own text, asserted by
 * `tests/unit/lib/legal/copy-invariants.test.ts`. A marker in a distant forward-looking
 * section does not satisfy the requirement and does not satisfy the test: a reader who
 * reads only the paragraph in front of them must not come away believing a manager can see
 * their trend today.
 *
 * `PRIVACY_MANAGER_ADMIN` is deliberately NOT a member. It describes what an administrator
 * can read **today** — the account directory, and nothing else — which is a live fact
 * rather than a description of manager visibility, so a not-yet-live marker would make it
 * false. `PRIVACY_CHAT_P1` and the crisis passages are likewise absent, and must stay
 * absent: those are Principle I invariants stated unconditionally (FR-001), and marking
 * them not-yet-live would be the other-direction flattening Amendment 17 forbids.
 */
export const MANAGER_VISIBILITY_PASSAGES: readonly string[] = [
  PRIVACY_MANAGER_DEFAULT,
  PRIVACY_MANAGER_HIERARCHY,
  PRIVACY_MANAGER_CONTROLS,
];

/**
 * The approved not-yet-live marker phrases. Each appears verbatim, as a whole sentence,
 * inside the passage it qualifies. The voice is the one
 * `components/account/privacy-placeholder.tsx:23–27` already models — name the control,
 * say what it will let the person do, and close with the fact that there is nothing to
 * configure yet. That existing string is compliant and MUST NOT be "corrected".
 */
export const NOT_YET_LIVE_MARKERS: readonly string[] = [
  "No manager-facing surface is live today.",
  "Neither is live yet.",
];

/** The Privacy Policy, in render order. Anchor ids are stable and linkable. */
export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: "who-is-responsible",
    heading: PRIVACY_CONTROLLER_HEADING,
    blocks: [p(PRIVACY_CONTROLLER_P1), p(PRIVACY_CONTROLLER_P2), p(PRIVACY_CONTROLLER_P3)],
  },
  {
    id: "what-serenify-handles",
    heading: PRIVACY_CATEGORIES_HEADING,
    blocks: [p(PRIVACY_CATEGORIES_P1), list(PRIVACY_CATEGORIES_ITEMS), p(PRIVACY_CATEGORIES_P2)],
  },
  {
    id: "what-happens-to-your-camera",
    heading: PRIVACY_CAMERA_HEADING,
    blocks: [
      p(PRIVACY_CAMERA_P1),
      p(PRIVACY_CAMERA_P2),
      p(PRIVACY_CAMERA_P3),
      p(PRIVACY_CAMERA_P4),
      p(PRIVACY_CAMERA_P5),
      p(PRIVACY_CAMERA_P6),
    ],
  },
  {
    id: "what-is-kept",
    heading: PRIVACY_RETENTION_HEADING,
    blocks: [p(PRIVACY_RETENTION_P1), p(PRIVACY_RETENTION_P2), p(PRIVACY_RETENTION_P3)],
  },
  {
    id: "your-conversations",
    heading: PRIVACY_CHAT_HEADING,
    blocks: [
      p(PRIVACY_CHAT_P1),
      p(PRIVACY_CHAT_P2),
      p(PRIVACY_CHAT_P3),
      p(PRIVACY_CHAT_P4),
    ],
  },
  {
    id: "crisis",
    heading: PRIVACY_CRISIS_HEADING,
    blocks: [p(PRIVACY_CRISIS_P1), p(PRIVACY_CRISIS_P2), p(PRIVACY_CRISIS_P3)],
  },
  {
    // Anchor id deliberately NOT renamed alongside the heading (#198). Anchor ids are
    // stable, citable links — `/privacy#weekly-work-environment-check-in` may already be
    // written down somewhere — and #198 is a copy change, not an identifier change.
    id: "weekly-work-environment-check-in",
    heading: PRIVACY_WEEKLY_HEADING,
    blocks: [p(PRIVACY_WEEKLY_P1), p(PRIVACY_WEEKLY_P2)],
  },
  {
    id: "what-a-manager-can-see",
    heading: PRIVACY_MANAGER_HEADING,
    blocks: [
      p(PRIVACY_MANAGER_DEFAULT),
      p(PRIVACY_MANAGER_HIERARCHY),
      p(PRIVACY_MANAGER_CONTROLS),
      p(PRIVACY_MANAGER_ADMIN),
    ],
  },
  {
    id: "where-your-data-lives",
    heading: PRIVACY_PROCESSORS_HEADING,
    blocks: [p(PRIVACY_PROCESSORS_P1), list(PRIVACY_PROCESSORS_ITEMS), p(PRIVACY_PROCESSORS_P2)],
  },
  {
    id: "egyptian-law",
    heading: PRIVACY_EGYPT_HEADING,
    blocks: [p(PRIVACY_EGYPT_P1), p(PRIVACY_EGYPT_P2), p(PRIVACY_EGYPT_P3)],
  },
  {
    id: "european-law",
    heading: PRIVACY_EU_HEADING,
    blocks: [p(PRIVACY_EU_P1), p(PRIVACY_EU_P2)],
  },
  {
    id: "your-rights",
    heading: PRIVACY_RIGHTS_HEADING,
    blocks: [p(PRIVACY_RIGHTS_P1), list(PRIVACY_RIGHTS_ITEMS), p(PRIVACY_RIGHTS_P2)],
  },
  {
    id: "how-your-data-is-protected",
    heading: PRIVACY_SECURITY_HEADING,
    blocks: [p(PRIVACY_SECURITY_P1), p(PRIVACY_SECURITY_P2)],
  },
  {
    id: "children",
    heading: PRIVACY_CHILDREN_HEADING,
    blocks: [p(PRIVACY_CHILDREN_P1)],
  },
  {
    id: "how-the-model-was-evaluated",
    heading: PRIVACY_EVALUATION_HEADING,
    blocks: [
      p(PRIVACY_EVALUATION_P1),
      p(PRIVACY_EVALUATION_P2),
      p(PRIVACY_EVALUATION_P3),
      p(PRIVACY_EVALUATION_P4),
    ],
  },
  {
    id: "planned-and-not-operating-today",
    heading: PRIVACY_FORWARD_HEADING,
    blocks: [p(PRIVACY_FORWARD_P1), list(PRIVACY_FORWARD_ITEMS)],
  },
  {
    id: "changes-to-this-policy",
    heading: PRIVACY_CHANGES_HEADING,
    blocks: [p(PRIVACY_CHANGES_P1), p(PRIVACY_CHANGES_P2)],
  },
  {
    id: "privacy-contact",
    heading: PRIVACY_CONTACT_HEADING,
    blocks: [p(PRIVACY_CONTACT_P1)],
  },
];

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
    id: "who-is-legally-responsible",
    heading: TERMS_PROVIDER_HEADING,
    blocks: [p(TERMS_PROVIDER_P1), p(TERMS_PROVIDER_P2)],
  },
  {
    id: "who-built-serenify",
    heading: TERMS_AUTHORS_HEADING,
    blocks: [
      p(TERMS_AUTHORS_P1),
      list(TERMS_AUTHORS_ITEMS),
      p(TERMS_AUTHORS_P2),
      p(TERMS_AUTHORS_P3),
      p(TERMS_AUTHORS_P4),
    ],
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

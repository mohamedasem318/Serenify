# Contract — team section, legal documents, public shell

**Feature**: 013-public-surface-and-legal | **Plan**: [../plan.md](../plan.md) §9 | **Approved copy**: [../plan.md](../plan.md) §10.3 | **Hero card**: [landing-hero-story.md](./landing-hero-story.md)

The rest of the public surface: the team section and its silhouette overlay, the two legal documents and the mechanism that keeps FR-048a honest, and the public navbar and footer. Section numbers are the plan's own; the full map is in `plan.md` §4.1.

**The footer's approved copy line is fixed verbatim in `plan.md` §10.3 and is not restated here.**

---

## §9.2 Team section (FR-024–FR-028)

**Silhouettes — copied verbatim, then frozen.** `apps/web/lib/landing/team-silhouettes.ts` holds the four `SIL` path strings copied character-for-character from `docs/mockups/serenify-landing-mock.html:671`. Re-deriving, re-tracing, or regenerating them by any means is forbidden (FR-026). Two unit guards make that enforceable rather than aspirational:
- each path's exact character length and SHA-256 are asserted against frozen constants — any edit, including a "harmless" reformat, fails CI;
- the x-ranges are asserted strictly ascending in the order `mohamed < fatma < hebatullah < gehad`, so a key swap fails CI (see §0.2).

**The coordinate space is a hard constraint, not a preference.** The `SIL` paths are normalised to a `viewBox="0 0 100 100"` overlay with `preserveAspectRatio="none"`, stretched across the mock's embedded photo — which is **exactly 1600×1164**. That is verifiable: the base64 image at `:624` decodes to 1600×1164, and re-cropping the original (`y = 1100…3300`, full width, downscaled to 1600×1164) reproduces it to a mean per-channel difference of 3.86/255 — JPEG recompression noise, not a different crop. Therefore:
- the shipped asset **must** be that crop, and
- the overlay **must** use `preserveAspectRatio="none"` over a box with the photo's exact aspect ratio. Any other value misaligns every outline.

**The photo.** `apps/web/public/IMG-20260706-WA0054.jpg` (3024×4032, 1.24 MB) → crop `y = 1100…3300` at full width → downscale to **1600×1164** → save as **`apps/web/public/team/serenify-team-2026.jpg`**. The 1.24 MB original is deleted from `public/`; nothing references it and it must not ship.

*Placement convention (inspected, not guessed):* `apps/web/public/` root holds Next scaffolding leftovers (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) and app-level icons consumed by the manifest (`icon-192.png`, `icon-512.png`). The only feature-scoped asset group in the repo is the subdirectory **`public/face-detect/`** (the self-hosted MediaPipe model and WASM). A named subdirectory is therefore the established convention for a feature's assets, and `public/team/` follows it.

**The project poster is visible in the photo and shows model performance figures.** FR-004 accepts this explicitly and forbids cropping or editing them out. The crop above is applied unchanged.

**Rendering.** `next/image` with explicit `width={1600} height={1164}` and `className="h-auto w-full"`, so the container box carries the photo's exact aspect ratio and the `preserveAspectRatio="none"` overlay aligns at every width. (`next/image` avoids the `@next/next/no-img-element` lint rule that the OG route has to disable; CSP `img-src 'self'` already covers `/_next/image`.) If the photo fails to load, the four name cards and the supervisor credits are separate DOM and remain readable and usable.

**Name cards.** Four cards, verbatim names, fixed left-to-right order per FR-024, each with a real GitHub and LinkedIn link. The mock's inert `href="#"` placeholders must not ship. Each of the eight links carries an accessible name identifying **both** the person and the destination — `aria-label="Mohamed Assem Adel on GitHub"`, `"Mohamed Assem Adel on LinkedIn"`, and so on — so a screen-reader link list distinguishes all eight. A unit test asserts eight links, eight distinct accessible names, and zero `href="#"`.

**Caption**, verbatim: **"Choose a name to find them in the photo."**

**Bidirectional highlighting, no hover dependency.** Each name card is a `<button>` with `aria-pressed`, so pointer, touch, and keyboard (Enter/Space) all set the active person and the highlight **persists** — which is how the mapping is obtainable without hover (SC-009). Hover and focus also preview it. The silhouette paths carry pointer handlers for the photo→card direction (FR-025) while the overlay stays `aria-hidden`, because the cards are the accessible route and duplicating them in the SVG would double every person in the tab order.

**Supervisors**, verbatim: **Dr. Lamees Nasser · Dr. Safaa Mouneer**.

---

## §9.3 Legal documents (FR-044–FR-050)

**Routes.** `app/(public)/terms/page.tsx` and `app/(public)/privacy/page.tsx`, rendered through a shared `components/legal/legal-document.tsx` (title, version id + publication date from the registry, section anchors, and the unmissable no-legal-review banner). Plain TSX with Graphite tokens — no MDX dependency, no typography plugin, full token control, and the text sits in git where FR-039's provenance chain needs it.

**Substance** — real text grounded in this system's actual data flows, not a template:

- **Egypt Law 151/2020** (personal data protection; health and biometric-adjacent processing), **EU/GDPR** (personal data resides in Supabase **Frankfurt**), and the **Azure** processing footprint (inference on Azure Container Apps).
- **Controller: Mohamed Asem, as an individual** — there is no legal entity — at **`mohamedasem318@gmail.com`**. No placeholder remains.
- Webcam-derived inference: video **is transmitted** for inference, **is deleted on every outcome including errors**, is **never persisted**, and **no human, including an admin, can view or replay it**. *(Verified in code: `apps/api/app/services/inference.py:267–271` and `app/routers/anchor.py:73–76` both `os.unlink` the temp clip in a `finally` block; `apps/api/tests/test_privacy.py` is the dedicated gate; there is no storage path and no retrieval surface.)*
- Only the **derived reading** is stored (`window_readings`), retained **90 days as a matter of policy**, with **no** claim of an automated purge (FR-003).
- **Companion chat is employee-private** *(verified: chat RLS is self-only — `apps/api/tests/test_chat_storage_rls.py`)*. **Crisis disclosures** are never persisted, never notify any manager, admin, or employer, and route only to verified external resources *(verified: `components/chat/crisis-panel.tsx` is a render-only payload with no persisted flag)*.
- **Evaluation was subject-disjoint** — the method named, **zero numbers** (FR-004).
- An **unmissable** statement that this is an **informed draft prepared without qualified legal review**, and that such review is required before any real (non-demo) user data is processed. Rendered at the top of both documents in a bordered notice, not a footnote.
- A clearly marked **forward-looking section** naming audio and physiological modalities, manager dashboards, and feature 018's three-position privacy slider and transparency view as **not operating today**.

**FR-048a — manager visibility, with the marker at the point of use.** This is the requirement most likely to be satisfied sloppily, so it gets a mechanism:

1. Every string in both documents lives in `apps/web/lib/legal/copy.ts` as a named exported constant. Landing strings live in `lib/landing/copy.ts`. Two files are the entire copy review surface.
2. The subset that describes manager visibility is exported as a named list, `MANAGER_VISIBILITY_PASSAGES`.
3. A unit test asserts **every** member of that list contains one of the approved not-yet-live marker phrases **within its own text**. A marker in a distant forward-looking section cannot satisfy the test, exactly as FR-048a requires. This is a membership check over named constants, not a regex heuristic over prose, so it has no false positives.
4. A second test asserts the two forbidden claim families produce zero matches across **every** exported string in both copy modules, with the mock's three literals included as explicit negative fixtures.

The content itself: stress-trend summaries **are** visible to a direct manager, by default, at `summary only` granularity — stated plainly, never softened, never buried — with the fact that **no manager-facing surface is live today** in the same passage, and the description framed as the designed end-state. Unqualified present tense is forbidden. A direct manager sees their direct reports only; skip-level and above see aggregated org-wide data only. Companion chat content and crisis disclosures **never** reach a manager, admin, or employer — permanently, unconditionally, no marker needed, because that is a Principle I invariant rather than an unbuilt control.

*The account page's existing privacy placeholder (`components/account/privacy-placeholder.tsx:23–27`) models the required voice — it names the control, says what it will let the person do, and closes with the fact that there is nothing to configure yet. **That string is compliant and must not be "corrected".***

**FR-050.** Every factual statement is cross-checked against Principle I and the implementation. The verified claim inventory above is the result of that pass; §0.3 is the one discrepancy found, and it is in an adjacent text rather than in either document.

---

## §9.4 Public shell — navbar and footer

`components/public/public-navbar.tsx` visually matches the app header — same 64 px height, same `border-b border-border`, same **non-translucent `bg-bg`**, same wordmark size and theme toggle placement — while being a **separate component** with its own nav items and **no dashboard or authed links** (FR-018). Its mobile hamburger reuses the app's existing pattern: the Radix `Sheet` with a `SheetTrigger` labelled "Open menu", `side="left"`, `bg-bg`, and `SheetClose`-wrapped links, mirroring `components/header/mobile-menu.tsx` (FR-019).

`components/public/public-footer.tsx` links to `/privacy` and `/terms` and appears on the public surface (FR-023).

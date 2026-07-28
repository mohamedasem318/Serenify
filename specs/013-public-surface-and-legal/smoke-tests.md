# Smoke Tests: Public Surface and Legal (Feature 013)

**Status: NOT YET RUN.** Authored by T131; run by **Mohamed** (T132).

These are the checks **automation cannot catch** — the ones that need a real human eye, a
real device, a real inbox, or a judgement call no repository artefact can settle. They are
transcribed **verbatim** from [`plan.md`](./plan.md) §13; the wording of each *Check* is the
plan's wording and must not be re-worded here. Where a check needed more procedure than a
table cell holds — **ST-10a** and **ST-10b** especially — that procedure is part of the
check and is reproduced in full.

**Owner: Mohamed.** Results are recorded **inline in this file**, and **all of them are
recorded before `013-public-surface-and-legal` merges to `main`** — constitution
Principle VII, gate 5.

**How to record a result.** Each check below carries three fields:

- **Result** — `PASS`, `FAIL`, or `NOT RUN`. A `FAIL` needs a filed defect (issue number)
  beside it; a check that was not run says `NOT RUN` and says why. An inferred pass is not
  a pass: unit tests passing is not evidence for anything in this file.
- **Date** — when it was actually run.
- **Observations** — what was seen. Free text, and the most valuable field here: the
  screenshot taken, the number counted, the log line pasted, the thing that looked slightly
  off. "Looks fine" is not an observation.

**Some of these are explicitly not an agent's to sign off.** ST-4 (Ren's orb) and ST-7 (the
silhouette identity) are Mohamed's calls and nothing in the repository can establish them.
ST-2, ST-3, ST-8, ST-11 and ST-13 need a real inbox, a real phone, a real deployment, a
device that has never granted camera permission, and a careful end-to-end read — none of
which an agent can stand in for. Where an agent has run a check, the Observations field
says exactly **how** it was run, so the method can be judged alongside the result.

---

## ST-1

Two-colour wordmark reads correctly at all five in-tree sites (public navbar, public footer, app header, auth pages, onboarding) in **both** themes, at 320 px and desktop. `seren` ink / `ify` meadow-text, lowercase, no dot. This is a **visible change** to three surfaces that shipped single-colour.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-2

The two hand-sync exceptions match by eye: fetch the OG card, and trigger a **real** confirmation email and a **real** recovery email, viewed in a light client and a dark client.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-3

Hero story, full ~42 s cycle on a real phone at 320 / 375 / 414 and a tablet at 768: the false-alarm beat resolves **before** any companion beat; nothing clips; no scrollbar appears inside the card; the card does not resize when the thread trims to 4.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-4

Ren's blue orb (foggy) reads as intended and calm next to the meadow/amber band states — **FR-022 approved liberty; do not "correct" it to the monitor's band colouring.** Mohamed's aesthetic call.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-5

Reduced motion toggled at the **OS level mid-session**: the story stops auto-advancing immediately (proving the hook re-subscribes rather than snapshotting at mount), no transition plays, the readout stays visible, chapter markers still work.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-6

Scroll the hero out of view and back: the story pauses and resumes, and does **not** jump or double-advance on return.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-7

**Silhouette identity** — Mohamed confirms the inner-right outline highlights **Hebatullah** and the outer-right highlights **Gehad** (§0.2: the one fact no repository artefact can establish). Also: all four outlines register on a real touch screen.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-8

Root route on a real deployment: a signed-in visitor at `/` reaches the app without re-authenticating; a **real** Supabase email link landing on `/` with `?code=` completes the sign-in.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-9

Signup gate end to end, including **with JavaScript disabled** (the `signUpFromForm` progressive-enhancement path): unchecked → blocked with a reason and no account; opening `/terms` and `/privacy` loses no entered data; checked → account created and exactly one consent row exists.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-10

App-shell gate: publish a **material** revision locally → sign in → blocked; **read both documents in full**; **sign out** works; accept → unblocked, with the earlier row still present. Then **exercise both revert levers** — flip `CONSENT_ENTRY_GATE_ENABLED=false`, and separately `git revert` the gate commit — and confirm the app is fully usable after each. An untested kill switch is not a kill switch. **Then run ST-10a**, which exercises the same two levers against the failure mode most likely to require them.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-10a

**Silent-empty read → universal lockout, and both levers recover from it.** The §7.3 fail-open branch triggers on `null` or an **error**. The more likely RLS defect returns **zero rows with no error at all** — `auth.uid()` resolving to null in some server context, so `user_consents_select_self` matches nothing. That reads as "this user has no consent", sets `blocked = true`, and locks out **every** user — and fail-open never fires, because nothing failed. **Induce it without an error**: in a local psql session, `ALTER POLICY user_consents_select_self ON public.user_consents USING (false);` (or otherwise make `auth.uid()` fail to resolve in the server context) — the `SELECT` still succeeds, it just returns nothing. Then confirm: (a) an authenticated user is blocked by the re-consent screen even though their consent row exists; (b) the lockout is **reproducible** — a second user and a second session are blocked identically, so this is not a one-request blip; (c) **`[consent-gate] FAIL-OPEN` does *not* appear** in the server log for those requests, which is the whole point — this failure is silent to the mitigation ST-10b verifies. Then confirm **both** revert levers recover a fully usable app **from this exact state**, each tested from the locked-out condition: `CONSENT_ENTRY_GATE_ENABLED=false` + redeploy, and separately `git revert` of the **P5** gate commit. Restore the policy afterwards and confirm the gate behaves correctly again. The levers already cover this failure mode by design (§7.3, R2); what is being verified here is that they have actually been exercised against it.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-10b

**Fail-open is observable.** Induce a persistent consent read failure (e.g. `REVOKE SELECT ON public.user_consents FROM authenticated` in a local psql session, or point the client at a renamed column), then load an authed route. Confirm the app **stays usable** (fail-open works) **and** that `[consent-gate] FAIL-OPEN` appears in the server log for that request. Restore the grant and confirm the log stops. A gate that can switch itself off in silence is the failure nobody reports — §7.3, R2.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-11

Camera gate: on a device that has **never** granted camera permission, confirm the browser's permission prompt does **not** appear until after consent is given — at `/onboarding`, at `/app/calibrate`, and at `/app/monitor`.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-12

Decline the camera consent, then complete a **weekly work-environment check-in** on `/app`. It works normally. Existing readings and sessions are still visible.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-13

Mohamed reads `/terms` and `/privacy` end to end against FR-048a: manager visibility stated plainly, never softened or buried, with its not-yet-live marker **in the same passage**; the no-legal-review notice is unmissable; zero performance figures.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-14

Team section with the photo **blocked** (DevTools request blocking) and on a throttled connection: name cards, links, and supervisor credits remain readable and usable; layout does not collapse.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

## ST-15

All eight external links open the correct real GitHub and LinkedIn profiles.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: —

---

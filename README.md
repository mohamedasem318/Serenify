# Serenify

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
[![License: non-commercial academic](https://img.shields.io/badge/license-non--commercial%20academic-3b82f6)](#license)
[![Live: serenify.tech](https://img.shields.io/badge/live-serenify.tech-6d28d9)](https://serenify.tech)

**Workplace stress, gently noticed.** A privacy-first web app that helps employees notice and reflect on work stress — without turning it into surveillance. Live at **[serenify.tech](https://serenify.tech)**.

Serenify reads short, calibrated webcam monitoring sessions for signs of stress, confirms with a light questionnaire, offers a supportive chat companion, and shows each person their own trend over time. Managers are designed to see graded trends for their reports; no manager-facing surface is live today. Raw video and chat content never reach a manager — that one is permanent, and true right now.

Most workplace-wellbeing tools are either surveys nobody fills in or monitoring nobody consented to. The bet here is that stress signals should reach the *person feeling them* — "be heard and felt," not "be watched." So privacy is the architecture, not a setting:

- **Raw video never leaves the inference layer** — managers get graded bands, aggregates, and trends, computed downstream of the model, never the frames. That manager view is the designed end-state; no manager-facing surface is live today.
- **Bounded visibility** — a direct manager sees only their own reports; skip-level and above see anonymized org-wide aggregates. This describes the designed end-state; no manager-facing surface is live today.
- **Private companion chat** — conversations are employee-private and never reach an employer; crisis disclosures are never persisted and never notify anyone.
- **Employee-controlled granularity** — a three-position privacy slider: full detail, summary only, or off during set hours. The slider and the transparency view arrive with feature 018; there's nothing to configure yet.

## How it works

1. **Detect** — a one-time calibration anchors the model to *your* baseline; sessions then score 60-second windows server-side into a smoothed three-band read (calm / a little tense / tense). No probability or raw signal reaches the browser.
2. **Confirm** — when a tense pattern sustains, a short, calm prompt asks you to confirm. The model never has the last word alone.
3. **Talk** — "Ren," a supportive LLM companion for reflection, with live-only crisis-resource escalation. Private to the employee.
4. **Reflect** — your own session trend and history, in a fixed-pixel SVG chart built to read honestly at a glance.

## The model

Video-only stress classification — LBP-TOP + motion features → RandomForest, with per-user delta calibration (each reading is a delta from your own baseline, not an absolute score). Evaluated **subject-disjoint**: Leave-One-Subject-Out across all 53 StressID subjects, i.e. tested on people never seen in training.

| Metric (LOSO, 53 subjects) | Value |
|---|---|
| Macro-F1 | 0.718 |
| Mean accuracy | 0.733 (± 0.157) |
| Recall — stressed | 0.83 |
| Recall — not stressed | 0.60 |
| ROC-AUC | 0.712 |

It catches ~83% of genuinely stressed windows but is more trigger-happy on calm ones (60% specificity) — which is exactly why stage 2 confirms rather than acting on the model alone. Windows are 60 seconds; a 30-second window nearly halves stress recall, so 60s is locked. A modest, honest cross-subject result on a hard problem — not a benchmark-topping claim.

## Status

A working demo, honestly incomplete.

**End to end today** (employee experience): auth & onboarding, per-user calibration, live monitoring, confirmatory questionnaire, companion chat, personal dashboard.

**Not yet built:**
- Manager & admin dashboards — `team_lead` and `admin` roles render a "coming soon" screen.
- Notification and privacy-transparency settings — placeholder panels.
- Audio and physiological modalities, and multi-modal fusion — roadmap only; the shipped model is video-only despite the multi-modal design.
- Signup is open (no invite gate), and there's no formal Terms or Privacy Policy yet.

It's a thesis demo, not a production service — please treat it as one.

## Stack

Next.js 16 (Vercel) · FastAPI on Azure Container Apps · Supabase (Postgres, Auth, RLS) · Groq gpt-oss-120b with a self-hosted LM Studio fallback · Python ML (MediaPipe, OpenCV, scikit-learn) · Tailwind CSS v4 · TypeScript · Resend for email · GitHub Actions CI.

## License

Trained and demonstrated on the **StressID** dataset (Inria + EURECOM, NeurIPS 2023 Datasets & Benchmarks Track) under a **non-commercial academic license — research and demonstration only**. No part of this project may be commercialized while it uses StressID-derived data or weights. Serenify is a non-commercial graduation project.

## Team

A four-person graduation project:

- **Mohamed Assem** — dashboard lead · [@mohamedasem318](https://github.com/mohamedasem318)
- **Fatma Al-Zahraa Emad** · [@Fatma-Alzahraaa](https://github.com/Fatma-Alzahraaa)
- **Gehad Mohamed** · [@gehaddmohamedd](https://github.com/gehaddmohamedd)
- **Hebatullah El Gazoly** · [@hebatullah003](https://github.com/hebatullah003)

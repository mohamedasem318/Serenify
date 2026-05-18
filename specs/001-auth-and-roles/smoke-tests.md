# Smoke Tests: Authentication and Role-Based Access

**Feature**: `001-auth-and-roles`
**Run by**: Mohamed (per constitution Principle VII)
**Run when**: After `/speckit.implement` completes for this feature

Each test is human-validated. Record the outcome in the **Result** column
(✅ pass / ❌ fail / ⚠ partial) and add a one-line note where helpful.
Failures block merge to `main`.

| ID    | Scenario                                                                                                                    | Result | Notes |
|-------|-----------------------------------------------------------------------------------------------------------------------------|--------|-------|
| ST-1  | Sign up a new account with a fresh email. Verify the activation email lands in the inbox and that clicking the link activates the account. |   ✅    |      |
| ST-2  | Sign in with valid credentials for the account from ST-1. Verify the user reaches the role-appropriate workspace placeholder. |    ✅   |       |
| ST-3  | While signed out, navigate directly to `/app`. Verify the system redirects to `/login`.                                     |   ✅    |       |
| ST-4  | From `/login`, follow the "forgot password" flow end-to-end with the reset email and verify the new password works at sign-in. |   ✅    |       |
| ST-5  | Sign up three accounts. Manually set their roles in the Supabase dashboard (employee / team_lead / admin). Sign in as each and verify each lands on the correct role placeholder. |   ✅    |       |
| ST-6  | Open `/signup` and `/login` at a 360px viewport width. Verify forms are fully usable: no clipped controls, no horizontal scrolling, every control reachable with a ≥ 44px touch target. |    ✅   |       |

## Additional checks before sign-off

These are derived from the constitution and ride along with the explicit
smoke tests above. They MUST also pass before merging this feature.

- [x] No red color appears anywhere in any rendered authentication state,
      including form errors (constitution Principle V).
- [x] Both light and dark modes were tested for every authentication
      surface (signup, sign-in, sign-out, password reset, profile
      completion) — they are equal-priority (constitution Principle VI).
- [x] `prefers-reduced-motion` was verified to suppress any motion on
      authentication surfaces (constitution Principle VI).
- [x] No `.env*` files were committed; no API keys, connection strings,
      or private hostnames appear in any diff (constitution Principle IX).
- [x] No real teammate names were used as demo or test accounts
      (constitution Principle X).

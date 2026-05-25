import { NextResponse, type NextRequest } from "next/server";

import { adminInviteSchema } from "@/lib/auth/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/invite — implements contracts/routes.md.
 *
 * Gate ordering (security slice 3 — Findings 1 & 3): authentication and
 * authorization run BEFORE any body work, so an unauthenticated caller gets a
 * clean 401 with no schema disclosure, a non-admin gets 403, and only a
 * verified admin ever reaches Zod validation (and its 400). The Origin
 * allowlist (Finding 1) sits alongside the auth gate as defense-in-depth on
 * top of the SameSite=Lax session cookie — Route Handlers get no automatic
 * same-origin check from Next.js the way Server Actions do. See
 * docs/DECISIONS.md (2026-05-25 — Security slice 3).
 *
 * Flow after the gates:
 *   1. Invite the user via the admin client (creates auth.users row;
 *      handle_new_user trigger seeds public.profiles with role='employee').
 *   2. Call admin_update_role RPC to set the requested role.
 *   3. If manager_id supplied, call admin_update_manager RPC.
 *
 * Steps 2 and 3 use the SECURITY DEFINER functions which re-check
 * is_admin() inside Postgres (defence in depth), routed through the CALLER's
 * session client so auth.uid() resolves to the verified admin. A partial
 * failure (1 succeeded, 2 or 3 failed) returns 500 with the user_id so the
 * caller knows the invite went out and recovery is manual.
 *
 * Error hygiene (Finding 2): no branch forwards raw Supabase / RPC / Zod text
 * to the client. Failures are logged server-side; responses carry a fixed
 * error code (and, for validation, a fixed friendly message) only.
 */
export async function POST(request: NextRequest) {
  // Step 0a: authenticate the caller before doing any other work.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Step 0b: authorize — caller must be an admin.
  const { data: callerProfile, error: callerErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (callerErr || callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Step 0c: Origin allowlist (defense-in-depth on top of SameSite=Lax).
  // Allow an absent Origin (server-to-server / non-CORS callers); reject only
  // a present, mismatched Origin.
  const origin = request.headers.get("origin");
  const allowed = process.env.SITE_URL ?? "http://localhost:3000";
  if (origin !== null && origin !== allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Body parsing + validation run LAST — only a verified admin reaches here,
  // so the request schema is never disclosed to anonymous reconnaissance.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = adminInviteSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[invite] validation_failed:", parsed.error.issues);
    return NextResponse.json(
      { error: "validation_failed", message: "Invalid invite payload." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  // Step 1: invite.
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${siteUrl}/auth/callback`,
    });

  if (inviteErr || !invited.user) {
    const message = inviteErr?.message ?? "invite_failed";
    if (/already/i.test(message)) {
      return NextResponse.json(
        {
          error: "email_exists",
          message: "This email is already invited or in use.",
        },
        { status: 409 },
      );
    }
    console.error("[invite] invite_failed:", inviteErr);
    return NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }

  const invitedId = invited.user.id;

  // Steps 2 & 3: privileged updates go through the CALLER's session
  // client, not the admin client. The SECURITY DEFINER functions check
  // is_admin() which evaluates auth.uid() — service-role calls have no
  // auth.uid() and would always be rejected. Routing the RPC through
  // the caller's JWT means is_admin() resolves to the verified admin
  // user we checked above.

  // Step 2: promote role.
  const { error: roleErr } = await supabase.rpc("admin_update_role", {
    target_user_id: invitedId,
    new_role: parsed.data.role,
  });
  if (roleErr) {
    console.error("[invite] role_update_failed:", roleErr);
    return NextResponse.json(
      { user_id: invitedId, error: "role_update_failed" },
      { status: 500 },
    );
  }

  // Step 3: optional manager link.
  if (parsed.data.manager_id) {
    const { error: mgrErr } = await supabase.rpc("admin_update_manager", {
      target_user_id: invitedId,
      new_manager_id: parsed.data.manager_id,
    });
    if (mgrErr) {
      console.error("[invite] manager_update_failed:", mgrErr);
      return NextResponse.json(
        { user_id: invitedId, error: "manager_update_failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ user_id: invitedId }, { status: 201 });
}

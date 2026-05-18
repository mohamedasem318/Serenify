import { NextResponse, type NextRequest } from "next/server";

import { adminInviteSchema } from "@/lib/auth/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/invite — implements contracts/routes.md.
 *
 * Four-step flow:
 *   1. Verify the caller's JWT → role = 'admin' via the server client.
 *   2. Invite the user via the admin client (creates auth.users row;
 *      handle_new_user trigger seeds public.profiles with role='employee').
 *   3. Call admin_update_role RPC to set the requested role.
 *   4. If manager_id supplied, call admin_update_manager RPC.
 *
 * Steps 3 and 4 use the SECURITY DEFINER functions which re-check
 * is_admin() inside Postgres (defence in depth). A partial failure
 * (2 succeeded, 3 or 4 failed) returns 500 with the user_id so the
 * caller knows the invite went out and recovery is manual.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = adminInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Step 1: verify caller is admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: callerProfile, error: callerErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (callerErr || callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  // Step 2: invite.
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${siteUrl}/auth/callback`,
    });

  if (inviteErr || !invited.user) {
    const message = inviteErr?.message ?? "invite_failed";
    if (/already/i.test(message)) {
      return NextResponse.json(
        { error: "email_exists", detail: message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "invite_failed", detail: message },
      { status: 500 },
    );
  }

  const invitedId = invited.user.id;

  // Steps 3 & 4: privileged updates go through the CALLER's session
  // client, not the admin client. The SECURITY DEFINER functions check
  // is_admin() which evaluates auth.uid() — service-role calls have no
  // auth.uid() and would always be rejected. Routing the RPC through
  // the caller's JWT means is_admin() resolves to the verified admin
  // user we checked in step 1.

  // Step 3: promote role.
  const { error: roleErr } = await supabase.rpc("admin_update_role", {
    target_user_id: invitedId,
    new_role: parsed.data.role,
  });
  if (roleErr) {
    return NextResponse.json(
      {
        user_id: invitedId,
        error: "role_update_failed",
        detail: roleErr.message,
      },
      { status: 500 },
    );
  }

  // Step 4: optional manager link.
  if (parsed.data.manager_id) {
    const { error: mgrErr } = await supabase.rpc("admin_update_manager", {
      target_user_id: invitedId,
      new_manager_id: parsed.data.manager_id,
    });
    if (mgrErr) {
      return NextResponse.json(
        {
          user_id: invitedId,
          error: "manager_update_failed",
          detail: mgrErr.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ user_id: invitedId }, { status: 201 });
}

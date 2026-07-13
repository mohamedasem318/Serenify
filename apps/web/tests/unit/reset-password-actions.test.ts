import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  const order: string[] = [];
  const updateUser = vi.fn();
  const signOut = vi.fn();
  const verifyOtp = vi.fn();
  const createClient = vi.fn(async () => ({
    auth: { updateUser, signOut, verifyOtp },
  }));

  return { order, updateUser, signOut, verifyOtp, createClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: auth.createClient,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { updatePassword } from "@/app/(auth)/reset-password/actions";

function validPasswordForm() {
  const form = new FormData();
  form.set("new_password", "NewPassword8");
  form.set("confirm_password", "NewPassword8");
  return form;
}

describe("updatePassword", () => {
  beforeEach(() => {
    auth.order.length = 0;
    auth.updateUser.mockReset().mockImplementation(async () => {
      auth.order.push("update");
      return { error: null };
    });
    auth.signOut.mockReset().mockImplementation(async () => {
      auth.order.push("sign-out");
      return { error: null };
    });
    auth.createClient.mockClear();
  });

  it("signs out the recovery session after a successful password update", async () => {
    await expect(updatePassword(validPasswordForm())).resolves.toEqual({
      status: "ok",
    });

    expect(auth.order).toEqual(["update", "sign-out"]);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("does not sign out when the password update fails", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: new Error("vendor failure") });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(updatePassword(validPasswordForm())).resolves.toEqual({
      status: "error",
      message: "Something went wrong — please try again.",
    });

    expect(auth.signOut).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

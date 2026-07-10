import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("createAdminClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails closed when the service-role key is not configured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.resetModules();

    const { createAdminClient } = await import("@/lib/supabase/admin");

    expect(() => createAdminClient()).toThrow(
      "Admin Supabase client is disabled",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  onboardingSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyOtpSchema,
} from "@/lib/auth/schemas";

describe("signUpSchema", () => {
  it("rejects a malformed email", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "Goodpass1",
      full_name: "Alex",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a 7-char password", () => {
    const result = signUpSchema.safeParse({
      email: "alex@example.com",
      password: "Short1!",
      full_name: "Alex",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a letter-only password (missing digit)", () => {
    const result = signUpSchema.safeParse({
      email: "alex@example.com",
      password: "onlyletters",
      full_name: "Alex",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a digit-only password (missing letter)", () => {
    const result = signUpSchema.safeParse({
      email: "alex@example.com",
      password: "12345678",
      full_name: "Alex",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid signup payload", () => {
    const result = signUpSchema.safeParse({
      email: "alex@example.com",
      password: "Goodpass1",
      full_name: "Alex",
    });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("rejects mismatched confirm_password", () => {
    const result = resetPasswordSchema.safeParse({
      new_password: "Goodpass1",
      confirm_password: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("confirm_password"),
      );
      expect(issue?.message).toBe("Passwords do not match.");
    }
  });

  it("accepts matching passwords that meet strength rules", () => {
    const result = resetPasswordSchema.safeParse({
      new_password: "Goodpass1",
      confirm_password: "Goodpass1",
    });
    expect(result.success).toBe(true);
  });
});

describe("onboardingSchema", () => {
  it("trims whitespace from full_name", () => {
    const result = onboardingSchema.safeParse({ full_name: "  Alex  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe("Alex");
    }
  });

  it("rejects an empty full_name after trimming", () => {
    const result = onboardingSchema.safeParse({ full_name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("verifyOtpSchema", () => {
  it("accepts a 6-digit numeric token with signup type", () => {
    const result = verifyOtpSchema.safeParse({
      email: "alex@example.com",
      token: "123456",
      type: "signup",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 6-digit numeric token with recovery type", () => {
    const result = verifyOtpSchema.safeParse({
      email: "alex@example.com",
      token: "000000",
      type: "recovery",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a 5-digit token", () => {
    const result = verifyOtpSchema.safeParse({
      email: "alex@example.com",
      token: "12345",
      type: "signup",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a 7-digit token", () => {
    const result = verifyOtpSchema.safeParse({
      email: "alex@example.com",
      token: "1234567",
      type: "signup",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a token containing letters", () => {
    const result = verifyOtpSchema.safeParse({
      email: "alex@example.com",
      token: "12a456",
      type: "signup",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const result = verifyOtpSchema.safeParse({
      email: "alex@example.com",
      token: "123456",
      type: "invite",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = verifyOtpSchema.safeParse({
      email: "not-an-email",
      token: "123456",
      type: "signup",
    });
    expect(result.success).toBe(false);
  });
});

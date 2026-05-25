import { describe, expect, it } from "vitest";

import {
  fullNameSchema,
  onboardingSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyOtpSchema,
} from "@/lib/auth/schemas";

// Control / format chars are built with String.fromCharCode so the exact
// codepoint is unambiguous in source — a literal NUL / BELL / RTL-override /
// ZWSP can't be typed reliably and would silently degrade to an innocuous
// string, making a "rejects" assertion pass for the wrong reason.
const NUL = String.fromCharCode(0x0000); // \p{Cc}
const BELL = String.fromCharCode(0x0007); // \p{Cc}
const RTL_OVERRIDE = String.fromCharCode(0x202e); // \p{Cf}
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b); // \p{Cf}

describe("fullNameSchema", () => {
  it.each([
    ["a plain Latin name", "Alice"],
    ["a name with a space", "María José"],
    ["diacritics", "Renée Žofie"],
    ["an apostrophe", "O'Brien"],
    ["a hyphen", "Anne-Marie"],
    ["a period", "J. R. Tolkien"],
    ["the Catalan middle dot", "Lluís·Pujol"],
    ["a CJK name", "田中花子"],
    ["an Arabic name", "محمد"],
    ["exactly 120 characters", "a".repeat(120)],
  ])("accepts %s", (_label, value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(true);
  });

  it("trims and accepts surrounding whitespace", () => {
    const result = fullNameSchema.safeParse("  Alice  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Alice");
    }
  });

  it.each([
    ["empty string", ""],
    ["whitespace-only (empty after trim)", "   "],
    ["121 characters (over the cap)", "a".repeat(121)],
    ["a NULL control char (U+0000, Cc)", `Alice${NUL}`],
    ["a BELL control char (U+0007, Cc)", `Alice${BELL}`],
    ["an RTL-override format char (U+202E, Cf)", `Alice${RTL_OVERRIDE}ecila`],
    ["a zero-width-space format char (U+200B, Cf)", `Al${ZERO_WIDTH_SPACE}ice`],
  ])("rejects %s", (_label, value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(false);
  });

  it("surfaces the calm-voice empty message", () => {
    const result = fullNameSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Please enter your name.");
    }
  });

  it("surfaces a friendly hidden-character message (not a regex source)", () => {
    const result = fullNameSchema.safeParse(`Alice${RTL_OVERRIDE}`);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/hidden control/i);
    }
  });
});

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

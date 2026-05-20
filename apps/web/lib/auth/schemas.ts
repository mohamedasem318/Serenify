import { z } from "zod";

// Friendly error copy for the password strength rules. Zod's regex
// default messages leak the regex source ("Invalid string: must match
// pattern /[0-9]/") into the UI, which violates Constitution Principle
// V's calm-voice rule. Every .regex() in this module supplies an
// explicit message.
const passwordMinMessage = "Password must be at least 8 characters.";
const passwordLetterMessage = "Password must contain a letter.";
const passwordNumberMessage = "Password must contain a number.";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, passwordMinMessage)
    .regex(/[A-Za-z]/, passwordLetterMessage)
    .regex(/[0-9]/, passwordNumberMessage),
  full_name: z.string().trim().min(1).max(120),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, passwordMinMessage)
      .regex(/[A-Za-z]/, passwordLetterMessage)
      .regex(/[0-9]/, passwordNumberMessage),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Authenticated change-password (FR-020 amendment 2026-05-21). Used by
// the /app/account Security section. Mirrors resetPasswordSchema's
// strength rules and confirmation check; adds the current_password
// field that the server action verifies via a one-off signInWithPassword
// call before updating.
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z
      .string()
      .min(8, passwordMinMessage)
      .regex(/[A-Za-z]/, passwordLetterMessage)
      .regex(/[0-9]/, passwordNumberMessage),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const adminInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["employee", "team_lead", "admin"]),
  manager_id: z.string().uuid().optional(),
});
export type AdminInviteInput = z.infer<typeof adminInviteSchema>;

// 6-digit numeric OTP fallback for signup confirmation (`signup`) and
// password reset (`recovery`). Supabase's email templates ship both a
// magic link and this OTP — FR-020. The `type` discriminant is what
// supabase.auth.verifyOtp expects.
export const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the email."),
  type: z.enum(["signup", "recovery"]),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

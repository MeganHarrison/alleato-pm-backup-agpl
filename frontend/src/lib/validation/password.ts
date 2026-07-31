import { z } from "zod";

/**
 * Password validation rules applied at both client and server.
 */
export const PASSWORD_RULES = {
  minLength: 10,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
} as const;

export interface PasswordCheck {
  label: string;
  met: boolean;
}

/**
 * Returns a list of password requirement checks with pass/fail status.
 * Use this to build a visual strength indicator on the client.
 */
export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: `At least ${PASSWORD_RULES.minLength} characters`, met: password.length >= PASSWORD_RULES.minLength },
    { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "One number (0-9)", met: /[0-9]/.test(password) },
    { label: "One special character (!@#$...)", met: /[^a-zA-Z0-9]/.test(password) },
  ];
}

/**
 * Returns true if password meets all complexity requirements.
 */
export function isPasswordValid(password: string): boolean {
  return getPasswordChecks(password).every((c) => c.met);
}

/**
 * Zod schema for password validation. Use in API route Zod schemas.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_RULES.minLength, `Password must be at least ${PASSWORD_RULES.minLength} characters`)
  .max(PASSWORD_RULES.maxLength, `Password must be at most ${PASSWORD_RULES.maxLength} characters`)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

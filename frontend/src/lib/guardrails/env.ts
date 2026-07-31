import { z } from "zod";
import { GuardrailError } from "@/lib/guardrails/errors";

const NON_EMPTY = z.string().trim().min(1);

const URL_STRING = z
  .string()
  .url()
  .or(z.string().startsWith("http://"))
  .or(z.string().startsWith("https://"));

export function validateEnvVars(
  where: string,
  required: string[],
  options?: {
    urlVars?: string[];
  },
): void {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where,
      message: `Missing required environment variable(s): ${missing.join(", ")}`,
      details: {
        missing,
      },
    });
  }

  const urlVars = options?.urlVars ?? [];
  const malformed: string[] = [];
  for (const key of urlVars) {
    const value = process.env[key];
    if (!value) continue;
    const parsed = URL_STRING.safeParse(value);
    if (!parsed.success) {
      malformed.push(key);
    }
  }
  if (malformed.length > 0) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where,
      message: `Invalid URL format in environment variable(s): ${malformed.join(", ")}`,
      details: {
        malformed,
      },
    });
  }

  for (const key of required) {
    const parsed = NON_EMPTY.safeParse(process.env[key]);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "MISSING_ENV_VAR",
        where,
        message: `Environment variable is empty: ${key}`,
        details: { key },
      });
    }
  }
}


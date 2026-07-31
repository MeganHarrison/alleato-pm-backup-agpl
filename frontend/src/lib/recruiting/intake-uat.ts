import { createHash } from "node:crypto";

import { z } from "zod";

export const UAT_RESUME_MAX_BYTES = 4 * 1024 * 1024;
export const UAT_CONSENT_VERSION = "recruiting-uat-v1";
export const UAT_RESUME_FIXTURE_NAME = "synthetic-test-resume.pdf";
export const UAT_RESUME_FIXTURE_HASHES = new Set([
  "03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062",
]);

const uuidSchema = z.string().uuid();
const uatIntakeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional().default(""),
    requisitionId: uuidSchema,
    idempotencyKey: uuidSchema,
    consent: z.literal("true"),
    website: z.string().max(0),
  })
  .transform((value, context) => {
    const email = value.email.toLowerCase();
    const [localPart, domain] = email.split("@");
    const validAlias =
      domain === "alleatogroup.com" &&
      Boolean(
        localPart &&
          /\+uat(?:$|[-_][a-z0-9]+(?:[-_][a-z0-9]+)*)$/i.test(localPart),
      );
    if (!validAlias) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message:
          "Use an @alleatogroup.com email alias ending in +uat or +uat-<test-id>.",
      });
      return z.NEVER;
    }
    if (value.firstName.toLowerCase() !== "test") {
      context.addIssue({
        code: "custom",
        path: ["firstName"],
        message: 'Use "Test" as the first name for UAT records.',
      });
      return z.NEVER;
    }
    if (!/^candidate(?:[-_ ]?[a-z0-9]+)?$/i.test(value.lastName)) {
      context.addIssue({
        code: "custom",
        path: ["lastName"],
        message: 'Use "Candidate" or "Candidate <test-id>" as the last name.',
      });
      return z.NEVER;
    }

    const phoneDigits = value.phone.replace(/\D/g, "");
    if (
      phoneDigits.length > 0 &&
      !/^31755501\d{2}$/.test(phoneDigits)
    ) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message:
          "Use a reserved fictional test number from 317-555-0100 through 317-555-0199.",
      });
      return z.NEVER;
    }
    return {
      ...value,
      email,
      phone:
        phoneDigits.length === 10
          ? `+1${phoneDigits}`
          : phoneDigits.length > 0
            ? `+${phoneDigits}`
            : "",
    };
  });

export type UatIntakeFields = z.infer<typeof uatIntakeSchema>;

export function parseUatIntakeFields(input: unknown): UatIntakeFields {
  const result = uatIntakeSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? "The test application is invalid.");
  }
  return result.data;
}

export function hashRecruitingContact(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

type ResumeInput = {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
};

type ValidatedResume = {
  extension: "pdf";
  contentType: "application/pdf";
};

export async function validateUatResume(
  file: ResumeInput,
): Promise<ValidatedResume> {
  if (file.size < 1 || file.size > UAT_RESUME_MAX_BYTES) {
    throw new Error("The resume must be between 1 byte and 4 MB.");
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf") && file.type === "application/pdf") {
    const signature = new TextDecoder().decode(file.bytes.slice(0, 5));
    if (signature !== "%PDF-") {
      throw new Error("The uploaded file does not contain a valid PDF signature.");
    }
    return { extension: "pdf", contentType: "application/pdf" };
  }

  throw new Error("Upload the provided synthetic PDF resume fixture.");
}

export function assertApprovedUatResumeFixture(bytes: Uint8Array): string {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (!UAT_RESUME_FIXTURE_HASHES.has(hash)) {
    throw new Error(
      "Only the provided synthetic test resume may be uploaded in UAT.",
    );
  }
  return hash;
}

export function deriveUatBatchFileIdempotencyKey({
  batchId,
  sequence,
  sha256,
}: {
  batchId: string;
  sequence: number;
  sha256: string;
}): string {
  const hex = createHash("sha256")
    .update(`${batchId}:${sequence}:${sha256}`)
    .digest("hex")
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

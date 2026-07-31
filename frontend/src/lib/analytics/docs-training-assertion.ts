import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import {
  DOCS_TRAINING_ASSERTION_TTL_SECONDS,
  DOCS_TRAINING_AUDIENCE,
  DOCS_TRAINING_ISSUER,
  DocsTrainingSourceIdSchema,
} from "@/lib/analytics/docs-training-contract";

const TOKEN_VERSION = "v1";
const ASSERTION_PURPOSE = "training-progress";
const AAD = Buffer.from("alleato-docs-training-assertion:v1", "utf8");
const MAX_TOKEN_LENGTH = 4_096;
const CLOCK_SKEW_SECONDS = 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DocsTrainingAssertionFailure =
  | "malformed"
  | "invalid"
  | "expired"
  | "wrong_audience"
  | "wrong_purpose";

export class DocsTrainingAssertionError extends Error {
  constructor(readonly failure: DocsTrainingAssertionFailure) {
    super(`Documentation training assertion is ${failure.replaceAll("_", " ")}.`);
    this.name = "DocsTrainingAssertionError";
  }
}

export interface DocsTrainingAssertionClaims {
  version: 1;
  issuer: typeof DOCS_TRAINING_ISSUER;
  audience: string;
  purpose: typeof ASSERTION_PURPOSE;
  subject: string;
  sourceId: string;
  issuedAt: number;
  expiresAt: number;
}

interface AssertionOptions {
  now?: Date;
  secret?: string;
  audience?: string;
}

function secretFrom(options: AssertionOptions): string {
  const secret = options.secret ?? process.env.TRAINING_ANALYTICS_ASSERTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "TRAINING_ANALYTICS_ASSERTION_SECRET must contain at least 32 characters.",
    );
  }
  return secret;
}

function keyFrom(secret: string): Buffer {
  return createHash("sha256")
    .update("alleato-docs-training-assertion-key:v1\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

function base64url(value: Buffer): string {
  return value.toString("base64url");
}

function parseBase64url(value: string): Buffer {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new DocsTrainingAssertionError("malformed");
  }
  return Buffer.from(value, "base64url");
}

function sealClaims(claims: DocsTrainingAssertionClaims, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  return [TOKEN_VERSION, base64url(iv), base64url(ciphertext), base64url(cipher.getAuthTag())].join(".");
}

export function issueDocsTrainingAssertion(
  userId: string,
  sourceId: string,
  options: AssertionOptions = {},
): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("A valid product user UUID is required for a docs assertion.");
  }
  const parsedSourceId = DocsTrainingSourceIdSchema.safeParse(sourceId);
  if (!parsedSourceId.success) {
    throw new Error("A canonical documentation video source ID is required for a docs assertion.");
  }
  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1_000);
  return sealClaims(
    {
      version: 1,
      issuer: DOCS_TRAINING_ISSUER,
      audience: options.audience ?? DOCS_TRAINING_AUDIENCE,
      purpose: ASSERTION_PURPOSE,
      subject: userId,
      sourceId: parsedSourceId.data,
      issuedAt,
      expiresAt: issuedAt + DOCS_TRAINING_ASSERTION_TTL_SECONDS,
    },
    secretFrom(options),
  );
}

function isClaims(value: unknown): value is DocsTrainingAssertionClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<DocsTrainingAssertionClaims>;
  return (
    claims.version === 1 &&
    claims.issuer === DOCS_TRAINING_ISSUER &&
    typeof claims.audience === "string" &&
    typeof claims.purpose === "string" &&
    typeof claims.subject === "string" &&
    UUID_PATTERN.test(claims.subject) &&
    typeof claims.sourceId === "string" &&
    DocsTrainingSourceIdSchema.safeParse(claims.sourceId).success &&
    Number.isInteger(claims.issuedAt) &&
    Number.isInteger(claims.expiresAt)
  );
}

export function verifyDocsTrainingAssertion(
  token: string,
  options: AssertionOptions = {},
): DocsTrainingAssertionClaims {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw new DocsTrainingAssertionError("malformed");
  }
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    throw new DocsTrainingAssertionError("malformed");
  }

  let claims: unknown;
  try {
    const iv = parseBase64url(parts[1]);
    const ciphertext = parseBase64url(parts[2]);
    const tag = parseBase64url(parts[3]);
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new DocsTrainingAssertionError("malformed");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFrom(secretFrom(options)),
      iv,
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    claims = JSON.parse(plaintext);
  } catch (error) {
    if (error instanceof DocsTrainingAssertionError) throw error;
    throw new DocsTrainingAssertionError("invalid");
  }

  if (!isClaims(claims)) {
    throw new DocsTrainingAssertionError("invalid");
  }
  if (claims.purpose !== ASSERTION_PURPOSE) {
    throw new DocsTrainingAssertionError("wrong_purpose");
  }
  if (claims.audience !== (options.audience ?? DOCS_TRAINING_AUDIENCE)) {
    throw new DocsTrainingAssertionError("wrong_audience");
  }

  const now = Math.floor((options.now ?? new Date()).getTime() / 1_000);
  if (
    claims.expiresAt <= now ||
    claims.issuedAt > now + CLOCK_SKEW_SECONDS ||
    claims.expiresAt - claims.issuedAt > DOCS_TRAINING_ASSERTION_TTL_SECONDS
  ) {
    throw new DocsTrainingAssertionError("expired");
  }
  return claims;
}

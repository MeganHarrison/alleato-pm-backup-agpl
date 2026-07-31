import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import type { RecruitingSessionClient } from "@/lib/recruiting/server";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const STATE_LIFETIME_MS = 10 * 60 * 1000;
const MICROSOFT_REQUEST_TIMEOUT_MS = 15_000;

export const MICROSOFT_OAUTH_COOKIE = "recruiting_microsoft_oauth";
export type MicrosoftCapability = "mail" | "calendar" | "all";

const capabilitySchema = z.enum(["mail", "calendar", "all"]);
const statePayloadSchema = z.object({
  state: z.string().min(32),
  verifier: z.string().min(43).max(128),
  capability: capabilitySchema,
  personId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
});
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});
const graphProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().nullable().optional(),
  mail: z.string().email().nullable().optional(),
  userPrincipalName: z.string().email(),
});
const storedSecretSchema = z.object({
  accessTokenCiphertext: z.string().min(1),
  refreshTokenCiphertext: z.string().min(1),
  expiresAt: z.string().datetime(),
  scopes: z.array(z.string()),
});
const refreshTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});

function encryptionKey(): Buffer {
  const raw = process.env.RECRUITING_MICROSOFT_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Recruiting Microsoft token encryption is not configured.");
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      "Recruiting Microsoft token encryption must use a 32-byte base64 key.",
    );
  }
  return decoded;
}

export function parseMicrosoftCapability(
  value: string | null,
): MicrosoftCapability {
  return capabilitySchema.parse(value ?? "all");
}

export function scopesForCapability(capability: MicrosoftCapability): string[] {
  const scopes = ["offline_access", "User.Read"];
  if (capability === "mail" || capability === "all") scopes.push("Mail.Send");
  if (capability === "calendar" || capability === "all") {
    scopes.push("Calendars.ReadWrite");
  }
  return scopes;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function microsoftConfig(origin: string) {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const configuredRedirectUri = process.env.RECRUITING_MICROSOFT_REDIRECT_URI;
  if (process.env.NODE_ENV === "production" && !configuredRedirectUri) {
    throw new Error("Microsoft recruiting redirect is not configured.");
  }
  const redirectUri =
    configuredRedirectUri ??
    `${origin}/api/recruiting/integrations/microsoft/callback`;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft recruiting OAuth is not configured.");
  }
  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    appOrigin: new URL(redirectUri).origin,
  };
}

export function recruitingAppOrigin(requestOrigin: string): string {
  const configuredRedirectUri =
    process.env.RECRUITING_MICROSOFT_REDIRECT_URI ??
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL;
  return configuredRedirectUri
    ? new URL(configuredRedirectUri).origin
    : new URL(requestOrigin).origin;
}

export function createMicrosoftOAuthState(input: {
  capability: MicrosoftCapability;
  personId: string;
  now?: number;
}) {
  const verifier = base64Url(randomBytes(48));
  const payload = statePayloadSchema.parse({
    state: base64Url(randomBytes(32)),
    verifier,
    capability: input.capability,
    personId: input.personId,
    expiresAt: (input.now ?? Date.now()) + STATE_LIFETIME_MS,
  });
  const encoded = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", encryptionKey())
    .update(encoded)
    .digest("base64url");
  return {
    payload,
    cookieValue: `${encoded}.${signature}`,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export function verifyMicrosoftOAuthState(
  cookieValue: string,
  expectedState: string,
  expectedPersonId: string,
  now = Date.now(),
) {
  const [encoded, suppliedSignature, extra] = cookieValue.split(".");
  if (!encoded || !suppliedSignature || extra) {
    throw new Error("Microsoft connection state is invalid.");
  }
  const expectedSignature = createHmac("sha256", encryptionKey())
    .update(encoded)
    .digest();
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature)
  ) {
    throw new Error("Microsoft connection state is invalid.");
  }
  const payload = statePayloadSchema.parse(
    JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
  );
  if (
    payload.state !== expectedState ||
    payload.personId !== expectedPersonId ||
    payload.expiresAt < now
  ) {
    throw new Error("Microsoft connection state expired or did not match.");
  }
  return payload;
}

export function buildMicrosoftAuthorizeUrl(input: {
  origin: string;
  state: string;
  codeChallenge: string;
  capability: MicrosoftCapability;
}) {
  const config = microsoftConfig(input.origin);
  const url = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`,
  );
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: scopesForCapability(input.capability).join(" "),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url;
}

export async function completeMicrosoftOAuth(input: {
  origin: string;
  code: string;
  verifier: string;
  expectedEmail: string;
  capability: MicrosoftCapability;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const config = microsoftConfig(input.origin);
  const tokenResponse = await fetchImpl(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: config.redirectUri,
        code_verifier: input.verifier,
      }),
      signal: AbortSignal.timeout(MICROSOFT_REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!tokenResponse.ok) {
    throw new Error("Microsoft authorization code exchange failed.");
  }
  const tokens = tokenResponseSchema.parse(await tokenResponse.json());

  const profileResponse = await fetchImpl(
    `${GRAPH_BASE_URL}/me?$select=id,displayName,mail,userPrincipalName`,
    {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(MICROSOFT_REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!profileResponse.ok) {
    throw new Error("Microsoft profile verification failed.");
  }
  const profile = graphProfileSchema.parse(await profileResponse.json());
  const email = (profile.mail ?? profile.userPrincipalName).toLowerCase();
  if (
    !input.expectedEmail ||
    email !== input.expectedEmail.toLowerCase() ||
    !email.endsWith("@alleatogroup.com")
  ) {
    throw new Error(
      "Connect the same Alleato Microsoft account used to sign in.",
    );
  }
  return {
    tenantId: config.tenantId,
    microsoftUserId: profile.id,
    email,
    displayName: profile.displayName ?? null,
    scopes: tokens.scope
      ? tokens.scope.split(/\s+/).filter(Boolean)
      : scopesForCapability(input.capability),
    accessTokenCiphertext: encryptMicrosoftToken(tokens.access_token),
    refreshTokenCiphertext: encryptMicrosoftToken(tokens.refresh_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
}

export function encryptMicrosoftToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptMicrosoftToken(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue, extra] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new Error("Encrypted Microsoft token is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function getValidMicrosoftAccessToken(input: {
  db: RecruitingSessionClient;
  personId: string;
  requiredScope: "Mail.Send" | "Calendars.ReadWrite";
  origin: string;
  fetchImpl?: typeof fetch;
}) {
  const { data, error } = await input.db.rpc(
    "recruiting_admin_get_microsoft_connection_secret",
    { p_person_id: input.personId },
  );
  if (error || !data) {
    throw new Error("A Microsoft 365 connection is required.");
  }
  const stored = storedSecretSchema.parse(data);
  if (!stored.scopes.includes(input.requiredScope)) {
    throw new Error(`Microsoft permission ${input.requiredScope} is required.`);
  }
  if (new Date(stored.expiresAt).getTime() > Date.now() + 5 * 60 * 1000) {
    return decryptMicrosoftToken(stored.accessTokenCiphertext);
  }

  const config = microsoftConfig(input.origin);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: decryptMicrosoftToken(stored.refreshTokenCiphertext),
        scope: stored.scopes.join(" "),
      }),
      signal: AbortSignal.timeout(MICROSOFT_REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error("Microsoft 365 must be reconnected.");
  }
  const refreshed = refreshTokenResponseSchema.parse(await response.json());
  const scopes = refreshed.scope
    ? refreshed.scope.split(/\s+/).filter(Boolean)
    : stored.scopes;
  if (!scopes.includes(input.requiredScope)) {
    throw new Error(`Microsoft permission ${input.requiredScope} is required.`);
  }
  const accessTokenCiphertext = encryptMicrosoftToken(refreshed.access_token);
  const refreshTokenCiphertext = refreshed.refresh_token
    ? encryptMicrosoftToken(refreshed.refresh_token)
    : stored.refreshTokenCiphertext;
  const { data: saved, error: saveError } = await input.db.rpc(
    "recruiting_admin_refresh_microsoft_connection_tokens",
    {
      p_person_id: input.personId,
      p_access_token_ciphertext: accessTokenCiphertext,
      p_refresh_token_ciphertext: refreshTokenCiphertext,
      p_access_token_expires_at: new Date(
        Date.now() + refreshed.expires_in * 1000,
      ).toISOString(),
      p_granted_scopes: scopes,
    },
  );
  if (saveError || saved !== true) {
    throw new Error("Refreshed Microsoft credentials could not be saved.");
  }
  return refreshed.access_token;
}

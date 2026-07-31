/**
 * RFI response tokens — authorize a specific recipient to respond to a specific
 * RFI without logging in.
 *
 * The same token is used by BOTH no-login channels:
 *   - Web:   embedded in the magic-link URL  /respond/rfi/<token>
 *   - Email: embedded in the reply plus-address  rfi-reply+<token>@…
 *
 * Tokens are opaque random strings stored in `rfi_response_tokens`. They are
 * reusable (a sub may post several responses) until `expires_at` passes or the
 * token is revoked. All access goes through the service-role client; the table
 * has no anon/authenticated RLS policy, so tokens are never client-readable.
 */

import { randomBytes } from "crypto";

import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Days a response link stays valid after it is issued. */
export const RFI_RESPONSE_TOKEN_TTL_DAYS = 60;

export interface RfiResponseTokenRecord {
  token: string;
  rfiId: string;
  projectId: number;
  recipientName: string | null;
  recipientEmail: string;
  recipientPersonId: string | null;
}

export interface CreateRfiResponseTokenInput {
  rfiId: string;
  projectId: number;
  recipientEmail: string;
  recipientName?: string | null;
  recipientPersonId?: string | null;
  ttlDays?: number;
}

function generateToken(): string {
  // 24 random bytes → 32-char URL-safe string. Ample entropy, no padding.
  return randomBytes(24).toString("base64url");
}

/**
 * Issue a fresh response token for one recipient of one RFI. Always creates a
 * new row (so each email send carries its own auditable link). Returns the token
 * string, or null if the insert failed (caller treats a missing token as "send
 * without a magic link" rather than failing the whole notification).
 */
export async function createRfiResponseToken(
  supabase: ServiceClient,
  input: CreateRfiResponseTokenInput,
): Promise<string | null> {
  const token = generateToken();
  const ttlDays = input.ttlDays ?? RFI_RESPONSE_TOKEN_TTL_DAYS;
  const expiresAt = new Date(
    Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("rfi_response_tokens").insert({
    token,
    rfi_id: input.rfiId,
    project_id: input.projectId,
    recipient_email: input.recipientEmail,
    recipient_name: input.recipientName ?? null,
    recipient_person_id: input.recipientPersonId ?? null,
    expires_at: expiresAt,
  });

  if (error) return null;
  return token;
}

/**
 * Resolve a token to its recipient + RFI, enforcing expiry and revocation.
 * Returns null for unknown, expired, or revoked tokens (callers must not leak
 * which of these it was).
 */
export async function resolveRfiResponseToken(
  supabase: ServiceClient,
  token: string,
): Promise<RfiResponseTokenRecord | null> {
  if (!token || token.length < 16) return null;

  const { data, error } = await supabase
    .from("rfi_response_tokens")
    .select(
      "token, rfi_id, project_id, recipient_name, recipient_email, recipient_person_id, expires_at, revoked_at",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  return {
    token: data.token,
    rfiId: data.rfi_id,
    projectId: data.project_id,
    recipientName: data.recipient_name,
    recipientEmail: data.recipient_email,
    recipientPersonId: data.recipient_person_id,
  };
}

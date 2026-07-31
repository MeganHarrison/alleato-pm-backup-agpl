export const dynamic = "force-dynamic";

/**
 * POST /api/admin/teams/seed-conversation
 *
 * Manually seed a Teams conversation ref for a user so the Archon bot can
 * send them proactive messages without them needing to message the bot first.
 *
 * Steps:
 *  1. Resolve the user's Supabase ID from their email
 *  2. Resolve their AAD Object ID — from the request body OR Microsoft Graph
 *  3. Get a Bot Framework access token
 *  4. Call the Bot Connector createConversation API to open a 1:1 DM thread
 *  5. Encode the thread ID and store in teams_conversation_refs
 *  6. Optionally upsert bot_user_mappings so the account is "linked"
 *
 * Body:
 *   email:        string  — the user's Alleato email
 *   aadObjectId?: string  — their Azure AD Object ID (paste from Azure portal)
 *                           If omitted, we try Microsoft Graph (requires
 *                           User.Read.All permission on the bot's service principal)
 *   serviceUrl?:  string  — Bot Framework service URL (defaults to amer region)
 *   sendWelcome?: boolean — send a greeting after seeding (default true)
 *
 * Auth: active Supabase session (admin pages are access-gated at the layout level).
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

// Teams Bot Framework default service URL for North America / AMER region.
// Override with serviceUrl in the request body for other regions (EMEA, APAC).
const DEFAULT_SERVICE_URL = "https://smba.trafficmanager.net/amer/";

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getBotFrameworkToken(tenantId: string): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.TEAMS_APP_ID!,
        client_secret: process.env.TEAMS_APP_PASSWORD!,
        scope: "https://api.botframework.com/.default",
      }),
    },
  );
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Bot Framework token error: ${data.error_description ?? "unknown"}`);
  }
  return data.access_token;
}

async function tryGraphLookup(email: string, tenantId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.TEAMS_APP_ID!,
          client_secret: process.env.TEAMS_APP_PASSWORD!,
          scope: "https://graph.microsoft.com/.default",
        }),
      },
    );
    const tokenData = (await res.json()) as { access_token?: string };
    if (!tokenData.access_token) return null;

    const userRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    if (!userRes.ok) return null;
    const userData = (await userRes.json()) as { id?: string };
    return userData.id ?? null;
  } catch {
    return null;
  }
}

// ── Thread ID encoding (mirrors @chat-adapter/teams internals) ────────────────

function encodeThreadId(conversationId: string, serviceUrl: string): string {
  const encodedConversation = Buffer.from(conversationId).toString("base64url");
  const encodedServiceUrl = Buffer.from(serviceUrl).toString("base64url");
  return `teams:${encodedConversation}:${encodedServiceUrl}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const POST = withApiGuardrails("admin/teams/seed-conversation#POST", async ({ request }): Promise<Response> => {
  // Auth: require active session
  const user = await getApiRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    email?: string;
    aadObjectId?: string;
    serviceUrl?: string;
    sendWelcome?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, aadObjectId: providedAadObjectId, sendWelcome = true } = body;
  const serviceUrl = (body.serviceUrl ?? DEFAULT_SERVICE_URL).replace(/\/?$/, "/");

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }


  // 1. Resolve Supabase user ID from email
  const { data: profile } = await serviceDb.from("user_profiles")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: `No Alleato account found for ${email}. They need an account first.` },
      { status: 400 },
    );
  }

  const supabaseUserId = profile.id;
  const displayName = profile.full_name ?? email.split("@")[0];
  const firstName = displayName.split(" ")[0];

  // 2. Resolve AAD Object ID
  const tenantId = process.env.TEAMS_APP_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "TEAMS_APP_TENANT_ID is not set" }, { status: 500 });
  }

  let aadObjectId = providedAadObjectId ?? null;

  if (!aadObjectId) {
    aadObjectId = await tryGraphLookup(email, tenantId);
    if (!aadObjectId) {
      return NextResponse.json(
        {
          error:
            "Could not find AAD Object ID automatically — Microsoft Graph lookup failed " +
            "(the bot may not have User.Read.All permission). " +
            "Please provide the aadObjectId manually: find it in Azure portal → " +
            "Azure Active Directory → Users → " +
            email +
            " → Object ID.",
          needsAadObjectId: true,
        },
        { status: 400 },
      );
    }
  }

  const botAppId = process.env.TEAMS_APP_ID!;

  // 3. Get Bot Framework token
  let botToken: string;
  try {
    botToken = await getBotFrameworkToken(tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to authenticate bot: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  // 4. Create 1:1 conversation via Bot Framework Connector API
  const createRes = await fetch(`${serviceUrl}v3/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      bot: { id: `28:${botAppId}`, name: "Archon" },
      isGroup: false,
      members: [{ id: `29:${aadObjectId}` }],
      tenantId,
      channelData: { tenant: { id: tenantId } },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    return NextResponse.json(
      {
        error: `Bot Framework createConversation failed (${createRes.status}): ${errText}`,
        hint:
          createRes.status === 403
            ? "The bot may not have permission to create conversations with this user. Make sure the Archon app is installed in their Teams client."
            : undefined,
      },
      { status: 500 },
    );
  }

  const createData = (await createRes.json()) as { id: string };
  const conversationId = createData.id;

  // 5. Encode thread ID and build SerializedThread
  const threadId = encodeThreadId(conversationId, serviceUrl);
  const serializedThread = {
    _type: "chat:Thread",
    adapterName: "teams",
    channelId: "msteams",
    id: threadId,
    isDM: true,
  };

  // 6. Upsert conversation ref
  const { error: refError } = await serviceDb.from("teams_conversation_refs").upsert(
    {
      supabase_user_id: supabaseUserId,
      thread_json: serializedThread as unknown as Json,
      is_dm: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "supabase_user_id,is_dm" },
  );

  if (refError) {
    return NextResponse.json(
      { error: `Failed to store conversation ref: ${refError.message}` },
      { status: 500 },
    );
  }

  // 7. Upsert bot_user_mappings so they're "linked"
  await serviceDb.from("bot_user_mappings").upsert(
    {
      platform: "teams",
      platform_user_id: `29:${aadObjectId}`,
      supabase_user_id: supabaseUserId,
      display_name: displayName,
    },
    { onConflict: "platform,platform_user_id" },
  );

  // 8. Optionally send welcome message
  if (sendWelcome) {
    await fetch(`${serviceUrl}v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        type: "message",
        text: `Hi ${firstName}! 👋 I'm Archon, your Alleato AI assistant. Your account has been connected — you can now ask me anything about your projects, and I'll send you important updates here in Teams.`,
      }),
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    supabaseUserId,
    displayName,
    conversationId,
    serviceUrl,
    graphLookupUsed: !providedAadObjectId,
  });
});

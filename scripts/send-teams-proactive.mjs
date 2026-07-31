/**
 * Send a proactive Teams DM from Alleato AI (Archon) to a user.
 * Usage: node scripts/send-teams-proactive.mjs <alleato-email> [teams-microsoft-email]
 * If the user's Alleato email differs from their Microsoft/Teams email, supply both.
 */

const SUPABASE_URL = "https://lgveqfnpkxvzbnnwuled.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  return res.json();
}

async function sbUpsert(table, body, onConflict) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
}

const TEAMS_APP_ID = "e7af03cc-fe26-4e4d-bf63-425733fdb905";
const TEAMS_APP_PASSWORD =
  process.env.TEAMS_APP_PASSWORD || process.env.MICROSOFT_BOT_PASSWORD;
const TENANT_ID = "4998a178-5591-4354-811e-d0d6c7994f75";
const SERVICE_URL = "https://smba.trafficmanager.net/amer/";

const email = process.argv[2]; // Alleato account email (for Supabase lookup)
const teamsEmail = process.argv[3] || email; // Microsoft/Teams email (for Graph lookup; defaults to same)

if (!email) {
  console.error("Usage: node scripts/send-teams-proactive.mjs <alleato-email> [teams-email]");
  process.exit(1);
}

const missingEnv = [];
if (!SUPABASE_SERVICE_KEY) {
  missingEnv.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
}
if (!TEAMS_APP_PASSWORD) {
  missingEnv.push("TEAMS_APP_PASSWORD or MICROSOFT_BOT_PASSWORD");
}

if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(", ")}`);
  process.exit(1);
}

const INTRO_MESSAGE = `Good afternoon — I wanted to send a quick note to officially introduce myself. I'm **Archon**, and I'm excited to be joining the team.

I know this has been a long time coming, so it's good to finally be here.

You've got a lot on your plate, so I'll keep this brief. When you're ready, we can go deeper on strategy and shape this around how you want it to work.

One of the biggest advantages of building a system customized around your business is that it can be shaped to fit the way you want to operate.

There's now a foundation in place to help bring structure, follow-through, and visibility across the business. I've already spent a lot of time inside your projects, meetings, patterns, and workflows, and honestly, what you've built over the last four years is impressive. The growth is real.

I also know growth at this stage can feel like constant pressure — too much moving at once, too many decisions, and never quite enough time. The goal here is simple: help take weight off your plate, improve clarity, and give you stronger leverage as the business keeps growing.

Going forward, I can support you however you prefer — Teams, text, email, or a mix. We'll shape it around what's most useful to you.`;

async function getBotToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: TEAMS_APP_ID,
        client_secret: TEAMS_APP_PASSWORD,
        scope: "https://api.botframework.com/.default",
      }),
    },
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function getGraphToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: TEAMS_APP_ID,
        client_secret: TEAMS_APP_PASSWORD,
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  const data = await res.json();
  return data.access_token ?? null;
}

async function getAadObjectId(email) {
  const token = await getGraphToken();
  if (!token) return null;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

async function main() {
  // 1. Resolve Supabase user
  const profiles = await sbGet(`user_profiles?email=eq.${encodeURIComponent(email)}&select=id,full_name&limit=1`);
  const profile = Array.isArray(profiles) ? profiles[0] : null;

  if (!profile) {
    console.error(`No Alleato account found for ${email}`);
    process.exit(1);
  }

  const supabaseUserId = profile.id;
  const displayName = profile.full_name ?? email.split("@")[0];
  console.log(`Found user: ${displayName} (${supabaseUserId})`);

  // 2. Resolve AAD Object ID (using Teams/Microsoft email, which may differ from Alleato email)
  console.log(`Looking up AAD Object ID via Microsoft Graph for ${teamsEmail}...`);
  const aadObjectId = await getAadObjectId(teamsEmail);
  if (!aadObjectId) {
    console.error(
      "Could not find AAD Object ID via Graph. Make sure the bot has User.Read.All permission.",
    );
    process.exit(1);
  }
  console.log(`AAD Object ID: ${aadObjectId}`);

  // 3. Get Bot Framework token
  console.log("Getting Bot Framework token...");
  const botToken = await getBotToken();

  // 4. Create 1:1 conversation
  console.log("Creating conversation...");
  const createRes = await fetch(`${SERVICE_URL}v3/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      bot: { id: `28:${TEAMS_APP_ID}`, name: "Alleato AI" },
      isGroup: false,
      members: [{ id: `29:${aadObjectId}` }],
      tenantId: TENANT_ID,
      channelData: { tenant: { id: TENANT_ID } },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`createConversation failed (${createRes.status}): ${err}`);
    if (createRes.status === 403) {
      console.error(
        "Hint: The user may not have the Alleato PM APP installed in their Teams client.",
      );
    }
    process.exit(1);
  }

  const { id: conversationId } = await createRes.json();
  console.log(`Conversation created: ${conversationId}`);

  // 5. Send the message
  const text = message ?? INTRO_MESSAGE;
  console.log("Sending message...");
  const sendRes = await fetch(
    `${SERVICE_URL}v3/conversations/${encodeURIComponent(conversationId)}/activities`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        type: "message",
        textFormat: "markdown",
        text,
      }),
    },
  );

  if (!sendRes.ok) {
    const err = await sendRes.text();
    console.error(`Send failed (${sendRes.status}): ${err}`);
    process.exit(1);
  }

  console.log(`✅ Message sent to ${displayName} (${email})`);

  // 6. Store conversation ref so future proactive messages work
  const encodedConv = Buffer.from(conversationId).toString("base64url");
  const encodedUrl = Buffer.from(SERVICE_URL).toString("base64url");
  const threadId = `teams:${encodedConv}:${encodedUrl}`;
  const serializedThread = {
    _type: "chat:Thread",
    adapterName: "teams",
    channelId: "msteams",
    id: threadId,
    isDM: true,
  };

  await sbUpsert(
    "teams_conversation_refs",
    {
      supabase_user_id: supabaseUserId,
      thread_json: serializedThread,
      is_dm: true,
      last_seen_at: new Date().toISOString(),
    },
    "supabase_user_id,is_dm",
  );

  await sbUpsert(
    "bot_user_mappings",
    {
      platform: "teams",
      platform_user_id: `29:${aadObjectId}`,
      supabase_user_id: supabaseUserId,
      display_name: displayName,
    },
    "platform,platform_user_id",
  );

  console.log("✅ Conversation ref and user mapping stored.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

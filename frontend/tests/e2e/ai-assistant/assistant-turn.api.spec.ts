import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const appUrl =
  process.env.BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

function turnIdFromSessionToken(token: string): string {
  expect(token).toMatch(/^aat\./);
  return Buffer.from(token.slice(4), "base64url").toString("utf8");
}

test.describe("Eve AssistantTurn public lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let api: APIRequestContext;
  let foreignApi: APIRequestContext;
  let userId = "";
  let foreignUserId = "";
  let sessionId = "";
  let observedTurnId = "";

  test.beforeAll(async ({ playwright }) => {
    const url =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !serviceKey || !anonKey) {
      throw new Error(
        "Eve AssistantTurn API smoke requires Supabase URL, anon key, and service-role key.",
      );
    }

    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `eve-assistant-turn-${Date.now()}@example.com`;
    const password = `EveAssistantTurn-${randomUUID()}-Aa1!`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `Creating the Eve AssistantTurn user failed: ${created.error?.message ?? "no user"}`,
      );
    }
    userId = created.data.user.id;
    sessionId = randomUUID();

    const conversation = await admin.from("conversations").insert({
      session_id: sessionId,
      user_id: userId,
      title: "Eve AssistantTurn API contract",
      metadata: { surface: "alleato_ai", test_run: true },
    });
    if (conversation.error) {
      throw new Error(
        `Creating the Eve conversation failed: ${conversation.error.message}`,
      );
    }

    const auth = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await auth.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      throw new Error(
        `Signing in the Eve AssistantTurn user failed: ${signedIn.error?.message ?? "no session"}`,
      );
    }
    api = await playwright.request.newContext({
      baseURL: appUrl,
      extraHTTPHeaders: {
        authorization: `Bearer ${signedIn.data.session.access_token}`,
        "x-alleato-assistant-surface": "ai_assistant",
      },
    });

    const foreignEmail = `eve-assistant-turn-foreign-${Date.now()}@example.com`;
    const foreignPassword = `EveAssistantTurn-${randomUUID()}-Aa1!`;
    const foreignCreated = await admin.auth.admin.createUser({
      email: foreignEmail,
      password: foreignPassword,
      email_confirm: true,
    });
    if (foreignCreated.error || !foreignCreated.data.user) {
      throw new Error(
        `Creating the foreign Eve user failed: ${foreignCreated.error?.message ?? "no user"}`,
      );
    }
    foreignUserId = foreignCreated.data.user.id;
    const foreignAuth = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const foreignSignedIn = await foreignAuth.auth.signInWithPassword({
      email: foreignEmail,
      password: foreignPassword,
    });
    if (foreignSignedIn.error || !foreignSignedIn.data.session) {
      throw new Error(
        `Signing in the foreign Eve user failed: ${foreignSignedIn.error?.message ?? "no session"}`,
      );
    }
    foreignApi = await playwright.request.newContext({
      baseURL: appUrl,
      extraHTTPHeaders: {
        authorization: `Bearer ${foreignSignedIn.data.session.access_token}`,
        "x-alleato-assistant-surface": "ai_assistant",
      },
    });
  });

  test.afterAll(async () => {
    await api?.dispose();
    await foreignApi?.dispose();
    if (!userId) return;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "Eve AssistantTurn cleanup requires DATABASE_URL; temporary rows were not removed.",
      );
    }
    const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
    try {
      await sql.begin(async (transaction) => {
        await transaction`delete from public.durable_ai_turns where user_id = ${userId}`;
        await transaction`delete from public.chat_history where user_id = ${userId}`;
        await transaction`delete from public.conversations where user_id = ${userId}`;
      });
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) {
        throw new Error(`Deleting the Eve test user failed: ${deleted.error.message}`);
      }
      if (foreignUserId) {
        const foreignDeleted =
          await admin.auth.admin.deleteUser(foreignUserId);
        if (foreignDeleted.error) {
          throw new Error(
            `Deleting the foreign Eve test user failed: ${foreignDeleted.error.message}`,
          );
        }
      }
    } finally {
      await sql.end();
    }
  });

  test("starts one Eve turn, streams it, observes its receipt, and suppresses a duplicate", async () => {
    const body = {
      message: "Reply in one short sentence: the Eve AssistantTurn API test is complete.",
      clientContext: {
        assistantSurface: "alleato_ai",
        conversationId: sessionId,
      },
    };

    const start = await api.post("/api/ai-assistant/eve/proxy/eve/v1/session", {
      data: body,
      timeout: 180_000,
    });
    expect(start.status()).toBe(200);
    const started = await start.json();
    const appSession = started.sessionId as string;
    const turnId = turnIdFromSessionToken(appSession);
    observedTurnId = turnId;

    const stream = await api.get(
      `/api/ai-assistant/eve/proxy/eve/v1/session/${encodeURIComponent(appSession)}/stream?startIndex=0`,
      { timeout: 180_000 },
    );
    expect(stream.status()).toBe(200);
    const streamBody = await stream.text();
    expect(streamBody).toContain('"type":"turn.completed"');

    const observe = await api.get(
      `/api/ai-assistant/turns?turnId=${encodeURIComponent(turnId)}`,
    );
    expect(observe.status()).toBe(200);
    expect(await observe.json()).toMatchObject({
      receipt: {
        turnId,
        status: "completed",
        runtimeKind: "eve",
      },
    });

    const duplicate = await api.post(
      "/api/ai-assistant/eve/proxy/eve/v1/session",
      { data: body },
    );
    expect(duplicate.status()).toBe(202);
    expect(await duplicate.json()).toMatchObject({
      duplicate: true,
      sessionId: appSession,
      turnId,
    });
  });

  test("hides missing and foreign turns from durable cancellation", async () => {
    const missing = await api.delete(
      `/api/ai-assistant/turns?turnId=${randomUUID()}`,
    );
    expect(missing.status()).toBe(404);

    const foreign = await foreignApi.delete(
      `/api/ai-assistant/turns?turnId=${encodeURIComponent(observedTurnId)}`,
    );
    expect(foreign.status()).toBe(404);
  });

  test("fails loudly without changing the receipt because Eve 0.22.6 has no durable cancel protocol", async () => {
    const body = {
      message:
        "Reply in one short sentence: durable Eve cancellation capability check.",
      clientContext: {
        assistantSurface: "alleato_ai",
        conversationId: sessionId,
      },
    };
    const start = await api.post(
      "/api/ai-assistant/eve/proxy/eve/v1/session",
      { data: body, timeout: 180_000 },
    );
    expect(start.status()).toBe(200);
    const started = await start.json();
    const appSession = started.sessionId as string;
    const turnId = turnIdFromSessionToken(appSession);

    const cancel = await api.delete(
      `/api/ai-assistant/turns?turnId=${encodeURIComponent(turnId)}`,
    );
    expect(cancel.status()).toBe(501);
    expect(await cancel.text()).toContain("EVE_DURABLE_CANCEL_UNAVAILABLE");
    const observe = await api.get(
      `/api/ai-assistant/turns?turnId=${encodeURIComponent(turnId)}`,
    );
    expect(observe.status()).toBe(200);
    expect(await observe.json()).toMatchObject({
      receipt: { turnId, status: "running", runtimeKind: "eve" },
    });

    // Drain the still-active turn so the test leaves no orphaned Eve work.
    const stream = await api.get(
      `/api/ai-assistant/eve/proxy/eve/v1/session/${encodeURIComponent(appSession)}/stream?startIndex=0`,
      { timeout: 180_000 },
    );
    expect(stream.status()).toBe(200);
    expect(await stream.text()).toContain('"type":"turn.completed"');
  });
});

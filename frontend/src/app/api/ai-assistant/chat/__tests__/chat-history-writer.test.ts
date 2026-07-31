/**
 * Proves ChatHistoryWriter builds the correct chat_history row and honors its
 * failure contract, driven through a fake Supabase client (no import mocks).
 */

import { createChatHistoryWriter } from "../chat-history-writer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Insert = { table: string; row: Record<string, unknown> };

function fakeSupabase(
  inserts: Insert[],
  error: { message: string } | null = null,
): SupabaseClient<Database> {
  return {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return Promise.resolve({ error });
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

const CTX = { sessionId: "sess-1", userId: "user-1" };

describe("ChatHistoryWriter.persist", () => {
  test("writes a chat_history row with session/user/role/content", async () => {
    const inserts: Insert[] = [];
    const writer = createChatHistoryWriter(fakeSupabase(inserts), CTX);

    const result = await writer.persist("user", "hello");

    expect(result).toEqual({ error: null });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("chat_history");
    expect(inserts[0].row).toEqual({
      session_id: "sess-1",
      user_id: "user-1",
      role: "user",
      content: "hello",
    });
  });

  test("includes metadata only when provided", async () => {
    const inserts: Insert[] = [];
    const writer = createChatHistoryWriter(fakeSupabase(inserts), CTX);

    await writer.persist("assistant", "answer", { architecture: "retrieval-planner-v2" });

    expect(inserts[0].row.metadata).toEqual({ architecture: "retrieval-planner-v2" });
  });

  test("returns the error message instead of throwing", async () => {
    const writer = createChatHistoryWriter(fakeSupabase([], { message: "db down" }), CTX);
    await expect(writer.persist("user", "x")).resolves.toEqual({ error: "db down" });
  });
});

describe("ChatHistoryWriter.persistRecord", () => {
  test("writes the complete persistence-ready record including sources", async () => {
    const inserts: Insert[] = [];
    const writer = createChatHistoryWriter(fakeSupabase(inserts), CTX);

    await writer.persistRecord({
      role: "assistant",
      content: "answer",
      sources: [{ type: "meeting", id: "meeting-1" }] as never,
      metadata: { provider_path: "vercel_gateway", tool_trace: [] },
    });

    expect(inserts[0].row).toEqual({
      session_id: "sess-1",
      user_id: "user-1",
      role: "assistant",
      content: "answer",
      sources: [{ type: "meeting", id: "meeting-1" }],
      metadata: { provider_path: "vercel_gateway", tool_trace: [] },
    });
  });

  test("throws a labeled record failure instead of dropping the turn", async () => {
    const writer = createChatHistoryWriter(fakeSupabase([], { message: "db down" }), CTX);
    await expect(
      writer.persistRecordOrThrow({ role: "assistant", content: "answer" }, "assistant turn"),
    ).rejects.toThrow("Persisting the assistant turn failed: db down");
  });

  test("rejects a copied legacy row for a different turn identity", async () => {
    const writer = createChatHistoryWriter(fakeSupabase([]), CTX);
    await expect(
      writer.persistBoundRecord({
        session_id: "other-session",
        user_id: "user-1",
        role: "assistant",
        content: "answer",
      }),
    ).rejects.toThrow(
      "Chat turn persistence rejected a row whose session or user differs from the active request.",
    );
  });

  test("throws when a legacy branch would otherwise ignore a database failure", async () => {
    const writer = createChatHistoryWriter(fakeSupabase([], { message: "db down" }), CTX);
    await expect(
      writer.persistBoundRecord({
        session_id: "sess-1",
        user_id: "user-1",
        role: "assistant",
        content: "answer",
      }),
    ).rejects.toThrow("Persisting the assistant chat turn failed: db down");
  });
});

describe("ChatHistoryWriter.persistOrThrow", () => {
  test("resolves silently on success", async () => {
    const writer = createChatHistoryWriter(fakeSupabase([]), CTX);
    await expect(writer.persistOrThrow("user", "x")).resolves.toBeUndefined();
  });

  test("throws a labeled error on failure (never silently drops a row)", async () => {
    const writer = createChatHistoryWriter(fakeSupabase([], { message: "db down" }), CTX);
    await expect(
      writer.persistOrThrow("user", "x", undefined, "user message"),
    ).rejects.toThrow("Persisting the user message failed: db down");
  });
});

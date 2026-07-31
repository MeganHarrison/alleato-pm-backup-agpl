import type { ModelMessage } from "ai";
import {
  CONTEXT_COMPACTION_SUMMARY_PREFIX,
  ContextCompactionError,
  DEFAULT_HARD_LIMIT_TOKENS,
  MIN_HARD_LIMIT_TOKENS,
  maybeCompactModelMessages,
  resolveContextLimits,
} from "../compaction";

function user(content: string): ModelMessage {
  return { role: "user", content };
}

function assistant(content: ModelMessage["content"]): ModelMessage {
  return { role: "assistant", content };
}

function system(content: string): ModelMessage {
  return { role: "system", content };
}

describe("resolveContextLimits", () => {
  it("falls back to defaults when the limit is unset / NaN / zero / negative", () => {
    expect(resolveContextLimits({}).hardLimitTokens).toBe(DEFAULT_HARD_LIMIT_TOKENS);
    expect(resolveContextLimits({ hardLimitTokens: NaN }).hardLimitTokens).toBe(
      DEFAULT_HARD_LIMIT_TOKENS,
    );
    expect(resolveContextLimits({ hardLimitTokens: 0 }).hardLimitTokens).toBe(
      DEFAULT_HARD_LIMIT_TOKENS,
    );
    expect(resolveContextLimits({ hardLimitTokens: -5 }).hardLimitTokens).toBe(
      DEFAULT_HARD_LIMIT_TOKENS,
    );
  });

  it("floors a positive-but-too-small configured hard limit", () => {
    expect(resolveContextLimits({ hardLimitTokens: 5_000 }).hardLimitTokens).toBe(
      MIN_HARD_LIMIT_TOKENS,
    );
  });

  it("respects a sane custom hard limit above the floor", () => {
    expect(resolveContextLimits({ hardLimitTokens: 64_000 }).hardLimitTokens).toBe(
      64_000,
    );
  });

  it("never lets the threshold exceed the hard limit", () => {
    const { thresholdTokens, hardLimitTokens } = resolveContextLimits({
      thresholdTokens: 90_000,
      hardLimitTokens: 50_000,
    });
    expect(thresholdTokens).toBeLessThanOrEqual(hardLimitTokens);
  });
});

describe("context compaction", () => {
  it("returns an under-threshold no-op without calling the summarizer", async () => {
    const summarize = jest.fn(async () => "summary");
    const messages = [user("short"), assistant("small")];

    const result = await maybeCompactModelMessages(messages, {
      enabled: true,
      systemPrompt: "system prompt must stay outside compaction",
      thresholdTokens: 10_000,
      hardLimitTokens: 20_000,
      summarize,
    });

    expect(result.messages).toBe(messages);
    expect(result.metadata.status).toBe("under_threshold");
    expect(summarize).not.toHaveBeenCalled();
  });

  it("preserves system, head, and tail messages while summarizing the middle", async () => {
    const messages: ModelMessage[] = [
      system("developer safety instruction"),
      user("head user"),
      assistant("head assistant"),
      user("middle user " + "x".repeat(400)),
      assistant("middle assistant " + "y".repeat(400)),
      user("recent user"),
      assistant("recent assistant"),
    ];

    const result = await maybeCompactModelMessages(messages, {
      enabled: true,
      systemPrompt: "VERBATIM SYSTEM PROMPT",
      thresholdTokens: 10,
      hardLimitTokens: 10_000,
      headMessages: 3,
      tailMessages: 2,
      summarize: async ({ middleTranscript }) => {
        expect(middleTranscript).toContain("middle user");
        expect(middleTranscript).toContain("middle assistant");
        return "middle summary";
      },
    });

    expect(result.metadata.status).toBe("compacted");
    expect(result.metadata.headMessagesKept).toBe(3);
    expect(result.metadata.tailMessagesKept).toBe(2);
    expect(result.messages[0]).toEqual(messages[0]);
    expect(result.messages[1]).toEqual(messages[1]);
    expect(result.messages[2]).toEqual(messages[2]);
    expect(result.messages.at(-2)).toEqual(messages.at(-2));
    expect(result.messages.at(-1)).toEqual(messages.at(-1));
    expect(
      result.messages.some(
        (message) =>
          message.role === "system" &&
          typeof message.content === "string" &&
          message.content.startsWith(CONTEXT_COMPACTION_SUMMARY_PREFIX) &&
          message.content.includes("middle summary"),
      ),
    ).toBe(true);
  });

  it("refreshes an existing compaction summary instead of stacking summaries", async () => {
    const existingSummary = system(
      `${CONTEXT_COMPACTION_SUMMARY_PREFIX}\nold summary`,
    );
    const messages: ModelMessage[] = [
      user("head"),
      existingSummary,
      assistant("middle " + "x".repeat(500)),
      user("tail user"),
      assistant("tail assistant"),
    ];

    const result = await maybeCompactModelMessages(messages, {
      enabled: true,
      systemPrompt: "system",
      thresholdTokens: 10,
      hardLimitTokens: 10_000,
      headMessages: 1,
      tailMessages: 2,
      summarize: async ({ previousSummary }) => {
        expect(previousSummary).toContain("old summary");
        return "refreshed summary";
      },
    });

    const summaryMessages = result.messages.filter(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.startsWith(CONTEXT_COMPACTION_SUMMARY_PREFIX),
    );
    expect(result.metadata.previousSummaryRefreshed).toBe(true);
    expect(summaryMessages).toHaveLength(1);
    expect(summaryMessages[0]?.content).toContain("refreshed summary");
  });

  it("summarizes bulky historical tool results and replaces old binary references", async () => {
    const messages: ModelMessage[] = [
      user("head"),
      assistant([
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "searchExternalDocuments",
          output: { type: "text", value: "a".repeat(2_000) },
        },
        {
          type: "file",
          data: "data:application/pdf;base64,abc",
          filename: "old.pdf",
          mediaType: "application/pdf",
        },
        {
          type: "image",
          image: "data:image/png;base64,abc",
          mediaType: "image/png",
        },
      ]),
      user("tail"),
      assistant("tail answer"),
    ];

    const result = await maybeCompactModelMessages(messages, {
      enabled: true,
      systemPrompt: "system",
      thresholdTokens: 10,
      hardLimitTokens: 10_000,
      headMessages: 1,
      tailMessages: 2,
      maxToolResultChars: 100,
      summarize: async ({ middleTranscript }) => {
        expect(middleTranscript).toContain("historical tool result pruned");
        expect(middleTranscript).toContain("historical file omitted: old.pdf");
        expect(middleTranscript).toContain("historical image omitted");
        return "summary";
      },
    });

    expect(result.metadata.bulkyToolResultsPruned).toBe(1);
    expect(result.metadata.binaryReferencesReplaced).toBe(2);
  });

  it("never orphans a tool-call/tool-result pair that lands on a slice boundary", async () => {
    // A tool-call (msg 1) and its matching tool-result (msg 2) sit exactly on
    // the head boundary for headMessages=2. A naive slice(0, 2) would keep the
    // tool-call in `head` and summarize the tool-result into the middle (or
    // vice-versa), orphaning one half — which OpenAI/Anthropic reject with a
    // hard 400. The boundary must snap so the pair stays atomic.
    const messages: ModelMessage[] = [
      user("u0 head"),
      assistant([
        {
          type: "tool-call",
          toolCallId: "call-straddle",
          toolName: "searchEmails",
          input: { query: "status" },
        },
      ]),
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-straddle",
            toolName: "searchEmails",
            output: { type: "text", value: "r".repeat(80) },
          },
        ],
      },
      user("u3 middle " + "m".repeat(500)),
      assistant("a4 middle " + "n".repeat(500)),
      user("u5 tail"),
      assistant("a6 tail"),
    ];

    const result = await maybeCompactModelMessages(messages, {
      enabled: true,
      systemPrompt: "system",
      thresholdTokens: 10,
      hardLimitTokens: 10_000,
      headMessages: 2,
      tailMessages: 2,
      summarize: async () => "middle summary",
    });

    expect(result.metadata.status).toBe("compacted");

    // Collect every tool-call id and tool-result id surviving in the output.
    const callIds = new Set<string>();
    const resultIds = new Set<string>();
    for (const message of result.messages) {
      if (!Array.isArray(message.content)) continue;
      for (const part of message.content) {
        if (part.type === "tool-call") callIds.add(part.toolCallId);
        if (part.type === "tool-result") resultIds.add(part.toolCallId);
      }
    }

    // No orphans: every surviving tool-result has its tool-call and vice-versa.
    for (const id of resultIds) {
      expect(callIds.has(id)).toBe(true);
    }
    for (const id of callIds) {
      expect(resultIds.has(id)).toBe(true);
    }
    // The straddling pair was pushed wholly into the summarized middle.
    expect(callIds.has("call-straddle")).toBe(false);
    expect(resultIds.has("call-straddle")).toBe(false);
  });

  it("does not reject a disabled chat when the hard limit is a misconfigured 0", async () => {
    // Regression: an unset env var parsed via Number("") yields 0, which is
    // finite. A naive `>= hardLimitTokens` check would treat every disabled
    // chat as over-limit and throw. A non-positive limit must fall back to the
    // real default, so a normal-sized chat passes straight through.
    const messages = [user("hello"), assistant("hi there")];
    const result = await maybeCompactModelMessages(messages, {
      enabled: false,
      systemPrompt: "system",
      thresholdTokens: 0,
      hardLimitTokens: 0,
    });

    expect(result.messages).toBe(messages);
    expect(result.metadata.status).toBe("disabled");
  });

  it("throws a specific compaction error when compaction is disabled but the request is over the hard limit", async () => {
    // 200k chars ≈ 50k tokens — over the floored hard limit even with a tiny
    // configured limit (the floor protects normal chats, not genuinely huge ones).
    await expect(
      maybeCompactModelMessages([user("x".repeat(200_000))], {
        enabled: false,
        systemPrompt: "system",
        thresholdTokens: 10,
        hardLimitTokens: 20,
      }),
    ).rejects.toThrow(ContextCompactionError);
  });

  it("does NOT reject a normal short chat even when the configured hard limit is a too-small positive number", async () => {
    // Regression guardrail: a fat-fingered positive-but-tiny hard limit
    // (e.g. env set to 5000) must not reject an ordinary short chat. The floor
    // keeps the rejection threshold above normal system-prompt-sized requests.
    const result = await maybeCompactModelMessages(
      [user("Reply with exactly the word: WOMBAT")],
      {
        enabled: false,
        systemPrompt: "S".repeat(30_000), // ~7.5k tokens, the real WOMBAT size
        thresholdTokens: 4_000,
        hardLimitTokens: 5_000,
      },
    );
    expect(result.metadata.status).toBe("disabled");
    expect(result.metadata.hardLimitTokens).toBeGreaterThanOrEqual(48_000);
  });

  it("blames the system prompt — not the chat — when a 1-message chat is over the limit because of an oversized injected context", async () => {
    // Regression: a brand-new conversation with a single short user message
    // returned "I could not safely compact this long chat" because the injected
    // intelligence/retrieval context (counted in the system prompt) alone blew
    // past the hard limit. Compaction cannot shrink the system prompt, so the
    // failure must be attributed to the system prompt, never the conversation.
    const hugeSystemPrompt = "S".repeat(200_000); // ~50k tokens
    expect.assertions(3);
    try {
      await maybeCompactModelMessages([user("Reply with exactly the word: WOMBAT")], {
        enabled: false,
        systemPrompt: hugeSystemPrompt,
        thresholdTokens: 40_000,
        hardLimitTokens: 45_000,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ContextCompactionError);
      expect((error as ContextCompactionError).reason).toBe(
        "system_prompt_over_limit",
      );
      // The honest message attributes the failure to the system prompt, and
      // explicitly states compaction cannot help.
      expect((error as ContextCompactionError).message).toMatch(
        /system prompt|system context/i,
      );
    }
  });

  it("attributes an over-limit error to the conversation when the messages are what overflow", async () => {
    expect.assertions(2);
    try {
      await maybeCompactModelMessages([user("x".repeat(200_000))], {
        enabled: false,
        systemPrompt: "small system prompt",
        thresholdTokens: 40_000,
        hardLimitTokens: 45_000,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ContextCompactionError);
      expect((error as ContextCompactionError).reason).toBe(
        "conversation_over_limit",
      );
    }
  });

  it("throws a specific compaction error when summarization fails over the hard limit", async () => {
    await expect(
      maybeCompactModelMessages(
        [
          user("head"),
          assistant("middle " + "x".repeat(200_000)),
          user("tail"),
        ],
        {
          enabled: true,
          systemPrompt: "system",
          thresholdTokens: 10,
          hardLimitTokens: 20,
          headMessages: 1,
          tailMessages: 1,
          summarize: async () => {
            throw new Error("summarizer down");
          },
        },
      ),
    ).rejects.toThrow(ContextCompactionError);
  });
});

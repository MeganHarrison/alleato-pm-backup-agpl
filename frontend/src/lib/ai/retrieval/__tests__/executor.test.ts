// frontend/src/lib/ai/retrieval/__tests__/executor.test.ts
import { executeRetrievalPlan, type ExecutorDeps } from "../executor";
import type { RetrievalPlan } from "../types";

function makeStubDeps(opts: {
  delayEachMs?: number;
  externalSourceHangsMs?: number;
  externalTimeoutMs?: number;
  externalDelayBySourceMs?: Partial<
    Record<"meetings" | "email" | "teams" | "onedrive", number>
  >;
  timeoutBySourceMs?: Partial<
    Record<"meetings" | "email" | "teams" | "onedrive", number>
  >;
  resolvedProjectId?: number | null;
  intelligencePacket?: unknown;
  projectSnapshot?: unknown;
  intelligenceEvidence?: unknown;
} = {}): ExecutorDeps {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return {
    loadIntelligencePacket: jest.fn(async () => {
      await delay(opts.delayEachMs ?? 0);
      return opts.intelligencePacket === undefined
        ? ({ id: "p1", cards: [], freshnessStatus: "fresh" } as never)
        : (opts.intelligencePacket as never);
    }),
    loadIntelligenceEvidence: jest.fn(async () => opts.intelligenceEvidence ?? {
      current: { id: "p1" }, historical: [], executiveReports: [], status: "complete",
    }),
    loadProjectSnapshot: jest.fn(async () => {
      await delay(opts.delayEachMs ?? 0);
      return opts.projectSnapshot === undefined
        ? ({ sourceRef: "snap" } as never)
        : (opts.projectSnapshot as never);
    }),
    runSemanticSearch: jest.fn(async () => ({ results: [] } as never)),
    runExternalSourceSearch: jest.fn(async (source) => {
      await delay(
        opts.externalDelayBySourceMs?.[source] ??
          opts.externalSourceHangsMs ??
          0,
      );
      return { source: "x", status: "ok", results: [] } as never;
    }),
    runRecentEmails: jest.fn(async () => ({ count: 1, threads: [{ latestSubject: "Bid invite" }] } as never)),
    loadReusableBriefing: jest.fn(async () => null as never),
    runSourceSpecificRag: jest.fn(async () => null as never),
    buildBrandonDaily: jest.fn(async () => ({ packet: {} } as never)),
    runAppExpert: jest.fn(async () => ({
      answer: "Use the Change Orders page.",
      mode: "deep_agents",
      sources: [],
    } as never)),
    resolveProjectFromQuery: jest.fn(async () =>
      opts.resolvedProjectId === undefined
        ? null
        : opts.resolvedProjectId === null
          ? null
          : { projectId: opts.resolvedProjectId },
    ),
    researchTimeoutOverrideMs: (source) =>
      opts.timeoutBySourceMs?.[source] ?? opts.externalTimeoutMs ?? 3000,
  };
}

describe("executeRetrievalPlan", () => {
  it("runs only sources requested in plan", async () => {
    const plan: RetrievalPlan = {
      intent: "app_help",
      responseFormat: "app_help",
      sources: {},
      reason: "test",
    };
    const ctx = await executeRetrievalPlan(plan, makeStubDeps());
    expect(ctx.intelligencePacket).toBeUndefined();
    expect(ctx.projectSnapshot).toBeUndefined();
    expect(ctx.semanticVectorResults).toBeUndefined();
    expect(ctx.warnings).toEqual([]);
  });

  it("runs app expert retrieval when requested", async () => {
    const plan: RetrievalPlan = {
      intent: "app_help",
      responseFormat: "app_help",
      sources: { appExpert: { question: "How do I create a change order in the app?" } },
      selectedProjectId: 67,
      reason: "app_help_intent",
    };
    const deps = makeStubDeps();
    const ctx = await executeRetrievalPlan(plan, deps, {
      currentRoute: "/67/change-orders",
      message: "How do I create a change order in the app?",
    });

    expect(deps.runAppExpert).toHaveBeenCalledWith({
      question: "How do I create a change order in the app?",
      currentRoute: "/67/change-orders",
      projectId: 67,
    });
    expect(ctx.appExpertPacket).toMatchObject({
      answer: "Use the Change Orders page.",
      mode: "deep_agents",
    });
  });

  it("runs requested sources in parallel", async () => {
    const start = Date.now();
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        projectSnapshot: { reason: "intent" },
      },
      selectedProjectId: 67,
      reason: "test",
    };
    const ctx = await executeRetrievalPlan(plan, makeStubDeps({ delayEachMs: 200 }));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(380); // parallel ~200ms, not sequential 400ms
    expect(ctx.intelligencePacket).toBeDefined();
    expect(ctx.projectSnapshot).toBeDefined();
    expect(ctx.intelligenceEvidence?.status).toBe("complete");
  });

  it("warns explicitly when completed intelligence evidence is insufficient", async () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { intelligencePacket: { mode: "additive" }, intelligenceEvidence: { mode: "current" } },
      selectedProjectId: 67,
      reason: "test",
    };
    const deps = makeStubDeps({
      intelligenceEvidence: { current: null, historical: [], executiveReports: [], status: "insufficient", reason: "run incomplete" },
    });
    const ctx = await executeRetrievalPlan(plan, deps);
    expect(ctx.intelligenceEvidence?.status).toBe("insufficient");
    expect(ctx.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "intelligence_evidence", message: "run incomplete" }),
    ]));
  });

  it("warns when requested project operating context is missing", async () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        projectSnapshot: { reason: "intent" },
      },
      selectedProjectId: 67,
      reason: "test",
    };
    const ctx = await executeRetrievalPlan(
      plan,
      makeStubDeps({ intelligencePacket: null, projectSnapshot: null }),
    );

    expect(ctx.intelligencePacket).toBeNull();
    expect(ctx.projectSnapshot).toBeNull();
    expect(ctx.warnings).toEqual(
      expect.arrayContaining([
        {
          source: "intelligence_packet",
          message: "requested project operating context packet was unavailable for project 67",
        },
        {
          source: "project_snapshot",
          message: "requested structured project briefing snapshot was unavailable for project 67",
        },
      ]),
    );
  });

  it("resolves project-scoped retrieval from message text when selectedProjectId is absent", async () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        projectSnapshot: { reason: "intent" },
      },
      reason: "packet_first_resolve_from_text",
    };
    const deps = makeStubDeps({ resolvedProjectId: 983 });
    const ctx = await executeRetrievalPlan(plan, deps, {
      message: "What's the latest on Vermillion Rise?",
    });

    expect(deps.resolveProjectFromQuery).toHaveBeenCalledWith("What's the latest on Vermillion Rise?");
    expect(deps.loadIntelligencePacket).toHaveBeenCalledWith(983);
    expect(deps.loadProjectSnapshot).toHaveBeenCalledWith(983);
    expect(ctx.warnings).toEqual([]);
  });

  it("captures warnings instead of throwing when an external source times out", async () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        research: {
          version: 1,
          visibility: "closed",
          requests: ["meetings", "teams", "email", "onedrive"].map((source) => ({
            source,
            required: true,
            authority: "operating_only",
            query: "test query",
          })) as never,
        },
      },
      selectedProjectId: 67,
      reason: "test",
    };
    const ctx = await executeRetrievalPlan(
      plan,
      makeStubDeps({ externalSourceHangsMs: 200, externalTimeoutMs: 20 }),
      { sessionId: "s1", message: "test query" },
    );
    expect(ctx.warnings.length).toBe(4);
    expect(ctx.warnings[0].message).toMatch(/timed out/i);
    expect(ctx.warnings.map((w) => w.source).sort()).toEqual(["email", "meetings", "onedrive", "teams"]);
    expect(ctx.researchReceipts?.map((receipt) => receipt.status)).toEqual([
      "timed_out",
      "timed_out",
      "timed_out",
      "timed_out",
    ]);
  });

  it("uses the source-specific timeout budget instead of one external ceiling", async () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        research: {
          version: 1,
          visibility: "closed",
          requests: ["meetings", "email"].map((source) => ({
            source,
            required: true,
            authority: "operating_only",
            query: "test query",
          })) as never,
        },
      },
      reason: "test",
    };
    const ctx = await executeRetrievalPlan(
      plan,
      makeStubDeps({
        externalDelayBySourceMs: { meetings: 30, email: 30 },
        timeoutBySourceMs: { meetings: 50, email: 10 },
      }),
    );

    expect(ctx.researchReceipts).toEqual([
      expect.objectContaining({ source: "meetings", status: "empty" }),
      expect.objectContaining({ source: "email", status: "timed_out" }),
    ]);
  });

  it("records durations for each source executed", async () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        semanticVectorSearch: { query: "test" },
      },
      selectedProjectId: 67,
      reason: "test",
    };
    const ctx = await executeRetrievalPlan(plan, makeStubDeps({ delayEachMs: 50 }));
    expect(typeof ctx.durationsMs.intelligence_packet).toBe("number");
    expect(typeof ctx.durationsMs.semantic_search).toBe("number");
    expect(ctx.durationsMs.intelligence_packet).toBeGreaterThanOrEqual(40);
  });

  it("runs structured recent email retrieval when requested", async () => {
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "recent_email_inbox",
      sources: {
        recentEmails: {
          daysBack: 0,
          limit: 50,
          reason: "structured_outlook_inbox_query",
        },
      },
      reason: "structured_outlook_inbox_query",
    };
    const deps = makeStubDeps();
    const ctx = await executeRetrievalPlan(plan, deps, {
      message: "what important emails have I received this morning?",
    });

    expect(deps.runRecentEmails).toHaveBeenCalledWith({
      daysBack: 0,
      limit: 50,
      message: "what important emails have I received this morning?",
    });
    expect(ctx.recentEmailInbox).toEqual({ count: 1, threads: [{ latestSubject: "Bid invite" }] });
  });
});

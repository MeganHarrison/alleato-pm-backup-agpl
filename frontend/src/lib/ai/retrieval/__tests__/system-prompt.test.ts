// frontend/src/lib/ai/retrieval/__tests__/system-prompt.test.ts
jest.mock("@/lib/ai/stream/compaction", () => ({
  CHARS_PER_TOKEN: 4,
  DEFAULT_HARD_LIMIT_TOKENS: 128000,
}));

import { assembleSystemPromptFromContext } from "../system-prompt";
import type { RetrievalPlan, RetrievalContext } from "../types";

describe("assembleSystemPromptFromContext", () => {
  it("requires canonical communication research across every requested source", () => {
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "source_lookup",
      sources: {
        research: {
          version: 1,
          visibility: "closed",
          requests: [
            { source: "meetings", required: true, authority: "operating_only", query: "Map the process" },
            { source: "email", required: true, authority: "operating_only", query: "Map the process" },
            { source: "teams", required: true, authority: "operating_only", query: "Map the process" },
          ],
        },
      },
      reason: "cross_source_investigation_research_contract",
    };
    const ctx: RetrievalContext = {
      researchReceipts: [
        { source: "meetings", required: true, authority: "operating_only", toolName: "searchMeetingsByTopic", status: "empty", durationMs: 10, payload: { count: 0, results: [] } },
        { source: "email", required: true, authority: "operating_only", toolName: "searchEmails", status: "complete", durationMs: 10, payload: { results: [{ subject: "Approval process" }] } },
        { source: "teams", required: true, authority: "operating_only", toolName: "searchTeamsMessages", status: "empty", durationMs: 10, payload: { count: 0, results: [] } },
      ],
      warnings: [],
      durationsMs: {},
    };

    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE_PROMPT");
    expect(prompt).toContain("Chat-turn Research Receipts");
    expect(prompt).toContain("Coverage: COMPLETE");
    expect(prompt).toContain("Outlook email · COMPLETE");
    expect(prompt).toContain("operating/process findings only");
  });

  it("adds tool-routing guidance when nothing was pre-fetched", () => {
    const plan: RetrievalPlan = {
      intent: "app_help",
      responseFormat: "app_help",
      sources: {},
      reason: "test",
    };
    const ctx: RetrievalContext = { warnings: [], durationsMs: {} };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE_PROMPT");
    expect(prompt).toContain("No Pre-fetched Context");
    expect(prompt).toContain("Use your available tools to answer");
    expect(prompt).toContain("BASE_PROMPT");
  });

  it("includes App Expert packets for app-help questions", () => {
    const plan: RetrievalPlan = {
      intent: "app_help",
      responseFormat: "app_help",
      sources: {
        appExpert: { question: "Where do I manage permissions in the app?" },
      },
      reason: "app_help_intent",
    };
    const ctx: RetrievalContext = {
      appExpertPacket: {
        answer: "Use Settings > Team to review roles and visibility.",
        mode: "deep_agents",
        orchestrator: "alleato-app-expert",
        skillsLoaded: ["permissions-and-visibility"],
        approvedSkillContext:
          "## Approved Skill Library Context\n\n### Explain app permissions (v1, app_help, low risk)\nInstructions: Use role and visibility wording from the approved app-help skill.",
        sources: [
          {
            title: "App permissions and visibility",
            sourceType: "help_article",
            filePath:
              "docs/alleato-os-docs/help/articles/app-permissions-and-visibility.mdx",
            detail: "Published AI-visible help article.",
          },
        ],
        toolTrace: [
          {
            agent: "alleato-app-expert",
            tool: "search_feature_registry",
            status: "success",
            durationMs: 12,
            detail: "Matched permissions feature docs.",
          },
        ],
      },
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE_PROMPT");
    expect(prompt).toContain("App Expert Packet");
    expect(prompt).toContain("Use Settings > Team");
    expect(prompt).toContain("Approved App-Help Skills");
    expect(prompt).toContain("Explain app permissions");
    expect(prompt).toContain("app-permissions-and-visibility.md");
    expect(prompt).toContain("Do not invent app behavior");
  });

  it("includes only sections for sources that returned data", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { intelligencePacket: { mode: "additive" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      intelligencePacket: { id: "p1", cards: [{ title: "Risks" }] } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE_PROMPT");
    expect(prompt).toContain("Current Project Intelligence Packet");
    expect(prompt).toContain("BASE_PROMPT");
    expect(prompt).not.toContain("Project Briefing Snapshot");
    expect(prompt).not.toContain("Vector Search Results");
  });

  it("truncates an oversized top-priority block to the budget and flags it to the model", () => {
    // Regression: an over-large injected context (intelligence packet + vector
    // results) bloated the system prompt past the context hard limit, so even a
    // one-line chat was rejected by the compaction guard. The injected context
    // must be bounded so a short chat can never trip the limit.
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "source_lookup",
      sources: { semanticVectorSearch: { query: "spec evidence" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      semanticVectorResults: {
        results: [
          {
            content: "Z".repeat(1000),
            sourceTable: "document_chunks",
            recordId: 1,
          },
        ],
      } as never,
      warnings: [],
      durationsMs: {},
    };
    const onContextTrimmed = jest.fn();
    const budget = 500;
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE", {
      maxContextChars: budget,
      onContextTrimmed,
    });

    expect(prompt).toContain("BASE");
    expect(prompt).toContain("Context Truncated");
    expect(onContextTrimmed).toHaveBeenCalledTimes(1);
    expect(onContextTrimmed.mock.calls[0][0]).toMatchObject({
      truncatedBlock: true,
    });
    // basePrompt is exempt; injected context respects the budget (+small notice).
    expect(prompt.length).toBeLessThanOrEqual(budget + "BASE".length + 400);
  });

  it("drops lower-priority blocks that do not fit while keeping the ones that do", () => {
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "source_lookup",
      sources: { semanticVectorSearch: { query: "evidence" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      semanticVectorResults: {
        results: [
          {
            content: "Z".repeat(1000),
            sourceTable: "document_chunks",
            recordId: 1,
          },
        ],
      } as never,
      executiveBriefingRetrieval: { summary: "B".repeat(1000) } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE", {
      maxContextChars: 1400,
    });

    // Higher-priority vector block survives; lower-priority briefing is dropped.
    expect(prompt).toContain("Vector Search Results");
    expect(prompt).not.toContain("Recent Communication Signals");
    expect(prompt).toContain("Context Truncated");
  });

  it("leaves a normal-sized injected context untouched (no truncation notice)", () => {
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "source_lookup",
      sources: { semanticVectorSearch: { query: "evidence" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      semanticVectorResults: {
        results: [
          {
            content: "short passage",
            sourceTable: "document_chunks",
            recordId: 1,
          },
        ],
      } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE_PROMPT");
    expect(prompt).toContain("Vector Search Results");
    expect(prompt).not.toContain("Context Truncated");
  });

  it("frames preloaded packet and snapshot as project operating context with RAG as drilldown", () => {
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "source_lookup",
      sources: {
        intelligencePacket: { mode: "additive" },
        projectSnapshot: { reason: "intent" },
        semanticVectorSearch: { query: "show me the spec evidence" },
      },
      selectedProjectId: 67,
      reason: "project_context_source_lookup_intent",
    };
    const ctx: RetrievalContext = {
      intelligencePacket: {
        id: "p1",
        executiveSummary: "baseline read",
      } as never,
      projectSnapshot: { projectName: "Vermillion Rise" },
      semanticVectorResults: {
        results: [{ content: "spec passage", sourceTable: "document_chunks" }],
      } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE_PROMPT");

    expect(prompt).toContain("Project Operating Context");
    expect(prompt).toContain("baseline expert read");
    expect(prompt).toContain("Use vector/source-specific RAG as drilldown");
    expect(prompt.indexOf("Project Operating Context")).toBeLessThan(
      prompt.indexOf("Current Project Intelligence Packet"),
    );
  });

  it("includes warnings list when sources timed out", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        research: {
          version: 1,
          visibility: "closed",
          requests: [
            { source: "meetings", required: true, authority: "operating_only", query: "test" },
            { source: "teams", required: true, authority: "operating_only", query: "test" },
          ],
        },
      },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      warnings: [
        { source: "meetings", message: "timeout after 3000ms" },
        { source: "teams", message: "timeout after 3000ms" },
      ],
      researchReceipts: [
        { source: "meetings", required: true, authority: "operating_only", toolName: "searchMeetingsByTopic", status: "timed_out", durationMs: 3000, error: "timeout after 3000ms" },
        { source: "teams", required: true, authority: "operating_only", toolName: "searchTeamsMessages", status: "timed_out", durationMs: 3000, error: "timeout after 3000ms" },
      ],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");
    expect(prompt).toMatch(/sources unavailable/i);
    expect(prompt).toContain("meetings");
    expect(prompt).toContain("teams");
    expect(prompt).toContain("BASE");
  });

  it("includes structured Outlook inbox results separately from source-specific RAG", () => {
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
    const ctx: RetrievalContext = {
      recentEmailInbox: {
        count: 1,
        threads: [
          {
            latestSubject: "Owner approval needed",
            latestPreview: "Please respond today.",
          },
        ],
      },
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");
    expect(prompt).toContain("Structured Outlook Inbox Result");
    expect(prompt).toContain("outlook_email_intake");
    expect(prompt).toContain("Owner approval needed");
    expect(prompt).not.toContain("Source-Specific RAG Result");
  });

  it("renders latest-available email fallback metadata for stale same-day windows", () => {
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
    const ctx: RetrievalContext = {
      recentEmailInbox: {
        count: 5,
        latestAvailableFallback: true,
        requestedWindowEmpty: true,
        latestAvailableReceivedAt: "2026-05-18T16:55:09Z",
        summary:
          "No emails are synced in the requested today window; latest available synced mailbox messages returned instead.",
        threads: [
          {
            latestSubject: "Re: RI-3959-0012 May Final Pay App",
            latestPreview: "This has already been resolved. Thanks!",
          },
        ],
      },
      warnings: [],
      durationsMs: {},
    };

    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    expect(prompt).toContain("latestAvailableFallback: true");
    expect(prompt).toContain("requestedWindowEmpty: true");
    expect(prompt).toContain("latestAvailableReceivedAt: 2026-05-18T16:55:09Z");
    expect(prompt).toContain("latest available synced mailbox messages");
    expect(prompt).toContain("RI-3959-0012");
  });

  it("orders sections deterministically: packet → snapshot → vector → briefing → rag → warnings → BASE", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        projectSnapshot: { reason: "intent" },
        semanticVectorSearch: { query: "x" },
      },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      intelligencePacket: { id: "p1" } as never,
      projectSnapshot: { sourceRef: "snap" } as never,
      semanticVectorResults: {
        results: [{ content: "abc", sourceTable: "doc" }],
      } as never,
      warnings: [{ source: "meetings", message: "timeout" }],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    const idxPacket = prompt.indexOf("Current Project Intelligence Packet");
    const idxSnapshot = prompt.indexOf("Project Briefing Snapshot");
    const idxVector = prompt.indexOf("Vector Search Results");
    const idxWarnings = prompt.indexOf("Sources Unavailable");
    const idxBase = prompt.indexOf("BASE");

    expect(idxPacket).toBeGreaterThan(-1);
    expect(idxSnapshot).toBeGreaterThan(idxPacket);
    expect(idxVector).toBeGreaterThan(idxSnapshot);
    expect(idxWarnings).toBeGreaterThan(idxVector);
    expect(idxBase).toBeGreaterThan(idxWarnings);
  });

  // ---------------------------------------------------------------------
  // Regression guards: prompt size budget
  //
  // Bug: V2 returned empty model output ("finishReason: other") because the
  // assembled system prompt was ~52K chars / ~13K tokens — the AI Gateway
  // bailed out of the request before producing any output. Root cause was
  // JSON.stringify(value, null, 2) on every retrieved source, plus full
  // 5000-char meeting transcripts repeated 8× in the vector results.
  // ---------------------------------------------------------------------

  it("renders vector results compactly — never JSON.stringify with whitespace indent", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { semanticVectorSearch: { query: "x" } },
      reason: "test",
    };
    const longContent = "A".repeat(5000);
    const ctx: RetrievalContext = {
      semanticVectorResults: {
        query: "x",
        resultCount: 8,
        results: Array.from({ length: 8 }, (_, i) => ({
          content: longContent,
          sourceTable: "meeting_transcript",
          recordId: `rec-${i}`,
          sourceDocumentId: `doc-${i}`,
          sourceChunkId: `chunk-${i}`,
          similarity: 0.5,
          finalScore: 0.5,
          projectIds: [42],
          metadata: { chunk_index: i, foo: "bar".repeat(500) },
          createdAt: "2025-01-01",
        })),
      } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    // Markdown rendering, not pretty-printed JSON
    expect(prompt).toContain("### [1] meeting_transcript");
    expect(prompt).toContain("[truncated]");
    expect(prompt).not.toMatch(/\n {2}"content": /); // no 2-space-indented JSON
  });

  it("caps total assembled prompt under the retrieval budget even with bloated sources", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        projectSnapshot: { reason: "intent" },
        semanticVectorSearch: { query: "x" },
        research: {
          version: 1,
          visibility: "closed",
          requests: [{ source: "meetings", required: true, authority: "operating_only", query: "x" }],
        },
      },
      reason: "test",
    };
    const huge = "x".repeat(50_000);
    const ctx: RetrievalContext = {
      intelligencePacket: {
        executiveSummary: huge,
        cards: [{ title: huge }],
      } as never,
      projectSnapshot: { huge } as never,
      semanticVectorResults: {
        results: Array.from({ length: 12 }, () => ({
          content: huge,
          sourceTable: "meeting_transcript",
          similarity: 0.4,
        })),
      } as never,
      executiveBriefingRetrieval: { sources: [{ huge }] } as never,
      researchReceipts: [{
        source: "meetings",
        required: true,
        authority: "operating_only",
        toolName: "searchMeetingsByTopic",
        status: "complete",
        durationMs: 10,
        payload: { results: [{ content: huge }] },
      }],
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    // Retrieval block capped at ~30K + base prompt + a little structural overhead.
    // 35_000 leaves comfortable headroom over the 30_000 cap for separators.
    expect(prompt.length).toBeLessThan(35_000);
    expect(prompt).toContain("BASE");
  });

  it("limits semantic results to top N even if executor returned more", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { semanticVectorSearch: { query: "x" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      semanticVectorResults: {
        results: Array.from({ length: 20 }, (_, i) => ({
          content: `result-${i}`,
          sourceTable: "doc",
          similarity: 0.5,
        })),
      } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");
    expect(prompt).toContain("### [1] doc");
    expect(prompt).toContain("### [8] doc");
    expect(prompt).not.toContain("### [9] doc");
  });

  it("renders intelligence packet without packetJson or evidence blobs", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { intelligencePacket: { mode: "additive" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      intelligencePacket: {
        id: "p1",
        targetId: "t1",
        executiveSummary: "summary text",
        packetJson: { huge: "x".repeat(20_000) },
        cards: [
          {
            title: "Risks",
            summary: "risk summary",
            evidence: [{ huge: "x".repeat(20_000) }],
            metadata: { huge: "x".repeat(20_000) },
          },
        ],
      } as never,
      warnings: [],
      durationsMs: {},
    };
    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    expect(prompt).toContain("summary text");
    expect(prompt).toContain("Risks");
    expect(prompt).not.toContain("packetJson");
    // Heavy fields should not be dumped into the prompt — `xxxx...` is the
    // 20K-char filler used for evidence/metadata/packetJson in the fixture.
    expect(prompt).not.toContain("xxxxxxxxxx");
    expect(prompt.length).toBeLessThan(5_000);
  });

  it("renders operating packet meeting coverage and strategic report without dumping packetJson", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { intelligencePacket: { mode: "additive" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      intelligencePacket: {
        id: "p1",
        executiveSummary:
          "Union Collective is moving from concept to permit-ready design.",
        currentStatus:
          "Design is active, but permit and budget decisions need attention.",
        recommendedNextMoves: ["Lock design decisions"],
        sourceCoverage: {
          linkedEvidenceCount: 90,
          categoryCoverage: [
            {
              label: "Meetings",
              sourceCount: 32,
              availableCount: 32,
              latestAt: "2026-05-14T14:00:00Z",
            },
            { label: "Emails", sourceCount: 20, availableCount: 383 },
          ],
          sourceQualityCounts: {
            clean_source: 63,
            metadata_only: 33,
            raw_dump: 0,
          },
        },
        packetJson: {
          huge: "x".repeat(20_000),
          strategicReport: {
            risks: [
              {
                title: "Permit schedule may slip",
                recommendedAction:
                  "Escalate unresolved permit-blocking decisions.",
                severity: "high",
              },
            ],
            moneyImpact: {
              summary: "Scope growth needs current estimate reconciliation.",
            },
            recommendedActions: [
              {
                title: "Reconcile budget and current estimate",
                reason: "Scope growth needs cost control.",
                priority: "high",
              },
            ],
          },
        },
        cards: [],
      } as never,
      warnings: [],
      durationsMs: {},
    };

    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    expect(prompt).toContain("Meetings: 32 selected / 32 available");
    expect(prompt).toContain("do not claim no meeting transcripts surfaced");
    expect(prompt).toContain("Permit schedule may slip");
    expect(prompt).toContain(
      "Scope growth needs current estimate reconciliation",
    );
    expect(prompt).not.toContain("packetJson");
    expect(prompt).not.toContain("xxxxxxxxxx");
  });

  it("renders compact document intelligence from the packet source coverage", () => {
    const plan: RetrievalPlan = {
      intent: "latest_status",
      responseFormat: "briefing_template",
      sources: { intelligencePacket: { mode: "additive" } },
      reason: "test",
    };
    const ctx: RetrievalContext = {
      intelligencePacket: {
        id: "p1",
        executiveSummary: "Union Collective has document risk.",
        sourceCoverage: {
          documentIntelligence: {
            latestByCategory: [
              {
                category: "specification",
                label: "Specifications",
                latest: {
                  title: "08 11 13 Hollow Metal Doors",
                  sourceId: "specification:081113",
                },
                projectImpact:
                  "Specification context can affect required materials and inspections.",
              },
            ],
            obligations: [
              {
                title: "08 11 13 Hollow Metal Doors",
                obligation:
                  "Specification requires approved door hardware submittals before fabrication.",
                sourceIds: ["specification:081113"],
              },
            ],
            conflictSignals: [
              {
                title: "A-201 Floor Plan",
                conflictSignal:
                  "Drawing was superseded by a revised owner plan.",
                sourceIds: ["drawing:A201-old"],
              },
            ],
          },
        },
        cards: [],
      } as never,
      warnings: [],
      durationsMs: {},
    };

    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    expect(prompt).toContain("Document Intelligence");
    expect(prompt).toContain("08 11 13 Hollow Metal Doors");
    expect(prompt).toContain(
      "Specification requires approved door hardware submittals",
    );
    expect(prompt).toContain("A-201 Floor Plan");
    expect(prompt).toContain("Use this as the document baseline");
  });

  it("wraps source-specific RAG content as internal evidence, not final answer copy", () => {
    const plan: RetrievalPlan = {
      intent: "source_lookup",
      responseFormat: "briefing_template",
      sources: { sourceSpecificRag: { kind: "recent_teams_discussions" } },
      reason: "source_specific_rag_recent_teams_discussions",
    };
    const ctx: RetrievalContext = {
      sourceSpecificRagAnswer: {
        content:
          "## Teams Message Evidence For Synthesis\n\nFreshness: checked Teams.\n\n1. **Teams conversation** - Evidence: pricing follow-up.",
        rows: [],
      },
      warnings: [],
      durationsMs: {},
    };

    const prompt = assembleSystemPromptFromContext(plan, ctx, "BASE");

    expect(prompt).toContain("# Internal Source-Specific RAG Evidence");
    expect(prompt).toContain("Do NOT copy this block");
    expect(prompt).toContain("Final-answer contract");
    expect(prompt).toContain("never begin the user-visible response");
    expect(prompt).toContain("Teams Message Evidence For Synthesis");
    expect(prompt).toContain("Do not output raw evidence rows");
  });
});

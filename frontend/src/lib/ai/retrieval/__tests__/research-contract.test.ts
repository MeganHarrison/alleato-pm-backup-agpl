import type { ToolSet } from "ai";
import {
  classifyResearchResult,
  compileChatTurnResearchContract,
  mergeResearchReceipts,
  mergeResearchQueryResults,
  researchCoverageComplete,
  researchReceiptFromToolTrace,
  researchReceiptCitations,
  researchReceiptEvidenceText,
  researchTimeoutMs,
  selectToolsForResearchContract,
  type ResearchReceipt,
} from "../research-contract";

describe("Chat-turn research contract", () => {
  const message =
    "Map the process after searching meeting transcripts, emails, Teams messages, and OneDrive documents.";

  it("compiles one ordered contract for every explicitly requested source", () => {
    const contract = compileChatTurnResearchContract({ message });

    expect(contract?.requests.map((request) => request.source)).toEqual([
      "meetings",
      "email",
      "teams",
      "onedrive",
    ]);
    expect(contract?.requests.map((request) => request.authority)).toEqual([
      "operating_only",
      "operating_only",
      "operating_only",
      "operating_only",
    ]);
    expect(
      contract?.requests.find((request) => request.source === "meetings"),
    ).toMatchObject({
      query: message,
      queries: [message],
    });
  });

  it("projects the exact closed tool set and fails loudly when a reader is missing", () => {
    const contract = compileChatTurnResearchContract({ message });
    const tools = {
      searchMeetingsByTopic: {},
      searchEmails: {},
      searchTeamsMessages: {},
      searchExternalDocuments: {},
      semanticSearch: {},
    } as ToolSet;

    expect(Object.keys(selectToolsForResearchContract(tools, contract)).sort()).toEqual([
      "searchEmails",
      "searchExternalDocuments",
      "searchMeetingsByTopic",
      "searchTeamsMessages",
    ]);

    const { searchTeamsMessages: _missing, ...incompleteTools } = tools;
    expect(() =>
      selectToolsForResearchContract(incompleteTools as ToolSet, contract),
    ).toThrow("Chat-turn research tools are unavailable: missing searchTeamsMessages");

    const resolvedReceipts = contract?.requests.map((request) => ({
      source: request.source,
      required: true as const,
      authority: request.authority,
      toolName:
        request.source === "meetings"
          ? "searchMeetingsByTopic"
          : request.source === "email"
            ? "searchEmails"
            : request.source === "teams"
              ? "searchTeamsMessages"
              : "searchExternalDocuments",
      status: "complete" as const,
      durationMs: 1,
      payload: { results: [{ id: request.source }] },
    }));
    expect(
      Object.keys(
        selectToolsForResearchContract(tools, contract, resolvedReceipts),
      ),
    ).toEqual([]);
  });

  it("owns bounded source-specific execution budgets", () => {
    expect(researchTimeoutMs("meetings")).toBe(12_000);
    expect(researchTimeoutMs("email")).toBe(8_000);
    expect(researchTimeoutMs("meetings")).toBeGreaterThan(
      researchTimeoutMs("email"),
    );
    expect(researchTimeoutMs("meetings", 4)).toBe(48_000);
    expect(researchTimeoutMs("email", 4)).toBe(32_000);
    expect(() => researchTimeoutMs("teams", 0)).toThrow(
      "Research query count must be a positive integer",
    );
  });

  it("deduplicates expanded query evidence and renders usable prompt content", () => {
    const payload = mergeResearchQueryResults(
      ["kickoff", "schedule"],
      [
        {
          results: [
            { documentId: "m1", title: "Kickoff review", summary: "First summary" },
          ],
        },
        {
          results: [
            { documentId: "m1", title: "Kickoff review", summary: "First summary" },
            { documentId: "m2", title: "Budget review", summary: "Second summary" },
          ],
        },
      ],
    );
    expect(payload.resultCount).toBe(2);
    const evidence = researchReceiptEvidenceText({
      source: "meetings",
      required: true,
      authority: "operating_only",
      toolName: "searchMeetingsByTopic",
      status: "complete",
      durationMs: 1,
      payload,
    });
    expect(evidence).toContain("Kickoff review");
    expect(evidence).toContain("First summary");
    expect(evidence).toContain("Budget review");
    expect(evidence).not.toContain("[object Object]");
  });

  it("distinguishes empty, denied, unavailable, and failed source outcomes", () => {
    expect(classifyResearchResult({ results: [] })).toEqual({ status: "empty" });
    expect(classifyResearchResult({ count: 0, results: [] })).toEqual({ status: "empty" });
    expect(
      classifyResearchResult({ error: "Email access is admin-only in Alleato." }),
    ).toEqual({
      status: "denied",
      error: "Email access is admin-only in Alleato.",
    });
    expect(
      classifyResearchResult({
        results: [],
        message:
          "You do not have access to that project. Pick a project you are assigned to or change the project context.",
      }),
    ).toEqual({
      status: "denied",
      error:
        "You do not have access to that project. Pick a project you are assigned to or change the project context.",
    });
    expect(classifyResearchResult(null).status).toBe("unavailable");
    expect(classifyResearchResult({ error: "Teams search timed out" }).status).toBe(
      "timed_out",
    );
    expect(
      classifyResearchResult({
        results: [{ id: "m1" }],
        semanticSearchDegraded: true,
      }).status,
    ).toBe("failed");
    expect(classifyResearchResult({ error: "query exploded" }).status).toBe("failed");
  });

  it("rejects complete coverage when a required receipt is absent or failed", () => {
    const contract = compileChatTurnResearchContract({
      message: "Search meetings, email, and Teams for the process.",
    });
    const receipts: ResearchReceipt[] = [
      {
        source: "meetings",
        required: true,
        authority: "operating_only",
        toolName: "searchMeetingsByTopic",
        status: "complete",
        durationMs: 10,
        payload: { results: [{ id: "m1", title: "Project kickoff" }] },
      },
      {
        source: "email",
        required: true,
        authority: "operating_only",
        toolName: "searchEmails",
        status: "failed",
        durationMs: 10,
        error: "query failed",
      },
    ];

    expect(researchCoverageComplete(contract, receipts)).toBe(false);
    receipts[1] = {
      source: "email",
      required: true,
      authority: "operating_only",
      toolName: "searchEmails",
      status: "empty",
      durationMs: 10,
      payload: { count: 0, results: [] },
    };
    receipts.push({
      source: "teams",
      required: true,
      authority: "operating_only",
      toolName: "searchTeamsMessages",
      status: "empty",
      durationMs: 10,
      payload: { count: 0, results: [] },
    });
    expect(researchCoverageComplete(contract, receipts)).toBe(true);
  });

  it("projects source citations from the same receipts", () => {
    const citations = researchReceiptCitations([
      {
        source: "email",
        required: true,
        authority: "operating_only",
        toolName: "searchEmails",
        status: "complete",
        durationMs: 5,
        payload: {
          results: [
            {
              id: "email-1",
              subject: "Approval path",
              content: "Engineering review follows estimating handoff.",
              url: "/emails/email-1",
            },
          ],
        },
      },
    ]);

    expect(citations).toEqual([
      expect.objectContaining({
        source: "email",
        documentId: "email-1",
        title: "Approval path",
        url: "/emails/email-1",
      }),
    ]);
  });

  it("shares the citation cap across successful sources", () => {
    const receipts: ResearchReceipt[] = [
      {
        source: "meetings",
        required: true,
        authority: "operating_only",
        toolName: "searchMeetingsByTopic",
        status: "complete",
        durationMs: 5,
        payload: {
          results: Array.from({ length: 12 }, (_, index) => ({
            id: `meeting-${index}`,
            title: `Meeting ${index}`,
            summary: "Meeting evidence",
          })),
        },
      },
      {
        source: "teams",
        required: true,
        authority: "operating_only",
        toolName: "searchTeamsMessages",
        status: "complete",
        durationMs: 5,
        payload: {
          results: [
            {
              documentId: "teams-1",
              title: "Project Teams thread",
              content: "Teams evidence",
            },
          ],
        },
      },
    ];

    const citations = researchReceiptCitations(receipts);
    expect(citations).toHaveLength(12);
    expect(citations.some((citation) => citation.source === "teams")).toBe(true);
  });

  it("turns only requested primary live readers into receipts", () => {
    const contract = compileChatTurnResearchContract({
      message: "Search meetings and email for the process.",
    });

    expect(
      researchReceiptFromToolTrace(contract, {
        tool: "searchMeetingsByTopic",
        output: { results: [{ id: "m1", title: "Project kickoff" }] },
        durationMs: 42,
      }),
    ).toEqual(
      expect.objectContaining({
        source: "meetings",
        status: "complete",
        durationMs: 42,
      }),
    );
    expect(
      researchReceiptFromToolTrace(contract, {
        tool: "someUnrelatedAnalysisTool",
        output: { verdict: "compliant" },
      }),
    ).toBeNull();
  });

  it("merges live retries without downgrading successful evidence", () => {
    const contract = compileChatTurnResearchContract({
      message: "Search meetings, email, and Teams for the process.",
    });
    const receipt = (
      source: "meetings" | "email" | "teams",
      status: ResearchReceipt["status"],
      payload?: unknown,
    ): ResearchReceipt => ({
      source,
      required: true,
      authority: "operating_only",
      toolName:
        source === "meetings"
          ? "searchMeetingsByTopic"
          : source === "email"
            ? "searchEmails"
            : "searchTeamsMessages",
      status,
      durationMs: 10,
      ...(payload === undefined ? {} : { payload }),
    });

    expect(
      mergeResearchReceipts(
        contract,
        [
          receipt("meetings", "timed_out"),
          receipt("email", "timed_out"),
          receipt("teams", "complete", { results: [{ id: "t1" }] }),
        ],
        [
          receipt("meetings", "complete", { results: [{ id: "m1" }] }),
          receipt("email", "empty", { results: [] }),
          receipt("teams", "failed"),
        ],
      ).map(({ source, status }) => ({ source, status })),
    ).toEqual([
      { source: "meetings", status: "complete" },
      { source: "email", status: "empty" },
      { source: "teams", status: "complete" },
    ]);
  });
});

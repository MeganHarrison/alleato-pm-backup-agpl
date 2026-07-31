jest.mock("server-only", () => ({}));
jest.mock("../project-intelligence-summary", () => ({
  summarizeProjectIntelligence: jest.fn(),
}));

import { summarizeProjectIntelligence } from "../project-intelligence-summary";
import {
  buildSourceSyncSummarySources,
  listSourceSyncAiBriefSnapshots,
  saveSourceSyncAiBriefSnapshot,
  summarizeSourceSyncHealth,
  type SourceSyncRunSnapshotLedger,
} from "../source-sync-summary";
import type { SourceSyncStatus } from "@/app/api/admin/source-sync/_contracts";

const summarizeProjectIntelligenceMock =
  summarizeProjectIntelligence as jest.MockedFunction<
    typeof summarizeProjectIntelligence
  >;
function makeStatus(overrides: Partial<SourceSyncStatus> = {}): SourceSyncStatus {
  return {
    status: "degraded",
    healthy: false,
    generatedAt: "2026-05-11T20:00:00.000Z",
    thresholds: {},
    sources: [
      {
        source: "graph",
        resourceId: "mailbox-1",
        resourceName: "Owner mailbox",
        status: "warning",
        lastSyncAt: "2026-05-11T19:00:00.000Z",
        lastSuccessAt: "2026-05-11T18:00:00.000Z",
        lastErrorAt: null,
        lastErrorMessage: null,
        itemsSynced: 42,
        staleMinutes: 60,
        unprocessedCount: 2,
        unembeddedCount: 5,
        uncompiledCount: 7,
        metadata: {},
      },
    ],
    pipeline: {},
    alerts: [
      {
        severity: "critical",
        code: "source_sync_error",
        source: "graph",
        resourceId: "mailbox-1",
        message: "Graph embedding failed for recent messages.",
        detectedAt: "2026-05-11T19:30:00.000Z",
      },
    ],
    recentRuns: [
      {
        id: "run-1",
        source: "graph",
        stage: "embed",
        status: "failed",
        resourceId: "mailbox-1",
        resourceName: "Owner mailbox",
        startedAt: "2026-05-11T19:10:00.000Z",
        finishedAt: "2026-05-11T19:12:00.000Z",
        itemsSeen: 10,
        itemsSynced: 5,
        itemsFailed: 5,
        errorCode: "embedding_failed",
        errorMessage: "AI Gateway embedding request failed.",
        metadata: {},
      },
    ],
    stuckItems: [
      {
        source: "fireflies",
        resourceId: "meeting-1",
        resourceName: "OAC meeting",
        stage: "embedded",
        status: "stuck",
        ageMinutes: 180,
        lastAttemptAt: "2026-05-11T17:00:00.000Z",
        errorMessage: "Project Intelligence evidence is missing for the embedded meeting.",
        metadata: {},
      },
    ],
    counts: {
      sources: 1,
      alerts: 1,
      documents: 25,
      chunks: 100,
      unembedded: 5,
      uncompiled: 7,
      tasks: 3,
      graphSubscriptions: 2,
      stuckItems: 1,
    },
    ...overrides,
  };
}

describe("source-sync-summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    summarizeProjectIntelligenceMock.mockResolvedValue({
      schema: "project_intelligence_summary_v1",
      model: "openai/gpt-4.1-nano",
      sourceCount: 1,
      sourceIds: ["source-sync:counts"],
      headline: "Source sync is behind.",
      context: "Graph and Fireflies processing need attention.",
      risks: [],
      decisions: [],
      actionItems: [],
      dataGaps: [],
      confidence: "high",
    });
  });

  it("maps source sync health into traceable summarization sources", () => {
    const sources = buildSourceSyncSummarySources(makeStatus());

    expect(sources.length).toBeLessThanOrEqual(20);
    expect(sources[0]).toMatchObject({
      id: "source-sync:counts",
      type: "source_sync",
      title: "Source sync aggregate counts",
    });
    expect(sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("source-sync:alert:source_sync_error:graph:mailbox-1"),
        "source-sync:run:run-1",
        expect.stringContaining("source-sync:stuck:fireflies:meeting-1:embedded"),
      ]),
    );
    expect(sources.map((source) => source.text).join("\n")).toContain(
      "5 items are not searchable",
    );
    expect(sources.map((source) => source.text).join("\n")).not.toContain(
      "uncompiled",
    );
  });

  it("calls the shared project intelligence summarizer with source_sync focus", async () => {
    await summarizeSourceSyncHealth(makeStatus());

    expect(summarizeProjectIntelligenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: "source_sync",
        sources: expect.arrayContaining([
          expect.objectContaining({ id: "source-sync:counts" }),
        ]),
      }),
    );
  });

  it("caps rich source sync health below the shared summarizer source limit", () => {
    const status = makeStatus({
      alerts: Array.from({ length: 20 }, (_, index) => ({
        severity: index % 2 === 0 ? "critical" : "warning",
        code: "source_sync_error",
        source: "graph",
        resourceId: `alert-${index}`,
        message: `Graph source ${index} failed.`,
        detectedAt: "2026-05-11T19:30:00.000Z",
      })),
      stuckItems: Array.from({ length: 20 }, (_, index) => ({
        source: "fireflies",
        resourceId: `meeting-${index}`,
        resourceName: `OAC meeting ${index}`,
        stage: "embedded",
        status: "stuck",
        ageMinutes: 180 + index,
        lastAttemptAt: "2026-05-11T17:00:00.000Z",
        errorMessage: "Project Intelligence evidence is missing for the embedded meeting.",
        metadata: {},
      })),
      sources: Array.from({ length: 20 }, (_, index) => ({
        source: "graph",
        resourceId: `mailbox-${index}`,
        resourceName: `Mailbox ${index}`,
        status: "critical",
        lastSyncAt: "2026-05-11T19:00:00.000Z",
        lastSuccessAt: "2026-05-11T18:00:00.000Z",
        lastErrorAt: null,
        lastErrorMessage: null,
        itemsSynced: 42,
        staleMinutes: 60,
        unprocessedCount: 2,
        unembeddedCount: 5,
        uncompiledCount: 7,
        metadata: {},
      })),
      recentRuns: Array.from({ length: 20 }, (_, index) => ({
        id: `run-${index}`,
        source: "graph",
        stage: "embed",
        status: "failed",
        resourceId: `mailbox-${index}`,
        resourceName: `Mailbox ${index}`,
        startedAt: "2026-05-11T19:10:00.000Z",
        finishedAt: "2026-05-11T19:12:00.000Z",
        itemsSeen: 10,
        itemsSynced: 5,
        itemsFailed: 5,
        errorCode: "embedding_failed",
        errorMessage: "AI Gateway embedding request failed.",
        metadata: {},
      })),
    });

    expect(buildSourceSyncSummarySources(status)).toHaveLength(20);
  });

  it("saves generated briefs into the source sync run ledger with structured metadata", async () => {
    const ledger: SourceSyncRunSnapshotLedger = {
      insertAiBriefSnapshot: jest.fn().mockResolvedValue({
        data: {
          id: "snapshot-run-1",
          finished_at: "2026-05-11T20:05:00.000Z",
          items_seen: 1,
        },
        error: null,
      }),
      listAiBriefSnapshots: jest.fn(),
    };

    const snapshot = await saveSourceSyncAiBriefSnapshot({
      status: makeStatus(),
      summary: await summarizeSourceSyncHealth(makeStatus()),
      generatedByUserId: "user-1",
      ledger,
    });

    expect(snapshot).toEqual({
      id: "snapshot-run-1",
      generatedAt: "2026-05-11T20:05:00.000Z",
      sourceCount: 1,
    });
    expect(ledger.insertAiBriefSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "source_sync_ai_brief",
        resource_id: "source-sync",
        resource_name: "Source Sync AI Brief",
        stage: "intelligence_compile",
        status: "succeeded",
        items_seen: 1,
        items_synced: 1,
        items_failed: 0,
        metadata: expect.objectContaining({
          kind: "source_sync_ai_brief",
          generatedByUserId: "user-1",
          statusGeneratedAt: "2026-05-11T20:00:00.000Z",
          healthStatus: "degraded",
          counts: expect.objectContaining({ alerts: 1 }),
          summary: expect.objectContaining({
            headline: "Source sync is behind.",
          }),
        }),
      }),
    );
  });

  it("fails loudly when the source sync AI brief snapshot cannot be saved", async () => {
    const ledger: SourceSyncRunSnapshotLedger = {
      insertAiBriefSnapshot: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      }),
      listAiBriefSnapshots: jest.fn(),
    };

    await expect(
      saveSourceSyncAiBriefSnapshot({
        status: makeStatus(),
        summary: await summarizeSourceSyncHealth(makeStatus()),
        generatedByUserId: "user-1",
        ledger,
      }),
    ).rejects.toThrow(
      "Failed to save source sync AI brief snapshot: permission denied",
    );
  });

  it("lists recent saved source sync AI brief snapshots from ledger metadata", async () => {
    const ledger: SourceSyncRunSnapshotLedger = {
      insertAiBriefSnapshot: jest.fn(),
      listAiBriefSnapshots: jest.fn().mockResolvedValue({
        data: [
          {
            id: "snapshot-run-2",
            finished_at: "2026-05-11T21:05:00.000Z",
            started_at: "2026-05-11T21:04:59.000Z",
            items_seen: 20,
            metadata: {
              healthStatus: "degraded",
              summary: {
                model: "openai/gpt-4.1-nano",
                headline: "Source sync still needs attention.",
                context: "Graph sync is behind and needs operator follow-up.",
                confidence: "medium",
                risks: [
                  {
                    title: "Embeddings are stale",
                    severity: "high",
                    recommendedAction: "Run targeted embedding retry.",
                  },
                ],
                actionItems: [
                  {
                    title: "Retry Graph embedding",
                    owner: "Ops",
                    dueDate: "2026-05-12",
                    priority: "high",
                  },
                ],
                dataGaps: ["Confirm whether Graph webhook delivery recovered."],
              },
            },
          },
        ],
        error: null,
      }),
    };

    await expect(
      listSourceSyncAiBriefSnapshots({ limit: 5, ledger }),
    ).resolves.toEqual([
      {
        id: "snapshot-run-2",
        generatedAt: "2026-05-11T21:05:00.000Z",
        sourceCount: 20,
        headline: "Source sync still needs attention.",
        context: "Graph sync is behind and needs operator follow-up.",
        confidence: "medium",
        healthStatus: "degraded",
        model: "openai/gpt-4.1-nano",
        risks: [
          {
            title: "Embeddings are stale",
            severity: "high",
            recommendedAction: "Run targeted embedding retry.",
          },
        ],
        actionItems: [
          {
            title: "Retry Graph embedding",
            owner: "Ops",
            dueDate: "2026-05-12",
            priority: "high",
          },
        ],
        dataGaps: ["Confirm whether Graph webhook delivery recovered."],
      },
    ]);
    expect(ledger.listAiBriefSnapshots).toHaveBeenCalledWith(5);
  });

  it("fails loudly when recent source sync AI brief snapshots cannot be listed", async () => {
    const ledger: SourceSyncRunSnapshotLedger = {
      insertAiBriefSnapshot: jest.fn(),
      listAiBriefSnapshots: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "database unavailable" },
      }),
    };

    await expect(
      listSourceSyncAiBriefSnapshots({ ledger }),
    ).rejects.toThrow(
      "Failed to list source sync AI brief snapshots: database unavailable",
    );
  });
});

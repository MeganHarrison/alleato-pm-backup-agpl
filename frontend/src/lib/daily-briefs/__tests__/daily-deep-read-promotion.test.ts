import { GuardrailError } from "@/lib/guardrails/errors";
import type { CanonicalDailyBriefPacket } from "../canonical-packets";
import {
  drainAcceptedDailyDeepReadPromotions,
  promoteAcceptedDailyDeepReadCandidates,
  promoteDailyDeepReadCandidate,
} from "../daily-deep-read-promotion";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<{ key: string; value: unknown }> = [];
  private inFilters: Array<{ key: string; values: unknown[] }> = [];
  private limitCount: number | null = null;
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;

  constructor(
    private readonly client: FakeSupabaseClient,
    private readonly tableName: string,
  ) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value });
    return this;
  }

  in(key: string, values: unknown[]) {
    this.inFilters.push({ key, values });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(payload: Row) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.executeSingle(false));
  }

  single() {
    return Promise.resolve(this.executeSingle(true));
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private executeSingle(required: boolean) {
    const result = this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    const data = rows[0] ?? null;
    if (required && !data) {
      return { data: null, error: { message: `${this.tableName} row not found` } };
    }
    return { data, error: result.error };
  }

  private execute() {
    if (this.mode === "insert") {
      const row = {
        ...this.payload,
        id: this.payload?.id ?? this.client.nextId(this.tableName),
      };
      this.client.rows(this.tableName).push(row);
      return { data: [row], error: null };
    }

    if (this.mode === "update") {
      const rows = this.matchingRows();
      rows.forEach((row) => Object.assign(row, this.payload));
      return { data: rows, error: null };
    }

    const rows = this.matchingRows();
    return {
      data: this.limitCount === null ? rows : rows.slice(0, this.limitCount),
      error: null,
    };
  }

  private matchingRows() {
    return this.client.rows(this.tableName).filter((row) => {
      const matchesEquals = this.filters.every(
        (filter) => valueAt(row, filter.key) === filter.value,
      );
      const matchesIn = this.inFilters.every((filter) =>
        filter.values.includes(valueAt(row, filter.key)),
      );
      return matchesEquals && matchesIn;
    });
  }
}

class FakeSupabaseClient {
  private sequences = new Map<string, number>();
  constructor(private readonly tables: Record<string, Row[]>) {}

  from(tableName: string) {
    return new FakeQuery(this, tableName);
  }

  rows(tableName: string) {
    this.tables[tableName] ??= [];
    return this.tables[tableName];
  }

  nextId(tableName: string) {
    const next = (this.sequences.get(tableName) ?? 0) + 1;
    this.sequences.set(tableName, next);
    return `${tableName}-${next}`;
  }
}

function valueAt(row: Row, key: string): unknown {
  const jsonPath = key.match(/^(.+)->>(.+)$/);
  if (!jsonPath) return row[key];
  const record = row[jsonPath[1]];
  return record && typeof record === "object" && !Array.isArray(record)
    ? (record as Row)[jsonPath[2]]
    : undefined;
}

const packet: CanonicalDailyBriefPacket = {
  id: "f5ba7ef9-a3d2-40d0-8ed6-907c327f2f64",
  targetId: "daily-target",
  packetType: "current",
  generatedAt: "2026-07-07T11:32:33.213Z",
  coveredStartAt: "2026-07-06T04:00:00.000Z",
  coveredEndAt: "2026-07-07T04:00:00.000Z",
  freshnessStatus: "fresh",
  businessDate: "2026-07-06",
  title: "Daily Executive Brief - 2026-07-06",
  executiveSummary: "Executive summary",
  currentStatus: "Active",
  strategicRead: null,
  whyItMatters: null,
  recommendedNextMoves: [],
  confidenceSummary: {},
  sourceCoverage: {},
  sourceCounts: {},
  sourceIds: [],
  sources: [],
  sourceCount: 0,
  briefMarkdown: "## Executive read\nSummary",
  sections: [{ title: "Executive read", body: "Summary" }],
  brief: null,
  compilerVersion: "daily-deep-read-v1",
};

function refreshProjectIntelligence() {
  return Promise.resolve({ ok: true });
}

function candidate(overrides: Row = {}): Row {
  return {
    id: "candidate-1",
    project_id: 1009,
    compiler_version: "daily_deep_read_consumers_v1",
    status: "candidate",
    current_status: "open",
    promoted_insight_card_id: null,
    signal_type: "task",
    title: "Force-close bidder coverage gap",
    summary: "At least four confirmed bidders are needed before the bid deadline.",
    why_it_matters: "Schedule protection depends on bidder coverage.",
    excerpt: null,
    confidence: "high",
    confidence_score: 0.9,
    source_chunk_id: null,
    source_document_id: `daily_packet:${packet.id}`,
    source_occurred_at: null,
    stale_after: null,
    suggested_owner_label: "Brandon",
    suggested_owner_person_id: null,
    target_id: null,
    next_action: "Confirm bidders.",
    normalized_signal_key: "candidate-1",
    extraction_json: {
      daily_packet_id: packet.id,
      source_policy: "Derived from daily_deep_read packet sections/source notes.",
    },
    created_at: "2026-07-07T12:00:00.000Z",
    updated_at: "2026-07-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("promoteDailyDeepReadCandidate", () => {
  it("creates a packet document, task, and promoted candidate for accepted task candidates", async () => {
    const appClient = new FakeSupabaseClient({
      intelligence_targets: [
        {
          id: "target-1009",
          target_type: "client_project",
          project_id: 1009,
          name: "Union Collective",
          slug: "union-collective",
          status: "active",
        },
      ],
      document_metadata: [],
      tasks: [],
      insight_cards: [],
    });
    const ragClient = new FakeSupabaseClient({
      source_signal_candidates: [candidate()],
    });

    const result = await promoteDailyDeepReadCandidate(
      { candidateId: "candidate-1", projectId: 1009, reviewedBy: "user-1" },
      {
        appClient: appClient as never,
        ragClient: ragClient as never,
        currentPacket: packet,
        refreshProjectIntelligence,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "task",
      createdRecordId: "tasks-1",
      targetId: "target-1009",
    });
    expect(appClient.rows("document_metadata")).toHaveLength(1);
    expect(appClient.rows("document_metadata")[0]).toMatchObject({
      id: packet.id,
      source_system: "daily_deep_read",
      project_id: 1009,
    });
    expect(appClient.rows("tasks")[0]).toMatchObject({
      id: "tasks-1",
      metadata_id: packet.id,
      project_id: 1009,
      source_system: "daily_deep_read",
      extraction_source: "daily_deep_read_candidate",
    });
    expect(appClient.rows("tasks")[0].extraction_metadata).toMatchObject({
      daily_deep_read_candidate_id: "candidate-1",
      daily_packet_id: packet.id,
      promoted_target_id: "target-1009",
    });
    expect(ragClient.rows("source_signal_candidates")[0]).toMatchObject({
      status: "promoted",
      current_status: "resolved",
      promoted_insight_card_id: "tasks-1",
    });
  });

  it("blocks duplicate promotion when an app record already exists", async () => {
    const appClient = new FakeSupabaseClient({
      intelligence_targets: [
        {
          id: "target-1009",
          target_type: "client_project",
          project_id: 1009,
          name: "Union Collective",
          slug: "union-collective",
          status: "active",
        },
      ],
      document_metadata: [],
      tasks: [
        {
          id: "existing-task",
          extraction_metadata: {
            daily_deep_read_candidate_id: "candidate-1",
          },
        },
      ],
      insight_cards: [],
    });
    const ragClient = new FakeSupabaseClient({
      source_signal_candidates: [candidate()],
    });

    await expect(
      promoteDailyDeepReadCandidate(
        { candidateId: "candidate-1", projectId: 1009 },
        {
          appClient: appClient as never,
          ragClient: ragClient as never,
          currentPacket: packet,
          refreshProjectIntelligence,
        },
      ),
    ).rejects.toMatchObject<Partial<GuardrailError>>({
      code: "PRECONDITION_FAILED",
    });

    expect(appClient.rows("tasks")).toHaveLength(1);
    expect(ragClient.rows("source_signal_candidates")[0].status).toBe("candidate");
  });

  it("batch-promotes accepted current-packet candidates and leaves review rows untouched", async () => {
    const appClient = new FakeSupabaseClient({
      intelligence_targets: [
        {
          id: "target-1009",
          target_type: "client_project",
          project_id: 1009,
          name: "Union Collective",
          slug: "union-collective",
          status: "active",
        },
      ],
      document_metadata: [],
      tasks: [],
      insight_cards: [],
    });
    const ragClient = new FakeSupabaseClient({
      source_signal_candidates: [
        candidate({ id: "candidate-task", normalized_signal_key: "candidate-task" }),
        candidate({
          id: "candidate-decision",
          normalized_signal_key: "candidate-decision",
          signal_type: "decision",
          title:
            "Decide bid leveling approach [outlook_AAMkADAwNzg3ZTA5LTJmMWEtNDczNi04ODcxLTk1YzExNTM3Y2Q2YQ]",
        }),
        candidate({
          id: "candidate-review",
          normalized_signal_key: "candidate-review",
          status: "needs_review",
        }),
      ],
    });

    const result = await promoteAcceptedDailyDeepReadCandidates(
      { projectId: 1009, reviewedBy: "user-1" },
      {
        appClient: appClient as never,
        ragClient: ragClient as never,
        currentPacket: packet,
        refreshProjectIntelligence,
      },
    );

    expect(result.promoted).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(appClient.rows("tasks")).toHaveLength(1);
    expect(appClient.rows("insight_cards")).toHaveLength(1);
    expect(appClient.rows("insight_cards")[0]).toMatchObject({
      card_type: "decision",
      title: "Decide bid leveling approach",
      primary_target_id: "target-1009",
    });
    expect(
      ragClient.rows("source_signal_candidates").map((row) => ({
        id: row.id,
        status: row.status,
      })),
    ).toEqual([
      { id: "candidate-task", status: "promoted" },
      { id: "candidate-decision", status: "promoted" },
      { id: "candidate-review", status: "needs_review" },
    ]);
  });

  it("batch promotion reports candidate failures and continues", async () => {
    const appClient = new FakeSupabaseClient({
      intelligence_targets: [
        {
          id: "target-1009",
          target_type: "client_project",
          project_id: 1009,
          name: "Union Collective",
          slug: "union-collective",
          status: "active",
        },
      ],
      document_metadata: [],
      tasks: [
        {
          id: "existing-task",
          extraction_metadata: {
            daily_deep_read_candidate_id: "candidate-task",
          },
        },
      ],
      insight_cards: [],
    });
    const ragClient = new FakeSupabaseClient({
      source_signal_candidates: [
        candidate({ id: "candidate-task", normalized_signal_key: "candidate-task" }),
        candidate({
          id: "candidate-decision",
          normalized_signal_key: "candidate-decision",
          signal_type: "decision",
        }),
      ],
    });

    const result = await promoteAcceptedDailyDeepReadCandidates(
      { projectId: 1009 },
      {
        appClient: appClient as never,
        ragClient: ragClient as never,
        currentPacket: packet,
        refreshProjectIntelligence,
      },
    );

    expect(result.promoted).toHaveLength(1);
    expect(result.failed).toEqual([
      {
        candidateId: "candidate-task",
        code: "PRECONDITION_FAILED",
        message: "Daily Deep Read candidate already has a promoted app record.",
      },
    ]);
    expect(ragClient.rows("source_signal_candidates")[0].status).toBe("candidate");
    expect(ragClient.rows("source_signal_candidates")[1].status).toBe("promoted");
  });

  it("drains accepted current-packet candidates across projects", async () => {
    const appClient = new FakeSupabaseClient({
      intelligence_targets: [
        {
          id: "target-1009",
          target_type: "client_project",
          project_id: 1009,
          name: "Union Collective",
          slug: "union-collective",
          status: "active",
        },
        {
          id: "target-1010",
          target_type: "client_project",
          project_id: 1010,
          name: "Second Project",
          slug: "second-project",
          status: "active",
        },
      ],
      document_metadata: [],
      tasks: [],
      insight_cards: [],
    });
    const ragClient = new FakeSupabaseClient({
      source_signal_candidates: [
        candidate({ id: "candidate-1009", normalized_signal_key: "candidate-1009" }),
        candidate({
          id: "candidate-1010",
          normalized_signal_key: "candidate-1010",
          project_id: 1010,
        }),
        candidate({
          id: "candidate-ignored",
          normalized_signal_key: "candidate-ignored",
          project_id: 1011,
          status: "needs_review",
        }),
      ],
    });

    const result = await drainAcceptedDailyDeepReadPromotions(
      { reviewedBy: "cron:test" },
      {
        appClient: appClient as never,
        ragClient: ragClient as never,
        currentPacket: packet,
        refreshProjectIntelligence,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      packetId: packet.id,
      projectsChecked: 2,
      promotedCount: 2,
      failedCount: 0,
    });
    expect(result.projects.map((project) => project.projectId).sort()).toEqual([1009, 1010]);
    expect(
      ragClient.rows("source_signal_candidates").map((row) => ({
        id: row.id,
        status: row.status,
      })),
    ).toEqual([
      { id: "candidate-1009", status: "promoted" },
      { id: "candidate-1010", status: "promoted" },
      { id: "candidate-ignored", status: "needs_review" },
    ]);
  });

  it("refreshes canonical project intelligence after successful promotion", async () => {
    const appClient = new FakeSupabaseClient({
      intelligence_targets: [
        {
          id: "target-1009",
          target_type: "client_project",
          project_id: 1009,
          name: "Union Collective",
          slug: "union-collective",
          status: "active",
        },
      ],
      document_metadata: [],
      tasks: [],
      insight_cards: [],
    });
    const ragClient = new FakeSupabaseClient({
      source_signal_candidates: [candidate()],
    });
    const refresh = jest.fn().mockResolvedValue({ ok: true });

    await promoteDailyDeepReadCandidate(
      { candidateId: "candidate-1", projectId: 1009 },
      {
        appClient: appClient as never,
        ragClient: ragClient as never,
        currentPacket: packet,
        refreshProjectIntelligence: refresh,
      },
    );

    expect(refresh).toHaveBeenCalledWith(1009);
  });
});

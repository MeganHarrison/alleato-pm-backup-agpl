import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  loadCurrentIntelligencePacket,
  resolveIntelligenceTarget,
} from "../intelligence/packet-service";

type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: null };

const rowsByTable: Record<string, Row[]> = {
  intelligence_targets: [
    {
      id: "target-1",
      target_type: "client_project",
      name: "Westfield Collective",
      slug: "westfield-collective",
      project_id: 43,
      status: "active",
    },
  ],
  intelligence_packets: [
    {
      id: "packet-1",
      target_id: "target-1",
      packet_type: "current",
      packet_version: "manual-v1",
      generated_at: "2026-04-30T00:00:00.000Z",
      covered_start_at: null,
      covered_end_at: "2026-04-22T00:00:00.000Z",
      freshness_status: "working_sample",
      executive_summary: "Executive summary",
      current_status: "Current status",
      strategic_read: "Strategic read",
      why_it_matters: "Why it matters",
      recommended_next_moves: ["Verify financials"],
      confidence_summary: { overall: "medium" },
      source_coverage: { projectEmailRows: 0 },
      review_queue_count: 1,
      stale_item_count: 0,
      packet_json: {},
      compiler_version: "manual-v1",
      created_at: "2026-04-30T00:00:00.000Z",
    },
  ],
  intelligence_packet_cards: [
    {
      id: "packet-card-1",
      packet_id: "packet-1",
      insight_card_id: "card-1",
      section: "current_read",
      rank: 10,
      included_reason: "test",
      created_at: "2026-04-30T00:00:00.000Z",
    },
  ],
  insight_cards: [
    {
      id: "card-1",
      primary_target_id: "target-1",
      title: "Current read",
      card_type: "project_update",
      summary: "Westfield is active.",
      why_it_matters: null,
      current_status: "open",
      confidence: "medium",
      attribution_status: "approved",
      suggested_owner_person_id: null,
      suggested_owner_label: null,
      next_action: "Verify latest sources.",
      first_seen_at: null,
      last_seen_at: null,
      stale_after: null,
      source_count: 1,
      compiler_version: "manual-v1",
      metadata: {},
      created_at: "2026-04-30T00:00:00.000Z",
      updated_at: "2026-04-30T00:00:00.000Z",
    },
  ],
  insight_card_evidence: [
    {
      id: "evidence-1",
      insight_card_id: "card-1",
      source_document_id: "doc-1",
      source_chunk_id: null,
      source_type: "teams_message",
      source_title: "Teams DM: Westfield Collective",
      source_occurred_at: "2026-04-22T00:00:00.000Z",
      source_message_id: null,
      participants: [],
      excerpt: "Contract language was discussed.",
      summary: "Westfield is active.",
      relevance_reason: "Recent project signal.",
      evidence_role: "recent_signal",
      confidence: "medium",
      created_at: "2026-04-30T00:00:00.000Z",
    },
  ],
  document_metadata: [
    {
      id: "doc-1",
      type: "teams_message",
      category: "chat",
      content: "Contract language was discussed.",
      raw_text: null,
      summary: "Westfield is active.",
      overview: null,
      description: null,
      notes: null,
    },
  ],
  intelligence_reviews: [],
  projects: [],
};

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private limitCount: number | null = null;

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  maybeSingle(): Promise<Result> {
    return Promise.resolve({ data: this.execute()[0] ?? null, error: null });
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.execute(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private execute(): Row[] {
    const rows = rowsByTable[this.table] ?? [];
    const filtered = rows.filter((row) => this.filters.every((filter) => filter(row)));
    return this.limitCount === null ? filtered : filtered.slice(0, this.limitCount);
  }
}

function createFakeSupabase(): SupabaseClient<Database> {
  return {
    from(table: string) {
      return new FakeQuery(table);
    },
  } as unknown as SupabaseClient<Database>;
}

describe("intelligence packet service", () => {
  it("resolves the selected project before asking for a project id", async () => {
    const target = await resolveIntelligenceTarget({
      query: "this project",
      selectedProjectId: 43,
      supabase: createFakeSupabase(),
    });

    expect(target?.projectId).toBe(43);
    expect(target?.slug).toBe("westfield-collective");
    expect(target?.source).toBe("selected_project");
  });

  it("loads the current packet with cards and evidence", async () => {
    const packet = await loadCurrentIntelligencePacket({
      targetId: "target-1",
      supabase: createFakeSupabase(),
    });

    expect(packet?.freshnessStatus).toBe("working_sample");
    expect(packet?.sourceCoverage.projectEmailRows).toBe(0);
    expect(packet?.cards).toHaveLength(1);
    expect(packet?.cards[0]?.evidence[0]?.sourceDocumentId).toBe("doc-1");
    expect(packet?.cards[0]?.evidence[0]?.sourceContentPreview).toBe(
      "Contract language was discussed.",
    );
  });
});

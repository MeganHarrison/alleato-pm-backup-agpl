jest.mock("server-only", () => ({}));
jest.mock("@/lib/ai/services/ai-memory-service", () => ({
  embed: jest.fn(),
}));
jest.mock("../asrs-rest.server", () => ({
  requestAsrsJson: jest.fn(),
}));
jest.mock("../fmds-tables.server", () => ({
  getFmdsTablesPageData: jest.fn(),
}));
jest.mock("../fmds-figures.server", () => ({
  getFmdsFiguresPageData: jest.fn(),
}));

import { readFileSync } from "node:fs";
import { embed } from "@/lib/ai/services/ai-memory-service";
import { requestAsrsJson } from "../asrs-rest.server";
import { getFmdsTablesPageData } from "../fmds-tables.server";
import { getFmdsFiguresPageData } from "../fmds-figures.server";
import { searchFmdsEvidence } from "../fmds-chat.server";

const revision = {
  id: "65306e47-c25a-4397-92a0-c44c03903d0f",
  document_code: "FMDS0834",
  revision_label: "2026-04",
  publication_date: "2026-04-01",
  status: "staging",
  source_file_name: "FMDS0834 - 2026.pdf",
  source_page_count: 122,
};

const match = {
  chunk_id: "chunk-1",
  revision_id: revision.id,
  document_code: "FMDS0834",
  revision_label: "2026-04",
  page_number: 12,
  citation_label: "FMDS 8-34 Table 2.1.4.5.4",
  section_path: "2.1.4.5",
  clause_reference: "2.1.4.5.4",
  content:
    "Standard-coverage sprinklers with 12 or fewer design sprinklers require 250 gpm.",
  similarity: 0.93,
  source_type: "native_text",
  source_id: null,
  source_identifier: null,
  review_event_id: null,
  candidate_id: null,
};

const structuredMatch = {
  ...match,
  chunk_id: "structured-chunk-1",
  citation_label: "FMDS0834 (2026-04), Table 2.1.4.5.4, PDF page 12",
  content:
    "Table 2.1.4.5.4 Row 1: Type: Standard-Coverage | Hose Demand: 250 (950)",
  similarity: 0.97,
  source_type: "table",
  source_id: "table-1",
  source_identifier: "2.1.4.5.4",
  review_event_id: "review-event-1",
  candidate_id: "candidate-1",
};

describe("searchFmdsEvidence", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (embed as jest.Mock).mockResolvedValue(
      Array.from({ length: 3072 }, () => 0.01),
    );
    (requestAsrsJson as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith("fmds_corpus_revisions"))
        return Promise.resolve([revision]);
      if (path === "rpc/match_staging_fmds_chunks")
        return Promise.resolve([match]);
      throw new Error(`Unexpected ASRS path ${path}`);
    });
    (getFmdsTablesPageData as jest.Mock).mockResolvedValue({
      revision,
      tables: [
        {
          id: "table-1",
          revision_id: revision.id,
          table_identifier: "Table 2.1.4.5.4",
          title: "Hose Demand Design and Water Supply Duration",
          page_start: 12,
          page_end: 12,
          caption_text: null,
          review_status: "reviewed",
          review_reason: "Verified against the source page.",
        },
        {
          id: "table-other",
          revision_id: revision.id,
          table_identifier: "Table 9",
          title: "Other",
          page_start: 90,
          page_end: 90,
          caption_text: null,
          review_status: "needs_review",
          review_reason: "Pending.",
        },
      ],
    });
    (getFmdsFiguresPageData as jest.Mock).mockResolvedValue({
      revision,
      figures: [
        {
          id: "figure-1",
          revision_id: revision.id,
          figure_identifier: "Figure 2.1",
          title: "Arrangement",
          page_number: 12,
          caption_text: null,
          review_status: "needs_review",
          review_reason: "Pending visual review.",
        },
      ],
    });
  });

  it("pins chunks, tables, and figures to one staging revision", async () => {
    const result = await searchFmdsEvidence({
      query: "hose demand for 12 standard coverage sprinklers",
      matchCount: 5,
    });

    expect(requestAsrsJson).toHaveBeenCalledWith(
      "rpc/match_staging_fmds_chunks",
      "FMDS chat evidence",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          requested_revision_id: revision.id,
          match_count: 48,
          match_threshold: 0.2,
          query_embedding: expect.any(String),
        }),
      }),
    );
    expect(result.corpus).toEqual({
      documentCode: "FMDS0834",
      revisionId: revision.id,
      revisionLabel: "2026-04",
      revisionStatus: "staging",
    });
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toMatchObject({
      sourceType: "native_text",
      sourceId: null,
    });
    expect(result.tables.map((table) => table.identifier)).toEqual([
      "Table 2.1.4.5.4",
    ]);
    expect(result.figures.map((figure) => figure.identifier)).toEqual([
      "Figure 2.1",
    ]);
    expect(getFmdsTablesPageData).toHaveBeenCalledWith({
      revisionId: revision.id,
    });
    expect(getFmdsFiguresPageData).toHaveBeenCalledWith({
      revisionId: revision.id,
    });
    expect(result.answerPolicy).toEqual({
      calculationAuthority: "reviewed_evaluator_only",
      unreviewedEvidenceStatus: "pending_review",
    });
  });

  it("keeps tool retrieval on the revision selected for the current turn", async () => {
    const result = await searchFmdsEvidence(
      { query: "hose demand for standard coverage sprinklers" },
      { revisionId: revision.id },
    );

    expect(requestAsrsJson).toHaveBeenNthCalledWith(
      1,
      `fmds_corpus_revisions?select=id,document_code,revision_label,status,publication_date&id=eq.${revision.id}&document_code=eq.FMDS0834&status=in.(staging,active)&limit=1`,
      "FMDS chat evidence",
    );
    expect(result.corpus.revisionId).toBe(revision.id);
  });

  it("links a structured vector match to its exact reviewed source", async () => {
    (requestAsrsJson as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith("fmds_corpus_revisions"))
        return Promise.resolve([revision]);
      if (path === "rpc/match_staging_fmds_chunks") {
        return Promise.resolve([structuredMatch]);
      }
      throw new Error(`Unexpected ASRS path ${path}`);
    });

    const result = await searchFmdsEvidence({ query: "hose demand table" });

    expect(result.chunks[0]).toMatchObject({
      sourceType: "table",
      sourceId: "table-1",
      sourceIdentifier: "2.1.4.5.4",
      reviewEventId: "review-event-1",
      candidateId: "candidate-1",
    });
    expect(result.coverage.structuredMatches).toBe(1);
    expect(result.tables[0]).toMatchObject({
      id: "table-1",
      matchSource: "structured_reviewed",
    });
  });

  it("keeps a source-diverse reviewed figure when native text crowds the union", async () => {
    const nativeMatches = Array.from({ length: 12 }, (_, index) => ({
      ...match,
      chunk_id: `native-${index + 1}`,
      page_number: 30 + index,
      citation_label: `FMDS0834 native page ${30 + index}`,
      similarity: 0.99 - index * 0.01,
    }));
    const figureMatch = {
      ...structuredMatch,
      chunk_id: "structured-figure-vertical-barrier",
      page_number: 12,
      citation_label: "FMDS0834 (2026-04), Figure 2.1, PDF page 12",
      source_type: "figure",
      source_id: "figure-1",
      source_identifier: "2.1",
      similarity: 0.81,
    };
    (requestAsrsJson as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith("fmds_corpus_revisions"))
        return Promise.resolve([revision]);
      if (path === "rpc/match_staging_fmds_chunks")
        return Promise.resolve([...nativeMatches, figureMatch]);
      throw new Error(`Unexpected ASRS path ${path}`);
    });
    (getFmdsFiguresPageData as jest.Mock).mockResolvedValue({
      revision,
      figures: [
        {
          id: "figure-1",
          revision_id: revision.id,
          figure_identifier: "2.1",
          title: "Vertical barrier decision",
          page_number: 12,
          caption_text: null,
          review_status: "reviewed",
          review_reason: "Verified against the exact source image.",
        },
      ],
    });

    const result = await searchFmdsEvidence({
      query: "vertical barrier figure",
      matchCount: 5,
    });

    expect(result.chunks).toHaveLength(5);
    expect(result.chunks).toContainEqual(
      expect.objectContaining({
        sourceType: "figure",
        sourceId: "figure-1",
        sourceIdentifier: "2.1",
      }),
    );
    expect(result.figures[0]).toMatchObject({
      id: "figure-1",
      matchSource: "structured_reviewed",
    });
    expect(result.coverage.structuredMatches).toBe(1);
  });

  it("fails if structured retrieval omits exact source identity", async () => {
    (requestAsrsJson as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith("fmds_corpus_revisions"))
        return Promise.resolve([revision]);
      if (path === "rpc/match_staging_fmds_chunks") {
        return Promise.resolve([{ ...structuredMatch, source_id: null }]);
      }
      throw new Error(`Unexpected ASRS path ${path}`);
    });

    await expect(
      searchFmdsEvidence({ query: "hose demand table" }),
    ).rejects.toThrow("structured evidence is missing exact source identity");
  });

  it("fails when vector retrieval mixes revisions", async () => {
    (requestAsrsJson as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith("fmds_corpus_revisions"))
        return Promise.resolve([revision]);
      if (path === "rpc/match_staging_fmds_chunks") {
        return Promise.resolve([{ ...match, revision_id: "other-revision" }]);
      }
      throw new Error(`Unexpected ASRS path ${path}`);
    });

    await expect(
      searchFmdsEvidence({ query: "ASRS evidence" }),
    ).rejects.toThrow("retrieval mixed corpus revisions");
  });

  it("fails rather than reporting empty evidence as a conclusion", async () => {
    (requestAsrsJson as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith("fmds_corpus_revisions"))
        return Promise.resolve([revision]);
      if (path === "rpc/match_staging_fmds_chunks") return Promise.resolve([]);
      throw new Error(`Unexpected ASRS path ${path}`);
    });

    await expect(
      searchFmdsEvidence({ query: "ASRS evidence" }),
    ).rejects.toThrow("returned no matching evidence");
  });

  it("contains no legacy FM retrieval dependency", () => {
    const source = readFileSync(require.resolve("../fmds-chat.server"), "utf8");
    for (const legacy of [
      "fm_global_tables",
      "fm_global_figures",
      "fm_text_chunks",
      "fm_table_vectors",
      "find_sprinkler_requirements",
      "generate_optimization_recommendations",
    ]) {
      expect(source).not.toContain(legacy);
    }
  });
});

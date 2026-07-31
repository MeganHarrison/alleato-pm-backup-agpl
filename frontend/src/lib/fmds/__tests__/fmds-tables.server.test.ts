jest.mock("server-only", () => ({}));

const createClientMock = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const ORIGINAL_ENV = process.env;

const revision = {
  id: "revision-2026-04",
  document_code: "FMDS0834",
  revision_label: "2026-04",
  publication_date: "2026-04-01",
  status: "staging" as const,
  source_file_name: "FMDS0834 - 2026.pdf",
  source_page_count: 122,
};

const table = {
  id: "table-1",
  revision_id: revision.id,
  table_identifier: "2.2.1.4.2.1",
  title: "ASRS flue space widths",
  page_start: 20,
  page_end: 20,
  caption_text: null,
  extraction_method: "pymupdf-caption+grid-v1",
  extraction_confidence: 0.75,
  review_status: "needs_review" as const,
  review_priority: 1 as const,
  review_reason: "Table numbering changed",
  evidence_image_path: "FMDS0834/2026-04/pages/page-020.png",
  created_at: "2026-07-20T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

function queryBuilder<T>(result: T) {
  const promise = Promise.resolve(result);
  const builder = {
    select: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    eq: jest.fn(),
    in: jest.fn(),
    then: promise.then.bind(promise),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  return builder;
}

describe("getFmdsTablesPageData", () => {
  beforeEach(() => {
    jest.resetModules();
    createClientMock.mockReset();
    process.env = {
      ...ORIGINAL_ENV,
      SUPABASE_ASRS_URL: "https://asrs.supabase.co",
      SUPABASE_ASRS_SECRET_KEY: "asrs-server-secret",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("queries only the ASRS FMDS revision and table relations", async () => {
    const revisionQuery = queryBuilder({ data: revision, error: null });
    const tablesQuery = queryBuilder({ data: [table], error: null });
    const from = jest.fn((relation: string) =>
      relation === "fmds_corpus_revisions" ? revisionQuery : tablesQuery,
    );
    createClientMock.mockReturnValue({ from });

    const { getFmdsTablesPageData } = await import("../fmds-tables.server");
    await expect(getFmdsTablesPageData()).resolves.toEqual({
      revision,
      tables: [table],
    });

    expect(createClientMock).toHaveBeenCalledWith(
      "https://asrs.supabase.co",
      "asrs-server-secret",
      expect.objectContaining({ auth: expect.any(Object) }),
    );
    expect(from.mock.calls.map(([relation]) => relation)).toEqual([
      "fmds_corpus_revisions",
      "fmds_tables",
    ]);
    expect(revisionQuery.eq).toHaveBeenCalledWith(
      "document_code",
      "FMDS0834",
    );
    expect(tablesQuery.eq).toHaveBeenCalledWith("revision_id", revision.id);
  });

  it("fails loudly when the ASRS server credential is absent", async () => {
    delete process.env.SUPABASE_ASRS_SECRET_KEY;
    const { getFmdsTablesPageData } = await import("../fmds-tables.server");

    await expect(getFmdsTablesPageData()).rejects.toThrow(
      "SUPABASE_ASRS_SECRET_KEY",
    );
  });

  it("pins the revision lookup when a caller already selected a corpus revision", async () => {
    const revisionQuery = queryBuilder({ data: revision, error: null });
    const tablesQuery = queryBuilder({ data: [table], error: null });
    createClientMock.mockReturnValue({
      from: jest.fn((relation: string) =>
        relation === "fmds_corpus_revisions" ? revisionQuery : tablesQuery,
      ),
    });

    const { getFmdsTablesPageData } = await import("../fmds-tables.server");
    await expect(
      getFmdsTablesPageData({ revisionId: revision.id }),
    ).resolves.toMatchObject({ revision });
    expect(revisionQuery.eq).toHaveBeenCalledWith("id", revision.id);
  });
});

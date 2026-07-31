import {
  fmdsTablesConfig,
  fmdsTablesDescription,
  type FmdsCorpusRevision,
} from "../fmds-tables";

const revision: FmdsCorpusRevision = {
  id: "revision-2026-04",
  document_code: "FMDS0834",
  revision_label: "2026-04",
  publication_date: "2026-04-01",
  status: "staging",
  source_file_name: "FMDS0834 - 2026.pdf",
  source_page_count: 122,
};

describe("fmdsTablesConfig", () => {
  it("uses FMDS identifiers and review states instead of the retired PM APP table contract", () => {
    expect(fmdsTablesConfig.searchFields).toEqual(
      expect.arrayContaining(["table_identifier", "review_reason"]),
    );
    expect(fmdsTablesConfig.searchFields).not.toContain("asrs_type");
    expect(fmdsTablesConfig.defaultSortColumn).toBe("page_start");
    expect(fmdsTablesConfig.exportFilename).toBe("fmds-8-34-tables-export.csv");
  });

  it("makes a staging corpus visible to operators", () => {
    expect(fmdsTablesDescription(revision)).toBe(
      "FMDS0834 · 2026-04 · staging review corpus",
    );
  });
});

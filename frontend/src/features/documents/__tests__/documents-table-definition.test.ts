/**
 * Regression test for Critical #1 — smart-group forcedFilters bypass.
 *
 * RED reasoning (before the fix):
 *   createDocumentsTableDefinition used `defaultFilters` which was merged into
 *   the table state as `{ ...definition.defaultFilters, ...parseFiltersFromURL() }`.
 *   `parseFiltersFromURL` always returns every key (set to undefined when absent
 *   from the URL), so the spread overwrote `document_type` back to undefined.
 *   The API was called without `document_type=drawing`, so Drawings group showed
 *   all documents. This test would FAIL before the fix because `document_type`
 *   would be absent from the captured URL.
 *
 * GREEN (after the fix):
 *   `forcedFilters` are applied inside `fetchPage` AFTER the URL-param-derived
 *   filters, so they always win. The API URL will always contain
 *   `document_type=drawing` when `forcedFilters: { document_type: "drawing" }`.
 */

import { createDocumentsTableDefinition } from "@/features/documents/documents-table-definition";
import type { DocumentFilterState } from "@/features/documents/documents-table-definition";

// Mock apiFetch so fetchPage never hits the network.
const mockApiFetch = jest.fn();
jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("createDocumentsTableDefinition — forcedFilters", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ documents: [], total: 0, total_pages: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("includes forcedFilters document_type in the API request URL (Critical #1 guard)", async () => {
    const def = createDocumentsTableDefinition({
      forcedProjectId: 1009,
      forcedFilters: { document_type: "drawing" },
    });

    const query: Parameters<typeof def.fetchPage>[0] = {
      search: "",
      filters: {
        source: undefined,
        type: undefined,
        // Simulate the post-merge clobber: document_type is undefined because
        // parseFiltersFromSearchParams returned undefined for this key.
        document_type: undefined,
        category: undefined,
        pipeline_stage: undefined,
        date_from: undefined,
        date_to: undefined,
      } as DocumentFilterState,
      page: 1,
      perPage: 25,
      sortBy: "created_at",
      sortDirection: "desc",
    };

    await def.fetchPage(query);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockApiFetch.mock.calls[0][0];
    const urlParams = new URLSearchParams(calledUrl.split("?")[1] ?? "");

    // Forced filter must survive even though query.filters.document_type was undefined.
    expect(urlParams.get("document_type")).toBe("drawing");

    // Forced project_id must also be present.
    expect(urlParams.get("project_id")).toBe("1009");
  });

  it("includes forcedFilters type=email in the API request URL (Emails group guard)", async () => {
    const def = createDocumentsTableDefinition({
      forcedProjectId: 1009,
      forcedFilters: { type: "email" },
    });

    const query: Parameters<typeof def.fetchPage>[0] = {
      search: "",
      filters: {
        source: undefined,
        type: undefined, // clobbered by URL-param merge
        document_type: undefined,
        category: undefined,
        pipeline_stage: undefined,
        date_from: undefined,
        date_to: undefined,
      } as DocumentFilterState,
      page: 1,
      perPage: 25,
      sortBy: "created_at",
      sortDirection: "desc",
    };

    await def.fetchPage(query);

    const calledUrl: string = mockApiFetch.mock.calls[0][0];
    const urlParams = new URLSearchParams(calledUrl.split("?")[1] ?? "");

    expect(urlParams.get("type")).toBe("email");
  });

  it("does not set empty-string forcedFilters keys in the URL", async () => {
    const def = createDocumentsTableDefinition({
      forcedProjectId: 1009,
      forcedFilters: { document_type: "" }, // empty string — should not be set
    });

    const query: Parameters<typeof def.fetchPage>[0] = {
      search: "",
      filters: {
        source: undefined,
        type: undefined,
        document_type: undefined,
        category: undefined,
        pipeline_stage: undefined,
        date_from: undefined,
        date_to: undefined,
      } as DocumentFilterState,
      page: 1,
      perPage: 25,
      sortBy: "created_at",
      sortDirection: "desc",
    };

    await def.fetchPage(query);

    const calledUrl: string = mockApiFetch.mock.calls[0][0];
    const urlParams = new URLSearchParams(calledUrl.split("?")[1] ?? "");

    // Empty-string forced filter should not appear in URL.
    expect(urlParams.has("document_type")).toBe(false);
  });
});

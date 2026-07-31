/**
 * Guardrail for the archived-company soft delete.
 *
 * `archived` is a soft delete, so the companies directory must hide those rows
 * by default. The mechanism is subtle and easy to undo by accident: the table
 * hides them by OMITTING the `status` param entirely, because the API treats an
 * absent `status` as "everything except archived". An earlier version of this
 * file sent `status=all` whenever no filter was selected, which made the soft
 * delete invisible in the UI — archiving a company changed nothing but its
 * badge. These tests fail if that fallback comes back.
 */
import { createGlobalCompaniesTableDefinition, EMPTY_COMPANY_FILTERS, COMPANY_STATUS_FILTER_OPTIONS } from "../directory-companies-table-definition";

type FetchPageQuery = Parameters<
  ReturnType<typeof createGlobalCompaniesTableDefinition>["fetchPage"]
>[0];

/** Runs fetchPage against a stubbed fetch and returns the params it requested. */
async function capturedParams(
  statusFilter: string | undefined,
): Promise<URLSearchParams> {
  const definition = createGlobalCompaniesTableDefinition({
    entityKey: "test-companies",
  });

  let requestedUrl = "";
  const originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = typeof input === "string" ? input : String(input);
    const body = JSON.stringify({
      data: [],
      pagination: { page: 1, per_page: 50, total: 0, total_pages: 1 },
    });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => body,
      json: async () => JSON.parse(body),
    } as unknown as Response;
  }) as typeof global.fetch;

  try {
    await definition.fetchPage({
      search: "",
      filters: { ...EMPTY_COMPANY_FILTERS, status: statusFilter },
      page: 1,
      perPage: 50,
      sortBy: "updated_at",
      sortDirection: "desc",
    } as FetchPageQuery);
  } finally {
    global.fetch = originalFetch;
  }

  return new URLSearchParams(requestedUrl.split("?")[1] ?? "");
}

describe("companies directory status filter", () => {
  it("omits status entirely when no filter is selected, so archived stays hidden", async () => {
    const params = await capturedParams(undefined);
    expect(params.has("status")).toBe(false);
  });

  it("never falls back to status=all when no filter is selected", async () => {
    const params = await capturedParams(undefined);
    expect(params.get("status")).not.toBe("all");
  });

  it("passes an explicitly chosen status through", async () => {
    expect((await capturedParams("archived")).get("status")).toBe("archived");
    expect((await capturedParams("active")).get("status")).toBe("active");
  });

  it("sends status=all only when the user explicitly asks to see everything", async () => {
    expect((await capturedParams("all")).get("status")).toBe("all");
  });

  it("offers a way to reveal archived companies", () => {
    const values = COMPANY_STATUS_FILTER_OPTIONS.map((option) => option.value);
    expect(values).toContain("archived");
    expect(values).toContain("all");
  });
});

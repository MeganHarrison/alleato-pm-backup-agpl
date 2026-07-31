import { stampSubcontractorInvoiceStatusAuditActor } from "../subcontractor-invoice-audit";

function createQuery(result: unknown) {
  const query: Record<string, jest.Mock | ((resolve: (value: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of ["select", "eq", "order", "limit", "update", "is"]) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return query;
}

function createSupabase(results: unknown[]) {
  const allQueries = results.map(createQuery);
  const queries = [...allQueries];
  const from = jest.fn(() => {
    const query = queries.shift();
    if (!query) throw new Error("Unexpected Supabase query");
    return query;
  });

  return {
    supabase: { from },
    from,
    queries: allQueries,
  };
}

describe("stampSubcontractorInvoiceStatusAuditActor", () => {
  it("stamps the trigger-created status audit row with the authenticated actor", async () => {
    const { supabase, from, queries } = createSupabase([
      {
        data: [
          {
            id: 123,
            old_value: "under_review",
            new_value: "approved",
            created_at: "2026-07-02T15:00:01.000Z",
            actor_user_id: null,
          },
        ],
        error: null,
      },
      { error: null },
    ]);

    const result = await stampSubcontractorInvoiceStatusAuditActor({
      supabase: supabase as never,
      invoiceId: 8093,
      fromStatus: "under_review",
      toStatus: "approved",
      transitionStartedAt: "2026-07-02T15:00:00.000Z",
      actor: { id: "user-1", email: "pm@example.com" },
    });

    expect(result).toEqual({ ok: true, auditLogId: 123 });
    expect(from).toHaveBeenCalledWith("subcontractor_invoice_audit_log");
    expect(queries[1]?.update).toHaveBeenCalledWith({
      actor_user_id: "user-1",
      actor_email: "pm@example.com",
    });
  });

  it("fails loudly when the status trigger row cannot be found", async () => {
    const { supabase } = createSupabase([{ data: [], error: null }]);

    const result = await stampSubcontractorInvoiceStatusAuditActor({
      supabase: supabase as never,
      invoiceId: 8093,
      fromStatus: "under_review",
      toStatus: "approved",
      transitionStartedAt: "2026-07-02T15:00:00.000Z",
      actor: { id: "user-1", email: "pm@example.com" },
    });

    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      reason:
        "No status audit row found for invoice 8093 transition under_review -> approved.",
    });
  });
});

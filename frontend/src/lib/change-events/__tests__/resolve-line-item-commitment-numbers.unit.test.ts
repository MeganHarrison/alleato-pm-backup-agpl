import {
  resolveLineItemCommitmentNumbers,
  type CommitmentReference,
} from "@/lib/change-events/resolve-line-item-commitment-numbers";

function makeQueryResult(data: unknown, error: { message: string } | null = null) {
  return Promise.resolve({ data, error });
}

describe("resolveLineItemCommitmentNumbers", () => {
  it("fails loudly for unsupported commitment types", async () => {
    const fakeSupabase = {
      from: jest.fn(),
    } as never;

    const references: CommitmentReference[] = [
      { commitment_id: "abc", commitment_type: "service_order" },
    ];

    await expect(resolveLineItemCommitmentNumbers(fakeSupabase, references)).rejects.toThrow(
      "Unsupported change event commitment type(s) for PDF export: service_order",
    );
    expect(fakeSupabase.from).not.toHaveBeenCalled();
  });

  it("checks both tables when legacy rows have no commitment_type", async () => {
    const poIn = jest.fn().mockImplementation(() =>
      makeQueryResult([{ id: "po-1", contract_number: "PO-001" }]),
    );
    const subIn = jest.fn().mockImplementation(() =>
      makeQueryResult([{ id: "sub-1", contract_number: "SC-001" }]),
    );

    const fakeSupabase = {
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnValue({
          in: table === "purchase_orders" ? poIn : subIn,
        }),
      })),
    } as never;

    const result = await resolveLineItemCommitmentNumbers(fakeSupabase, [
      { commitment_id: "po-1", commitment_type: null },
      { commitment_id: "sub-1", commitment_type: null },
    ]);

    expect(fakeSupabase.from).toHaveBeenCalledWith("purchase_orders");
    expect(fakeSupabase.from).toHaveBeenCalledWith("subcontracts");
    expect(result.get("po-1")).toEqual({ contract_number: "PO-001" });
    expect(result.get("sub-1")).toEqual({ contract_number: "SC-001" });
  });

  it("throws when a backing lookup fails instead of hiding the missing contract number", async () => {
    const fakeSupabase = {
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnValue({
          in:
            table === "purchase_orders"
              ? jest.fn().mockImplementation(() => makeQueryResult([], { message: "RLS denied" }))
              : jest.fn().mockImplementation(() => makeQueryResult([])),
        }),
      })),
    } as never;

    await expect(
      resolveLineItemCommitmentNumbers(fakeSupabase, [
        { commitment_id: "po-1", commitment_type: "purchase_order" },
      ]),
    ).rejects.toThrow(
      "Failed to resolve purchase order numbers for change event PDF export: RLS denied",
    );
  });
});

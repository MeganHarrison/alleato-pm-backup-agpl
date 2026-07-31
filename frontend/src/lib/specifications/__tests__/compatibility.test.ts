import { listSpecificationLookupOptions } from "../compatibility";

function buildQuery(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
}

describe("listSpecificationLookupOptions", () => {
  it("returns canonical specification sections", async () => {
    const canonicalQuery = buildQuery({
      data: [
        {
          id: 12,
          section_number: "08-1113",
          title: "Doors, Frames, Hardware",
          status: "active",
        },
      ],
      error: null,
    });
    const from = jest.fn().mockReturnValueOnce(canonicalQuery);

    const result = await listSpecificationLookupOptions({ from } as never, 876);

    expect(result).toEqual([
      {
        id: "12",
        section_number: "08-1113",
        section_title: "Doors, Frames, Hardware",
        division: "Division 08",
        source: "specification_sections",
      },
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("specification_sections");
  });

  it("returns no options when canonical sections are empty", async () => {
    const canonicalQuery = buildQuery({ data: [], error: null });
    const from = jest.fn().mockReturnValueOnce(canonicalQuery);

    await expect(listSpecificationLookupOptions({ from } as never, 876)).resolves.toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when canonical lookup errors", async () => {
    const canonicalQuery = buildQuery({
      data: null,
      error: { message: "permission denied" },
    });
    const from = jest.fn().mockReturnValueOnce(canonicalQuery);

    await expect(listSpecificationLookupOptions({ from } as never, 876)).rejects.toThrow(
      "Could not load canonical specification sections: permission denied",
    );
  });
});

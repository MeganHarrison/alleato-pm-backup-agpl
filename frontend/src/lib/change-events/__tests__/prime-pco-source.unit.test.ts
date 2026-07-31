import {
  buildPrimePcoSourceTitle,
  getSourcePrimeContractIds,
  getSourcePrimeContracts,
  parseChangeEventIdsParam,
  resolveSourceChangeReason,
  resolveSourcePrimeContractId,
  sumSourceChangeEventRom,
  type PrimePcoSourceChangeEvent,
} from "../prime-pco-source";

const sourceEvents: PrimePcoSourceChangeEvent[] = [
  {
    id: "548cbd5e-25cc-49f4-a08d-719ea4fe28f9",
    number: "001",
    title: "Move Kitchen Wall",
    reason: "Owner Request",
    prime_contract_id: "6a8f61d6-a9ae-4bf2-9ae4-bca938f05879",
  },
];

describe("prime PCO source change events", () => {
  it("parses comma-separated change event ids without blanks", () => {
    expect(parseChangeEventIdsParam(" a , , b,c ")).toEqual(["a", "b", "c"]);
    expect(parseChangeEventIdsParam(null)).toEqual([]);
  });

  it("builds the user-facing PCO title from the source change event", () => {
    expect(buildPrimePcoSourceTitle(sourceEvents)).toBe(
      "PCO for CE 001 - Move Kitchen Wall",
    );
  });

  it("resolves source contract and reason only from allowed values", () => {
    expect(
      resolveSourcePrimeContractId(
        sourceEvents,
        new Set(["6a8f61d6-a9ae-4bf2-9ae4-bca938f05879"]),
      ),
    ).toBe("6a8f61d6-a9ae-4bf2-9ae4-bca938f05879");

    expect(resolveSourceChangeReason(sourceEvents, ["Owner Request"])).toBe(
      "Owner Request",
    );
  });

  it("falls back to line-item contract associations when the event contract is not usable", () => {
    const events: PrimePcoSourceChangeEvent[] = [
      {
        id: "548cbd5e-25cc-49f4-a08d-719ea4fe28f9",
        number: "001",
        title: "Move Kitchen Wall",
        reason: null,
        prime_contract_id: null,
        line_items: [
          {
            contract_id: "11111111-1111-4111-8111-111111111111",
          },
          {
            contract: {
              id: "22222222-2222-4222-8222-222222222222",
              contract_number: "PC-001",
              title: "Owner Contract",
            },
          },
        ],
      },
    ];

    expect(getSourcePrimeContractIds(events)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(
      resolveSourcePrimeContractId(
        events,
        new Set(["22222222-2222-4222-8222-222222222222"]),
      ),
    ).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("extracts source contract options from event and line-item payloads", () => {
    const events: PrimePcoSourceChangeEvent[] = [
      {
        id: "548cbd5e-25cc-49f4-a08d-719ea4fe28f9",
        number: "001",
        title: "Move Kitchen Wall",
        reason: null,
        prime_contract_id: "6a8f61d6-a9ae-4bf2-9ae4-bca938f05879",
        prime_contract: {
          id: "6a8f61d6-a9ae-4bf2-9ae4-bca938f05879",
          contract_number: "PC-001",
          title: "Owner Contract",
        },
        line_items: [
          {
            contract: {
              id: "6a8f61d6-a9ae-4bf2-9ae4-bca938f05879",
              contract_number: "PC-001",
              title: "Owner Contract",
            },
          },
        ],
      },
    ];

    expect(getSourcePrimeContracts(events)).toEqual([
      {
        id: "6a8f61d6-a9ae-4bf2-9ae4-bca938f05879",
        contract_number: "PC-001",
        title: "Owner Contract",
      },
    ]);
  });

  it("sums source-event Revenue ROM (string or number) to prefill the PCO amount", () => {
    // The PCO amount should default to the source events' Revenue ROM so the
    // user does not have to retype it (the reported blank-Amount bug).
    expect(
      sumSourceChangeEventRom([
        { ...sourceEvents[0], rom: "20000" },
      ]),
    ).toBe(20000);

    expect(
      sumSourceChangeEventRom([
        { ...sourceEvents[0], rom: "20000" },
        { ...sourceEvents[0], id: "b", rom: 5000 },
        { ...sourceEvents[0], id: "c", rom: null },
      ]),
    ).toBe(25000);

    expect(sumSourceChangeEventRom([])).toBe(0);
  });
});

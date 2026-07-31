import {
  composeCanonicalExecutiveState,
  ExecutiveStateIntegrityError,
  validateExecutiveStateInputs,
  type ExecutiveStateInput,
} from "../executive-state";

const inputs: ExecutiveStateInput[] = [
  { id: "canonical_packet", sourceIds: ["packet-1"], canonicalSource: "packets", authority: "authoritative", readOwner: "packet loader", freshness: "fresh", evidenceCount: 2, required: true },
  { id: "project_operating_record", sourceIds: ["42"], canonicalSource: "current state", authority: "derived", readOwner: "projection reader", freshness: "fresh", evidenceCount: 1, required: true },
  { id: "financial_truth", sourceIds: [], canonicalSource: "finance", authority: "authoritative", readOwner: "finance loader", freshness: "partial", evidenceCount: 0, required: false },
  { id: "derived_schedule_read", sourceIds: [], canonicalSource: "derived schedule", authority: "derived", readOwner: "projection reader", freshness: "partial", evidenceCount: 0, required: false },
  { id: "delivery_receipts", sourceIds: [], canonicalSource: "delivery", authority: "delivery_receipt", readOwner: "receipt loader", freshness: "unknown", evidenceCount: 0, required: false },
];

describe("canonical executive state seam", () => {
  it("returns explicit input authority and loudly defers attention/conflicts", () => {
    const state = composeCanonicalExecutiveState({
      generatedAt: "2026-07-16T00:00:00.000Z",
      packet: { id: "packet-1" } as never,
      projects: [],
      financial: {} as never,
      deliveryReceipts: [],
      inputs,
    });

    expect(state.state).toBe("ready");
    expect(state.inputs.map((input) => input.id)).toEqual(inputs.map((input) => input.id));
    expect(state.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "attention_conflicts_deferred", owner: "AAI-1097" }),
      expect.objectContaining({ code: "no_delivery_receipt" }),
    ]));
  });

  it("rejects a stale required source with a recovery-oriented failure", () => {
    expect(() => validateExecutiveStateInputs([
      { ...inputs[0], freshness: "stale" },
    ])).toThrow("required canonical_packet is stale");
  });

  it("rejects a required source that cannot name its canonical records", () => {
    expect(() => validateExecutiveStateInputs([
      { ...inputs[0], sourceIds: [] },
    ])).toThrow("required canonical_packet has no source identifiers");
  });

  it("rejects duplicate owners and missing evidence before state is exposed", () => {
    try {
      validateExecutiveStateInputs([
        inputs[0],
        { ...inputs[0], evidenceCount: 0 },
      ]);
      throw new Error("expected integrity failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ExecutiveStateIntegrityError);
      expect((error as ExecutiveStateIntegrityError).failures).toEqual(expect.arrayContaining([
        "duplicate input owner for canonical_packet",
        "required canonical_packet has no evidence",
      ]));
    }
  });
});

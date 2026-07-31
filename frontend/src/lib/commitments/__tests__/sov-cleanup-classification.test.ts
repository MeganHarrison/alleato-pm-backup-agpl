import {
  classifyCommitmentSovCleanupRow,
  type CommitmentSovCleanupCandidateInput,
} from "../sov-cleanup-classification";

const candidates: CommitmentSovCleanupCandidateInput[] = [
  {
    id: "pbc-material",
    costCodeId: "06-2000",
    costTypeCode: "M",
    isActive: true,
    hasCostType: true,
  },
  {
    id: "pbc-subcontract",
    costCodeId: "06-2000",
    costTypeCode: "S",
    isActive: true,
    hasCostType: true,
  },
  {
    id: "pbc-untyped",
    costCodeId: "09-2116",
    costTypeCode: null,
    isActive: true,
    hasCostType: false,
  },
];

describe("classifyCommitmentSovCleanupRow", () => {
  it("classifies cost-code-only rows with multiple typed candidates as ambiguous", () => {
    const result = classifyCommitmentSovCleanupRow({
      budgetCode: "062000",
      amount: 150,
      candidates,
    });

    expect(result.reason).toBe("ambiguous_typed_matches");
    expect(result.typedCandidates.map((candidate) => candidate.label)).toEqual([
      "06-2000.M",
      "06-2000.S",
    ]);
  });

  it("classifies blank nonzero rows as source data repair", () => {
    const result = classifyCommitmentSovCleanupRow({
      budgetCode: null,
      amount: 2500,
      candidates,
    });

    expect(result.reason).toBe("blank_code_nonzero_amount");
  });

  it("does not treat untyped project budget codes as safe commitment SOV matches", () => {
    const result = classifyCommitmentSovCleanupRow({
      budgetCode: "09-2116",
      amount: 75000,
      candidates,
    });

    expect(result.reason).toBe("null_type_only_match");
    expect(result.otherCandidates[0]?.label).toBe("09-2116");
  });
});

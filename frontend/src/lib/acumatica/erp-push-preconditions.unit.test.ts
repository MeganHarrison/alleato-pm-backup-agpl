import {
  evaluateErpPushPreconditions,
  type ErpPushFacts,
} from "./erp-push-preconditions";

function facts(overrides: Partial<ErpPushFacts>): ErpPushFacts {
  return {
    projectExists: true,
    primeContractCount: 1,
    companiesWithCustomer: 1,
    ...overrides,
  };
}

describe("evaluateErpPushPreconditions", () => {
  it("allows the push when project, contracts, and a mapped customer all exist", () => {
    expect(evaluateErpPushPreconditions(facts({}))).toEqual({ ok: true });
  });

  it("blocks with ROUTE_BINDING_MISSING when the project does not exist", () => {
    const result = evaluateErpPushPreconditions(facts({ projectExists: false }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ROUTE_BINDING_MISSING");
    expect(result.message).toMatch(/not found/i);
  });

  it("blocks with PRECONDITION_FAILED when the job has no prime contracts", () => {
    const result = evaluateErpPushPreconditions(facts({ primeContractCount: 0 }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PRECONDITION_FAILED");
    expect(result.message).toMatch(/no prime contracts/i);
  });

  it("blocks with PRECONDITION_FAILED when no contract company maps to an Acumatica customer", () => {
    const result = evaluateErpPushPreconditions(
      facts({ companiesWithCustomer: 0 }),
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PRECONDITION_FAILED");
    expect(result.message).toMatch(/customer/i);
  });

  it("checks project existence before contracts (missing project reports not-found, not empty-contracts)", () => {
    const result = evaluateErpPushPreconditions(
      facts({ projectExists: false, primeContractCount: 0, companiesWithCustomer: 0 }),
    );
    expect(result.code).toBe("ROUTE_BINDING_MISSING");
  });

  it("treats negative/garbage counts as failing (defensive)", () => {
    expect(evaluateErpPushPreconditions(facts({ primeContractCount: -3 })).ok).toBe(false);
    expect(evaluateErpPushPreconditions(facts({ companiesWithCustomer: -1 })).ok).toBe(false);
  });
});

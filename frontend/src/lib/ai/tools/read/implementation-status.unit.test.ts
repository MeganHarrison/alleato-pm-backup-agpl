import {
  AUTOFIX_NEEDS_HUMAN_LABEL,
  deriveImplementationPhase,
  describeImplementationPhase,
  extractDispatchRecords,
  type DispatchAuditRow,
  type ImplementationPhase,
} from "./implementation-status";

const auditRow = (overrides: Partial<DispatchAuditRow> = {}): DispatchAuditRow => ({
  created_at: "2026-07-23T10:00:00Z",
  request_payload: { title: "Add escalation banner" },
  response_payload: {
    success: true,
    issueNumber: 120,
    issueUrl: "https://github.com/o/r/issues/120",
    triggerLabel: "autofix",
    pipelineStarted: true,
  },
  ...overrides,
});

describe("extractDispatchRecords", () => {
  it("parses issue number, url, trigger label, and title from audit payloads", () => {
    const records = extractDispatchRecords([auditRow()]);
    expect(records).toEqual([
      {
        issueNumber: 120,
        issueUrl: "https://github.com/o/r/issues/120",
        title: "Add escalation banner",
        triggerLabel: "autofix",
        dispatchedAt: "2026-07-23T10:00:00Z",
      },
    ]);
  });

  it("skips rows whose response payload has no numeric issueNumber", () => {
    const records = extractDispatchRecords([
      auditRow({ response_payload: { action: "preview" } }),
      auditRow({ response_payload: null }),
      auditRow({ response_payload: { issueNumber: "120" } }),
    ]);
    expect(records).toEqual([]);
  });

  it("dedupes repeated dispatches of the same issue, keeping the newest row", () => {
    const records = extractDispatchRecords([
      auditRow({ created_at: "2026-07-23T12:00:00Z" }),
      auditRow({ created_at: "2026-07-22T09:00:00Z" }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].dispatchedAt).toBe("2026-07-23T12:00:00Z");
  });

  it("tolerates malformed title and triggerLabel values", () => {
    const records = extractDispatchRecords([
      auditRow({
        request_payload: null,
        response_payload: { issueNumber: 7, issueUrl: 42, triggerLabel: null },
      }),
    ]);
    expect(records).toEqual([
      {
        issueNumber: 7,
        issueUrl: "",
        title: null,
        triggerLabel: null,
        dispatchedAt: "2026-07-23T10:00:00Z",
      },
    ]);
  });
});

describe("deriveImplementationPhase", () => {
  const openPr = {
    number: 5,
    url: "https://github.com/o/r/pull/5",
    state: "open" as const,
    merged: false,
  };
  const mergedPr = {
    number: 6,
    url: "https://github.com/o/r/pull/6",
    state: "closed" as const,
    merged: true,
  };
  const snapshot = (
    overrides: Partial<{
      existence: "exists" | "deleted" | "unknown";
      state: "open" | "closed" | null;
      labels: string[];
    }> = {},
  ) => ({
    existence: "exists" as const,
    state: "open" as const,
    labels: [],
    ...overrides,
  });

  it("a merged PR is terminal success, even over a needs-human label", () => {
    expect(
      deriveImplementationPhase({
        snapshot: snapshot({ state: "closed", labels: [AUTOFIX_NEEDS_HUMAN_LABEL] }),
        mergedPr,
      }),
    ).toBe("merged");
  });

  it("a deleted issue is reported as a broken link", () => {
    expect(
      deriveImplementationPhase({
        snapshot: snapshot({ existence: "deleted", state: null }),
      }),
    ).toBe("issue_deleted");
  });

  it("the needs-human label outranks an open PR", () => {
    expect(
      deriveImplementationPhase({
        snapshot: snapshot({ labels: [AUTOFIX_NEEDS_HUMAN_LABEL] }),
        openPr,
      }),
    ).toBe("blocked_needs_human");
  });

  it("an open PR means in_review", () => {
    expect(deriveImplementationPhase({ snapshot: snapshot(), openPr })).toBe(
      "in_review",
    );
  });

  it("a closed issue with no merged PR was abandoned", () => {
    expect(
      deriveImplementationPhase({ snapshot: snapshot({ state: "closed" }) }),
    ).toBe("closed_without_merge");
  });

  it("an open issue with no PR is still queued", () => {
    expect(deriveImplementationPhase({ snapshot: snapshot() })).toBe("queued");
  });

  it("an unreachable GitHub reports unknown instead of guessing", () => {
    expect(
      deriveImplementationPhase({
        snapshot: snapshot({ existence: "unknown", state: null }),
      }),
    ).toBe("unknown");
  });
});

describe("describeImplementationPhase", () => {
  it("has a human-readable description for every phase", () => {
    const phases: ImplementationPhase[] = [
      "merged",
      "issue_deleted",
      "blocked_needs_human",
      "in_review",
      "closed_without_merge",
      "queued",
      "unknown",
    ];
    for (const phase of phases) {
      expect(describeImplementationPhase(phase)).toBeTruthy();
    }
  });
});

jest.mock("server-only", () => ({}));

import { __testables } from "../executive-portfolio-state";

const state = {
  packet: {
    sources: [{ id: "source-1", projectId: 101 }],
  },
  projects: [{ projectId: 101, healthStatus: "Healthy", updatedAt: "2026-07-16T12:00:00.000Z", projectionWriter: "controlled_projection", projectionGeneratedAt: "2026-07-16T12:00:00.000Z", projectionEnvelopeId: "envelope-1" }],
} as never;

const executive = {
  attention: [{ id: "attention-1", lifecycle: "open", evidence: [{ sourceId: "source-1" }] }],
  conflicts: [{ id: "conflict-1", status: "open", claims: [{ sourceId: "source-1" }] }],
} as never;

describe("executive portfolio state", () => {
  it("keeps an eligible project with no controlled projection visibly limited", () => {
    const project = __testables.projectCoverage({ id: 1142, name: "Test July 2026", phase: "Current" }, { ...state, packet: { sources: [] }, projects: [] } as never, executive);
    expect(project).toMatchObject({ projectId: 1142, coverage: "limited", freshness: "unknown", sourceEvidenceCount: 0 });
    expect(project.limitedReasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(["missing_controlled_projection", "missing_packet_evidence"]));
  });

  it("composes evidence-linked attention and conflicts from shared contracts", () => {
    const project = __testables.projectCoverage({ id: 101, name: "Portfolio Project", phase: "Current" }, state, executive);
    expect(project).toMatchObject({ coverage: "ready", sourceEvidenceCount: 1, openAttentionIds: ["attention-1"], openConflictIds: ["conflict-1"] });
    expect(project.limitedReasons).toEqual([]);
  });

  it("uses durable direct project ownership before packet-source fallback", () => {
    const directExecutive = {
      attention: [{ id: "attention-direct", projectId: 101, lifecycle: "open", evidence: [{ sourceId: "unlinked-manual-attestation" }] }],
      conflicts: [{ id: "conflict-direct", projectId: 101, status: "open", claims: [{ sourceId: "unlinked-manual-attestation" }] }],
    } as never;
    const project = __testables.projectCoverage({ id: 101, name: "Portfolio Project", phase: "Current" }, state, directExecutive);
    expect(project.openAttentionIds).toEqual(["attention-direct"]);
    expect(project.openConflictIds).toEqual(["conflict-direct"]);
  });

  it("keeps acknowledged project-owned attention in the same actionable grouping as Weekly review", () => {
    const acknowledged = {
      attention: [{ id: "attention-acknowledged", projectId: 101, lifecycle: "acknowledged", evidence: [] }],
      conflicts: [],
    } as never;
    const project = __testables.projectCoverage({ id: 101, name: "Portfolio Project", phase: "Current" }, state, acknowledged);
    expect(project.openAttentionIds).toEqual(["attention-acknowledged"]);
  });

  it("never treats incomplete controlled provenance as ready", () => {
    const project = __testables.projectCoverage({ id: 101, name: "Portfolio Project", phase: "Current" }, { ...state, projects: [{ ...state.projects[0], projectionEnvelopeId: null }] } as never, executive);
    expect(project.coverage).toBe("limited");
    expect(project.limitedReasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: "incomplete_projection_provenance", owner: "Projection owner" })]));
  });
});

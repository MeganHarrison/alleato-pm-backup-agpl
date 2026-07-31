import {
  routeCandidatesToSections,
  type CandidateRow,
} from "../canonical-operating-packet-map";

function candidate(overrides: Partial<CandidateRow>): CandidateRow {
  return {
    id: Math.random().toString(36).slice(2),
    signal_type: "project_update",
    title: "A signal",
    summary: "A summary.",
    why_it_matters: null,
    next_action: null,
    project_id: null,
    suggested_owner_label: null,
    current_status: null,
    status: "active",
    confidence: "medium",
    confidence_score: 0.5,
    source_document_id: null,
    source_occurred_at: "2026-07-08T12:00:00Z",
    normalized_signal_key: null,
    ...overrides,
  };
}

describe("routeCandidatesToSections", () => {
  it("routes candidates into lanes by signal_type", () => {
    const names = new Map<number, string>([[60, "Union Collective"]]);
    const sections = routeCandidatesToSections(
      [
        candidate({ signal_type: "decision", title: "Union solar path", project_id: 60 }),
        candidate({ signal_type: "task", title: "Chase permit" }),
        candidate({ signal_type: "risk", title: "FA panel blocker" }),
        candidate({ signal_type: "project_update", title: "Field progress" }),
      ],
      names,
    );

    expect(sections.needsBrandon.map((item) => item.title)).toEqual([
      "Union solar path",
    ]);
    expect(sections.needsBrandon[0].project).toBe("Union Collective");
    expect(sections.needsBrandon[0].projectInternalId).toBe(60);
    expect(sections.waitingOnOthers.map((item) => item.title)).toEqual([
      "Chase permit",
    ]);
    // risk + project_update both land in the updates lane
    expect(sections.importantUpdates.map((item) => item.title)).toEqual([
      "FA panel blocker",
      "Field progress",
    ]);
  });

  it("surfaces risks and process issues ahead of routine updates", () => {
    const sections = routeCandidatesToSections(
      [
        candidate({ signal_type: "project_update", title: "routine", confidence_score: 0.9 }),
        candidate({ signal_type: "risk", title: "a-risk", confidence_score: 0.1 }),
        candidate({ signal_type: "process_issue", title: "a-process", confidence_score: 0.1 }),
      ],
      new Map(),
    );
    // Despite lowest confidence, risk then process_issue lead the lane.
    expect(sections.importantUpdates.map((item) => item.title)).toEqual([
      "a-risk",
      "a-process",
      "routine",
    ]);
  });

  it("never caps owner decisions but bounds tasks and updates", () => {
    const decisions = Array.from({ length: 20 }, (_, index) =>
      candidate({ signal_type: "decision", title: `d${index}` }),
    );
    const tasks = Array.from({ length: 20 }, (_, index) =>
      candidate({ signal_type: "task", title: `t${index}` }),
    );
    const updates = Array.from({ length: 60 }, (_, index) =>
      candidate({ signal_type: "project_update", title: `u${index}` }),
    );
    const sections = routeCandidatesToSections(
      [...decisions, ...tasks, ...updates],
      new Map(),
    );
    expect(sections.needsBrandon).toHaveLength(20); // decisions never capped
    expect(sections.waitingOnOthers).toHaveLength(15); // MAX_WAITING
    expect(sections.importantUpdates).toHaveLength(40); // MAX_UPDATES
  });

  it("carries the recommended action and owner onto the brief item", () => {
    const sections = routeCandidatesToSections(
      [
        candidate({
          signal_type: "decision",
          title: "Decide",
          next_action: "Confirm the 45 kW option",
          suggested_owner_label: "Brandon",
          why_it_matters: "Overhead is burning",
        }),
      ],
      new Map(),
    );
    const item = sections.needsBrandon[0];
    expect(item.recommendedAction).toBe("Confirm the 45 kW option");
    expect(item.owner).toBe("Brandon");
    expect(item.whyItMatters).toBe("Overhead is burning");
  });
});

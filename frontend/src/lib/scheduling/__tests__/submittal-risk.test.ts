import { evaluateLinkedSubmittalRisk } from "../submittal-risk";

describe("linked schedule submittal risk", () => {
  const task = { id: "task-1", name: "Install air-handling unit", start_date: "2026-08-20" };

  it("names a rejected submittal as the blocking risk", () => {
    expect(evaluateLinkedSubmittalRisk({
      task,
      linkedSubmittals: [{
        id: "sub-1",
        number: "23 73 00-01",
        title: "Air-handling unit",
        required_approval_date: "2026-08-12",
        responses: ["Rejected"],
      }],
      dependentTaskNames: ["Commission air-handling unit"],
    })).toEqual(expect.objectContaining({
      status: "at_risk",
      blocking_submittal_id: "sub-1",
      reason: "Submittal 23 73 00-01 is rejected.",
      dependency_context: ["Commission air-handling unit"],
    }));
  });

  it("does not report a pending approval that is due after the activity as safe", () => {
    expect(evaluateLinkedSubmittalRisk({
      task,
      linkedSubmittals: [{
        id: "sub-2",
        number: "26 50 00-04",
        title: "Lighting fixtures",
        required_approval_date: "2026-08-25",
        responses: ["Pending"],
      }],
      dependentTaskNames: [],
    })).toEqual(expect.objectContaining({
      status: "at_risk",
      blocking_submittal_id: "sub-2",
      reason: "Submittal 26 50 00-04 approval is due after this activity starts.",
    }));
  });

  it("keeps approved submittals with timely approval dates clear", () => {
    expect(evaluateLinkedSubmittalRisk({
      task,
      linkedSubmittals: [{
        id: "sub-3",
        number: "09 91 00-02",
        title: "Paint system",
        required_approval_date: "2026-08-10",
        responses: ["Approved"],
      }],
      dependentTaskNames: [],
    })).toEqual({ status: "clear", risks: [] });
  });

  it("treats a rejected authoritative submittal status as blocking even without a response row", () => {
    expect(evaluateLinkedSubmittalRisk({
      task,
      linkedSubmittals: [{
        id: "sub-4",
        number: "07 21 00-01",
        title: "Waterproofing",
        required_approval_date: "2026-08-10",
        status: "rejected",
        responses: [],
      }],
      dependentTaskNames: [],
    })).toEqual(expect.objectContaining({
      status: "at_risk",
      reason: "Submittal 07 21 00-01 is rejected.",
    }));
  });
});

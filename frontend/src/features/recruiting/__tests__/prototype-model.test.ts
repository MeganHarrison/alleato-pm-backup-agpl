import { INITIAL_RECRUITING_STATE } from "../prototype-data";
import {
  addSampleApplicant,
  matchesRecruitingSearch,
  moveApplication,
} from "../prototype-model";

describe("Applicant Tracker prototype model", () => {
  it("moves one application without changing the candidate or the other application", () => {
    const result = moveApplication(
      INITIAL_RECRUITING_STATE,
      "application-jordan-vp",
      "interview",
      "2026-07-28T03:00:00.000Z",
    );

    expect(result.error).toBeUndefined();
    expect(
      result.state.applications.find(
        (application) => application.id === "application-jordan-vp",
      )?.stage,
    ).toBe("interview");
    expect(
      result.state.applications.find(
        (application) => application.id === "application-jordan-estimator",
      )?.stage,
    ).toBe("qualified");
    expect(result.state.candidates).toBe(INITIAL_RECRUITING_STATE.candidates);
  });

  it("fails loudly when moving an unknown application", () => {
    const result = moveApplication(
      INITIAL_RECRUITING_STATE,
      "missing",
      "review",
      "2026-07-28T03:00:00.000Z",
    );

    expect(result.state).toBe(INITIAL_RECRUITING_STATE);
    expect(result.error).toBe(
      "The application could not be found. Reset the demo and try again.",
    );
  });

  it("adds the sample resume only once", () => {
    const first = addSampleApplicant(
      INITIAL_RECRUITING_STATE,
      "req-vp-construction",
      "2026-07-28T03:00:00.000Z",
    );
    const second = addSampleApplicant(
      first.state,
      "req-vp-construction",
      "2026-07-28T03:01:00.000Z",
    );

    expect(first.applicationId).toBe("application-sample");
    expect(second.error).toBe(
      "The sample resume is already on the board. Reset the demo to add it again.",
    );
    expect(second.state.applications).toHaveLength(
      INITIAL_RECRUITING_STATE.applications.length + 1,
    );
  });

  it("searches candidate identity and current work fields", () => {
    const candidate = INITIAL_RECRUITING_STATE.candidates[0];

    expect(matchesRecruitingSearch(candidate, "Jordan")).toBe(true);
    expect(matchesRecruitingSearch(candidate, "Beacon Ridge")).toBe(true);
    expect(matchesRecruitingSearch(candidate, "unknown person")).toBe(false);
  });
});

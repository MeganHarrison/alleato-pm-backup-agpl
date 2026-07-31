import {
  buildRecruitingUatFeatureResult,
  recruitingUatFeatureLabels,
} from "@/lib/recruiting/uat-feature-tests";
import { recruitingUatFeatureResultSchema } from "@/lib/recruiting/production-contracts";

const actions = Object.keys(recruitingUatFeatureLabels) as Array<
  keyof typeof recruitingUatFeatureLabels
>;

describe("recruiting UAT feature tests", () => {
  it.each(actions)("keeps %s synthetic, no-send, and human-controlled", (action) => {
    const result = buildRecruitingUatFeatureResult({
      action,
      runId: "c8b53e97-b89a-49ea-b9b2-e06ea9f3ebac",
      subject: {
        candidateName: "[UAT] Resume 01",
        resumeFileName: "synthetic-resume-01.pdf",
        requisitionTitle: "Project Manager",
        expiresAt: "2026-08-01T18:30:00.000Z",
      },
    });

    expect(recruitingUatFeatureResultSchema.parse(result)).toEqual(result);
    expect(result.safety).toEqual({
      delivery: "not_sent",
      employmentDecision: "human_required",
      syntheticDataOnly: true,
    });
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it("shows consent, quiet-hours, and opt-out controls in the SMS preview", () => {
    const result = buildRecruitingUatFeatureResult({
      action: "sms_preview",
      runId: "c8b53e97-b89a-49ea-b9b2-e06ea9f3ebac",
      subject: {
        candidateName: "[UAT] Resume 01",
        resumeFileName: "synthetic-resume-01.pdf",
        requisitionTitle: "Project Manager",
        expiresAt: "2026-08-01T18:30:00.000Z",
      },
    });

    const renderedEvidence = result.evidence
      .map((item) => `${item.label} ${item.value}`)
      .join(" ");
    expect(renderedEvidence).toMatch(/consent/i);
    expect(renderedEvidence).toMatch(/quiet-hours/i);
    expect(renderedEvidence).toMatch(/STOP/i);
  });

  it("does not claim that metadata came from parsed resume contents", () => {
    const result = buildRecruitingUatFeatureResult({
      action: "resume_evidence_extraction",
      runId: "c8b53e97-b89a-49ea-b9b2-e06ea9f3ebac",
      subject: {
        candidateName: "[UAT] Resume 01",
        resumeFileName: "synthetic-resume-01.pdf",
        requisitionTitle: "Project Manager",
        expiresAt: "2026-08-01T18:30:00.000Z",
      },
    });

    expect(result.summary).toMatch(/metadata/i);
    expect(result.summary).toMatch(/real file parsing.*disabled/i);
    expect(JSON.stringify(result.evidence)).not.toMatch(/facts.*extracted/i);
  });
});

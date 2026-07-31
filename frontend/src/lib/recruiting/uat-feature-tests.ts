import type {
  RecruitingUatFeatureAction,
  RecruitingUatFeatureResult,
} from "@/lib/recruiting/production-contracts";

export type RecruitingUatSubject = {
  candidateName: string;
  resumeFileName: string;
  requisitionTitle: string;
  expiresAt: string;
};

const summaries: Record<RecruitingUatFeatureAction, string> = {
  resume_evidence_extraction:
    "The resume-extraction workflow preview completed from synthetic UAT record metadata. Real file parsing, ranking, and hiring decisions remain disabled.",
  sms_preview:
    "A no-send SMS template preview was created. Consent, sender, opt-out, and quiet-hours enforcement were not exercised.",
  offer_esignature_preview:
    "A synthetic offer envelope was prepared for review. No document was delivered or signed.",
  workflow_automation_preview:
    "A follow-up workflow was evaluated and stopped at the required human approval step.",
  ai_evidence_summary:
    "A neutral, metadata-linked summary preview was prepared for human review without an employment recommendation.",
};

export const recruitingUatFeatureLabels: Record<
  RecruitingUatFeatureAction,
  string
> = {
  resume_evidence_extraction: "Resume evidence extraction",
  sms_preview: "SMS",
  offer_esignature_preview: "Offer e-signature",
  workflow_automation_preview: "Workflow automation",
  ai_evidence_summary: "Evidence-linked AI assistance",
};

export function buildRecruitingUatFeatureResult({
  action,
  runId,
  subject,
}: {
  action: RecruitingUatFeatureAction;
  runId: string;
  subject: RecruitingUatSubject;
}): RecruitingUatFeatureResult {
  const commonEvidence = [
    {
      label: "Candidate",
      value: subject.candidateName,
      source: "Applicant Tracker synthetic candidate record",
    },
    {
      label: "Position",
      value: subject.requisitionTitle,
      source: "Applicant Tracker requisition record",
    },
  ];
  const evidence: RecruitingUatFeatureResult["evidence"] =
    action === "sms_preview"
      ? [
          ...commonEvidence,
          {
            label: "Message preview",
            value:
              "Alleato recruiting test: your synthetic application is ready for review. Reply STOP to opt out.",
            source: "UAT communication template",
          },
          {
            label: "Delivery controls",
            value:
              "Consent, opt-out, sender, and quiet-hours checks are required but were not exercised; delivery disabled",
            source: "Recruiting UAT safety policy",
          },
        ]
      : action === "offer_esignature_preview"
        ? [
            ...commonEvidence,
            {
              label: "Envelope state",
              value: "Preview ready; awaiting recruiter approval",
              source: "Synthetic offer workflow",
            },
          ]
        : action === "workflow_automation_preview"
          ? [
              ...commonEvidence,
              {
                label: "Proposed action",
                value: "Create a recruiter follow-up task after evidence review",
                source: "Synthetic workflow rule",
              },
              {
                label: "Approval state",
                value: "Awaiting human approval; pipeline unchanged",
                source: "Recruiting automation guardrail",
              },
            ]
          : [
              ...commonEvidence,
              {
                label: "Evidence scope",
                value:
                  action === "resume_evidence_extraction"
                    ? "Extraction preview ready; real file parsing remains disabled in the UAT adapter"
                    : "Candidate and position metadata summarized without suitability scoring",
                source: `Quarantined synthetic document metadata: ${subject.resumeFileName}`,
              },
            ];

  return {
    runId,
    action,
    status: "succeeded",
    summary: summaries[action],
    evidence,
    safety: {
      delivery: "not_sent",
      employmentDecision: "human_required",
      syntheticDataOnly: true,
    },
    expiresAt: subject.expiresAt,
  };
}

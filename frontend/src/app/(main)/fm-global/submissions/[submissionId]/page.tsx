import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout";
import { DetailField } from "@/components/ds/DetailField";
import { Button } from "@/components/ui/button";
import { AsrsEstimatorResults } from "@/components/fm-global/asrs-estimator-results";
import { SectionHeader } from "@/components/ds";
import { createAsrsServiceClient } from "@/lib/supabase/service";
import {
  asrsEstimatorRequestSchema,
  asrsEstimatorResponseSchema,
  type AsrsEstimatorRequest,
  type AsrsEstimatorResponse,
} from "@/lib/fmds/asrs-estimator";
import { fmGlobalSpecInputSchema } from "@/lib/schemas/fm-global-schemas";
import type { FmGlobalSpecInput } from "@/types/fm-global";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ submissionId: string }>;
}

interface ContactInfo {
  name?: string | null;
  email?: string | null;
}

interface ProjectDetails {
  project_name?: string | null;
  project_location?: string | null;
}

interface SubmissionRecord {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  user_input: FmGlobalSpecInput;
  contact_info: ContactInfo | null;
  evaluation: AsrsEstimatorResponse | null;
  evaluation_status: "verified" | "pending_review" | null;
  evaluator_input: AsrsEstimatorRequest | null;
  evaluator_key: string | null;
  project_details: ProjectDetails | null;
  lead_status: string | null;
  lead_score: number | null;
}

async function getSubmission(
  submissionId: string,
): Promise<SubmissionRecord | null> {
    // fm_form_submissions lives in the ASRS project, not PM APP.
    const supabase = createAsrsServiceClient();
    const { data, error } = await supabase.from("fm_form_submissions")
    .select(
      "id,created_at,updated_at,user_input,contact_info,project_details,lead_status,lead_score,evaluator_key,evaluator_inputs,evaluation_result,evaluation_status",
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const parsed = data.user_input
    ? fmGlobalSpecInputSchema.safeParse(data.user_input)
    : null;
  if (!parsed?.success) {
    return null;
  }
  const evaluatorInput = data.evaluator_inputs
    ? asrsEstimatorRequestSchema.safeParse(data.evaluator_inputs)
    : null;
  const evaluation = data.evaluation_result
    ? asrsEstimatorResponseSchema.safeParse(data.evaluation_result)
    : null;
  if (
    (evaluatorInput && !evaluatorInput.success) ||
    (evaluation && !evaluation.success)
  ) {
    return null;
  }

  return {
    id: data.id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    user_input: parsed.data,
    contact_info: (data.contact_info as ContactInfo | null) ?? null,
    evaluator_input: evaluatorInput?.success ? evaluatorInput.data : null,
    evaluation: evaluation?.success ? evaluation.data : null,
    evaluation_status: data.evaluation_status,
    evaluator_key: data.evaluator_key,
    project_details: (data.project_details as ProjectDetails | null) ?? null,
    lead_status: data.lead_status ?? null,
    lead_score: data.lead_score ?? null,
  };
}

function formatNumber(
  value: number | null | undefined,
  suffix?: string,
): string | null {
  if (value === null || value === undefined) return null;
  return suffix ? `${value} ${suffix}` : String(value);
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} />
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default async function SubmissionDetailPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { submissionId } = await params;
  const submission = await getSubmission(submissionId);
  if (!submission) {
    notFound();
  }

  const {
    user_input,
    contact_info,
    project_details,
    evaluator_input,
    evaluation,
    evaluation_status,
    evaluator_key,
    lead_status,
    lead_score,
    created_at,
    updated_at,
  } = submission;

  const submittedAt = formatDateTime(created_at);
  const updatedAt = formatDateTime(updated_at);

  return (
    <PageShell
      variant="detail"
      title={project_details?.project_name || "FM Global Submission"}
      description={submittedAt ? `Submitted ${submittedAt}` : undefined}
      actions={
        <Button variant="outline" asChild>
          <Link href="/fm-global/submissions">Back to submissions</Link>
        </Button>
      }
    >
      <div className="space-y-10">
        <Section title="Submission">
          <DetailField label="Submission ID" value={submission.id} />
          <DetailField label="Submitted" value={submittedAt} />
          <DetailField label="Last Updated" value={updatedAt} />
          <DetailField label="Lead Status" value={lead_status} />
          <DetailField
            label="Evaluation Status"
            value={
              evaluation_status === "pending_review"
                ? "Pending Review"
                : evaluation_status === "verified"
                  ? "Verified"
                  : null
            }
          />
          <DetailField label="Evaluator" value={evaluator_key} />
          <DetailField
            label="Lead Score"
            value={lead_score !== null ? String(lead_score) : null}
          />
        </Section>

        <Section title="Contact">
          <DetailField label="Name" value={contact_info?.name} />
          <DetailField label="Email" value={contact_info?.email} />
        </Section>

        <Section title="Project">
          <DetailField
            label="Project Name"
            value={project_details?.project_name}
          />
          <DetailField
            label="Project Location"
            value={project_details?.project_location}
          />
        </Section>

        <Section title="System Classification">
          <DetailField label="ASRS Type" value={user_input.asrs_type} />
          <DetailField label="System Type" value={user_input.system_type} />
          <DetailField label="Container Type" value={user_input.container_type} />
        </Section>

        <Section title="Building & Storage">
          <DetailField
            label="Ceiling Height"
            value={formatNumber(user_input.ceiling_height_ft, "ft")}
          />
          <DetailField
            label="Storage Height"
            value={formatNumber(user_input.storage_height_ft, "ft")}
          />
          <DetailField
            label="Rack Row Depth"
            value={formatNumber(user_input.rack_row_depth_ft, "ft")}
          />
          <DetailField
            label="Commodity Class"
            value={user_input.commodity_class}
          />
          <DetailField
            label="Existing Ceiling Sprinkler K-Factor"
            value={
              user_input.k_factor !== undefined && user_input.k_factor !== null
                ? `K ${user_input.k_factor}`
                : null
            }
          />
          <DetailField
            label="Building Heated"
            value={
              user_input.building_heated === undefined ||
              user_input.building_heated === null
                ? null
                : user_input.building_heated
                  ? "Yes"
                  : "No"
            }
          />
          <DetailField
            label="Search Tolerance"
            value={formatNumber(user_input.tolerance_ft, "ft")}
          />
        </Section>

        <Section title="Sprinkler Design">
          <DetailField
            label="Ceiling Sprinkler Type"
            value={
              evaluator_input?.ceilingSprinklerType === "standard_coverage"
                ? "Standard coverage"
                : evaluator_input?.ceilingSprinklerType === "extended_coverage"
                  ? "Extended coverage"
                  : null
            }
          />
          <DetailField
            label="Design Sprinkler Count"
            value={
              evaluator_input
                ? String(evaluator_input.designSprinklerCount)
                : null
            }
          />
        </Section>

        {evaluation ? <AsrsEstimatorResults result={evaluation} /> : null}
      </div>
    </PageShell>
  );
}

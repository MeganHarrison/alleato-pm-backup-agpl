import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout";
import { createAsrsServiceClient } from "@/lib/supabase/service";
import { DetailField } from "@/components/ds/DetailField";
import { Button } from "@/components/ui/button";
import { AsrsEstimatorResults } from "@/components/fm-global/asrs-estimator-results";
import { SectionHeader } from "@/components/ds";
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
  user_input: FmGlobalSpecInput;
  contact_info: ContactInfo | null;
  evaluation: AsrsEstimatorResponse | null;
  evaluator_input: AsrsEstimatorRequest | null;
  project_details: ProjectDetails | null;
}

async function getSubmission(
  submissionId: string,
): Promise<SubmissionRecord | null> {
  // fm_form_submissions lives in the ASRS project, not PM APP. The form's server
  // action writes there, so reading via serviceDb (which routes to PM APP) made every
  // freshly submitted confirmation 404.
  const supabase = createAsrsServiceClient();
  const { data, error } = await supabase
    .from("fm_form_submissions")
    .select(
      "id,created_at,user_input,contact_info,project_details,evaluator_inputs,evaluation_result",
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
    user_input: parsed.data,
    contact_info: (data.contact_info as ContactInfo | null) ?? null,
    evaluator_input: evaluatorInput?.success ? evaluatorInput.data : null,
    evaluation: evaluation?.success ? evaluation.data : null,
    project_details: (data.project_details as ProjectDetails | null) ?? null,
  };
}

function formatNumber(value: number | null | undefined, suffix?: string): string {
  if (value === null || value === undefined) return "";
  return suffix ? `${value} ${suffix}` : String(value);
}

function ContainerTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export async function FmGlobalSubmittedPage({
  submissionId,
  returnHref = "/fm-global/form",
  returnLabel = "Submit another request",
}: {
  submissionId: string;
  returnHref?: string;
  returnLabel?: string;
}): Promise<ReactElement> {
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
  } = submission;

  return (
    <PageShell variant="content" title="Submission received">
      <div className="space-y-10">
        <section className="space-y-4">
          <SectionHeader title="Your Details" />
          <div className="space-y-5">
            <DetailField label="Name" value={contact_info?.name} />
            <DetailField label="Email" value={contact_info?.email} />
            <DetailField
              label="Project Name"
              value={project_details?.project_name}
            />
            <DetailField
              label="Project Location"
              value={project_details?.project_location}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="System Classification" />
          <div className="space-y-5">
            <DetailField label="ASRS Type" value={user_input.asrs_type} />
            <DetailField
              label="Container Type"
              value={ContainerTypeLabel(user_input.container_type)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Sprinkler Design" />
          <div className="space-y-5">
            <DetailField
              label="Ceiling Sprinkler Type"
              value={
                evaluator_input?.ceilingSprinklerType === "standard_coverage"
                  ? "Standard coverage"
                  : evaluator_input?.ceilingSprinklerType ===
                      "extended_coverage"
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
            <DetailField
              label="Existing Ceiling Sprinkler K-Factor"
              value={
                user_input.k_factor !== undefined && user_input.k_factor !== null
                  ? `K ${user_input.k_factor}`
                  : null
              }
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Building & Storage" />
          <div className="space-y-5">
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
          </div>
        </section>

        {evaluation ? <AsrsEstimatorResults result={evaluation} /> : null}

        <div className="pt-2">
          <Button asChild>
            <Link href={returnHref}>{returnLabel}</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

export default async function SubmittedPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { submissionId } = await params;
  return <FmGlobalSubmittedPage submissionId={submissionId} />;
}

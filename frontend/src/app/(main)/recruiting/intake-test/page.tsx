import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageShell } from "@/components/layout";
import { Button, InfoAlert } from "@/components/ds";
import { RecruitingIntakeUatForm } from "@/features/recruiting/RecruitingIntakeUatForm";
import { GuardrailError } from "@/lib/guardrails/errors";
import { purgeExpiredRecruitingUatSubmissions } from "@/lib/recruiting/intake-uat-service";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function RecruitingIntakeTestPage() {
  const { db, viewer } = await requireRecruitingAccess("write");
  await purgeExpiredRecruitingUatSubmissions({
    service: createServiceClient(),
    actorPersonId: viewer.personId,
  });
  const [settingResult, positionsResult] = await Promise.all([
    db
      .from("recruiting_settings")
      .select("value")
      .eq("key", "public_intake_uat_enabled")
      .maybeSingle(),
    db
      .from("recruiting_requisitions")
      .select("id,requisition_number,title")
      .eq("status", "open")
      .eq("is_confidential", false)
      .order("title"),
  ]);
  if (settingResult.error || positionsResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "recruiting/intake-uat/page",
      message:
        "Candidate intake UAT could not load its configuration or open positions. Verify the recruiting migration and database connection, then reload.",
      cause: settingResult.error ?? positionsResult.error,
    });
  }

  const enabled = settingResult.data?.value === true;
  const positions = (positionsResult.data ?? []).map((position) => ({
    id: position.id,
    label: `${position.title} (${position.requisition_number})`,
  }));

  return (
    <PageShell
      variant="content"
      title="Candidate intake test"
      description="Recruiter-only preview of the candidate application and resume upload workflow."
      actions={
        <Button asChild variant="outline">
          <Link href="/recruiting">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Applicant Tracker
          </Link>
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-3xl py-6">
        {!enabled ? (
          <InfoAlert variant="warning">
            Candidate intake UAT is disabled. Apply the recruiting intake UAT
            migration before using this page.
          </InfoAlert>
        ) : positions.length === 0 ? (
          <InfoAlert variant="warning">
            Add and open a non-confidential position before testing candidate
            intake.
          </InfoAlert>
        ) : (
          <RecruitingIntakeUatForm positions={positions} />
        )}
      </div>
    </PageShell>
  );
}

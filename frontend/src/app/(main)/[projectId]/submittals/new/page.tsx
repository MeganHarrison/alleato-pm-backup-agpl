"use client";

import { useParams, useSearchParams } from "next/navigation";
import { SubmittalFormPage } from "@/features/submittals/submittal-form-page";

export default function NewSubmittalPage() {
  const params = useParams<{ projectId: string }>()!;
  const searchParams = useSearchParams()!;

  const projectId = parseInt(params.projectId ?? "", 10);
  const packageId = searchParams.get("package_id") ?? undefined;
  const specSection = searchParams.get("specification_section") ?? undefined;

  const defaultOverrides =
    packageId || specSection
      ? {
          submittal_package_id: packageId,
          specification_section: specSection,
        }
      : undefined;

  return (
    <SubmittalFormPage
      projectId={projectId}
      defaultOverrides={defaultOverrides}
    />
  );
}

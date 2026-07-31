"use client";

import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/layout";
import { ContractForm } from "@/components/domain/contracts";
import type { ContractFormData } from "@/components/domain/contracts/ContractForm";
import { useCreatePrimeContract } from "@/hooks/use-create-prime-contract";

const INITIAL_DATA: Partial<ContractFormData> = {
  number: "",
  title: "",
  status: "draft",
  executed: false,
  isPrivate: false,
  defaultRetainage: 10,
};

export default function NewContractPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const projectId = params.projectId as string;
  const { handleSubmit, isSubmitting } = useCreatePrimeContract(projectId);

  return (
    <PageShell
      variant="form"
      title="Create Prime Contract"
      description="Enter contract details, financial markup, and SOV line items."
      onBack={() => router.push(`/${projectId}/prime-contracts`)}
      backLabel="Back"
    >
      <ContractForm
        initialData={INITIAL_DATA}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/${projectId}/prime-contracts`)}
        isSubmitting={isSubmitting}
        mode="create"
        projectId={projectId}
      />
    </PageShell>
  );
}

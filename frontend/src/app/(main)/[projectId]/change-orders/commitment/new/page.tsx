import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout";

interface LegacyCommitmentChangeOrderNewPageProps {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSingleValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0] ?? null;
  return null;
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value) {
    params.set(key, value);
  }
}

// Legacy direct Commitment CO creation skipped the Commitment PCO review step.
// Route old links into the canonical Commitment PCO form instead.
export default async function LegacyCommitmentChangeOrderNewPage({
  params,
  searchParams,
}: LegacyCommitmentChangeOrderNewPageProps) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const targetQuery = new URLSearchParams();

  appendQueryParam(
    targetQuery,
    "commitmentId",
    readSingleValue(query?.commitmentId) ?? readSingleValue(query?.contractId),
  );
  appendQueryParam(
    targetQuery,
    "changeEventIds",
    readSingleValue(query?.changeEventIds),
  );

  const suffix = targetQuery.toString() ? `?${targetQuery.toString()}` : "";
  redirect(`/${projectId}/commitment-pcos/new${suffix}`);

  return (
    <PageShell
      variant="form"
      title="Redirecting to Commitment PCO"
      description="Opening the canonical Commitment PCO workflow."
    >
      {null}
    </PageShell>
  );
}

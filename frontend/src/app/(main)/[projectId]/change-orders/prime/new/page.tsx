import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout";

interface LegacyPrimeChangeOrderNewPageProps {
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

// Legacy direct PCCO creation skipped the Change Event -> Prime PCO -> PCCO
// workflow. Keep old links working, but route users into the canonical PCO form.
export default async function LegacyPrimeChangeOrderNewPage({
  params,
  searchParams,
}: LegacyPrimeChangeOrderNewPageProps) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const targetQuery = new URLSearchParams();

  appendQueryParam(targetQuery, "contractId", readSingleValue(query?.contractId));
  appendQueryParam(
    targetQuery,
    "changeEventIds",
    readSingleValue(query?.changeEventIds),
  );

  const suffix = targetQuery.toString() ? `?${targetQuery.toString()}` : "";
  redirect(`/${projectId}/prime-contract-pcos/new${suffix}`);

  return (
    <PageShell
      variant="form"
      title="Redirecting to Prime PCO"
      description="Opening the canonical Prime Contract PCO workflow."
    >
      {null}
    </PageShell>
  );
}

import { redirect } from "next/navigation";

interface ChangeOrderNewAliasPageProps {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSingleValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0] ?? null;
  return null;
}

// Redirects legacy change-order create URLs to canonical prime or commitment create routes.
export default async function ChangeOrderNewAliasPage({
  params,
  searchParams,
}: ChangeOrderNewAliasPageProps) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : undefined;

  const tab = readSingleValue(query?.tab);
  const type = readSingleValue(query?.type);
  const mode = readSingleValue(query?.mode);

  const isCommitmentRoute =
    tab === "commitment" ||
    type === "commitment" ||
    type === "cco" ||
    mode === "commitment";

  const target = isCommitmentRoute
    ? `/${projectId}/commitment-pcos/new`
    : `/${projectId}/prime-contract-pcos/new`;

  redirect(target);
}

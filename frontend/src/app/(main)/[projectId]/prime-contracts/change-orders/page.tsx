import { redirect } from "next/navigation";

interface PrimeContractChangeOrdersPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PrimeContractChangeOrdersPage({
  params,
}: PrimeContractChangeOrdersPageProps) {
  const { projectId } = await params;
  redirect(`/${projectId}/change-orders?tab=prime`);
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { TrainingAdminTablePage } from "@/features/training-admin/training-admin-table-page";
import { isTrainingAdminTableKey } from "@/features/training-admin/training-admin-config";
import { requireOwner } from "@/lib/auth/require-owner";

export default async function TrainingDataTablePage({
  params,
}: {
  params: Promise<{ tableKey: string }>;
}) {
  await requireOwner();
  const { tableKey } = await params;
  if (!isTrainingAdminTableKey(tableKey)) notFound();
  return <TrainingAdminTablePage tableKey={tableKey} />;
}

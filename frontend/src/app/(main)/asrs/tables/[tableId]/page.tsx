/* eslint-disable design-system/require-page-shell -- The reused FMDS detail view owns the canonical PageShell and review layout. */
import { FmdsTableDetailView } from "@/app/(main)/fm-global/fm_global_tables/[tableId]/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AsrsTableDetailPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  return <FmdsTableDetailView tableId={tableId} workspaceBasePath="/asrs" />;
}

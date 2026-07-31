import { PunchListClient } from "./punch-list-client";

// PageShell is rendered inside PunchListClient via UnifiedTablePage
// eslint-disable-next-line design-system/require-page-shell
export default async function PunchListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const numericProjectId = parseInt(projectId, 10);

  return <PunchListClient projectId={numericProjectId} />;
}

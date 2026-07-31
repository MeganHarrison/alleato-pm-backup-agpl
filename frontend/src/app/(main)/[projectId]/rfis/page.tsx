export const dynamic = "force-dynamic";

import * as React from "react";
import { RfisTable } from "./rfis-table";

export default async function RfisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const numericProjectId = parseInt(projectId, 10);

  return (
    <React.Suspense fallback={null}>
      <RfisTable projectId={numericProjectId} />
    </React.Suspense>
  );
}

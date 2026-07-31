/* eslint-disable design-system/require-page-shell -- The feature component renders UnifiedTablePage, which owns the page shell. */

import {
  CrmRelationshipDashboardPreview,
  type CrmPreviewState,
} from "@/features/crm/relationship-dashboard-preview";

const VALID_STATES = new Set<CrmPreviewState>([
  "ready",
  "loading",
  "empty",
  "error",
  "denied",
]);

export default async function CrmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const previewState =
    state && VALID_STATES.has(state as CrmPreviewState)
      ? (state as CrmPreviewState)
      : "ready";

  return (
    <CrmRelationshipDashboardPreview state={previewState} />
  );
}

export const dynamic = "force-dynamic";

import { ContentCatalogTable } from "@/features/content-studio/content-catalog-table";
import { getContentStudioData } from "@/lib/learning/server";
import { requireTrainingReviewerPageAccess } from "@/lib/training/reviewer-access";

export default async function ContentStudioPage() {
  await requireTrainingReviewerPageAccess();
  const { currentUserId, items, managers } = await getContentStudioData();
  return (
    <ContentCatalogTable
      currentUserId={currentUserId}
      items={items}
      managers={managers}
    />
  );
}

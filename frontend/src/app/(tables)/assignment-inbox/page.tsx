export const dynamic = "force-dynamic";

import { loadInboxItems } from "@/features/assignment-inbox/load-inbox-items";
import { AssignmentInboxClient } from "./assignment-inbox-client";

export default async function AssignmentInboxPage() {
  const { items, projects, totalUnassigned, hasMore, nextOffset, errorMessage } =
    await loadInboxItems({ offset: 0 });

  return (
    <AssignmentInboxClient
      initialItems={items}
      projects={projects}
      totalUnassigned={totalUnassigned}
      initialHasMore={hasMore}
      initialNextOffset={nextOffset}
      errorMessage={errorMessage}
    />
  );
}

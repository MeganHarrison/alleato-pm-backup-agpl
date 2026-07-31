import { PageShell } from "@/components/layout";

import { ProjectAttributionReviewClient } from "./project-attribution-review-client";

export const dynamic = "force-dynamic";

export default function ProjectAttributionPage() {
  return (
    <PageShell
      variant="table"
      title="Project Attribution Review"
      description="Review communication records that have candidate project matches but were not safe enough to assign automatically."
    >
      <ProjectAttributionReviewClient />
    </PageShell>
  );
}

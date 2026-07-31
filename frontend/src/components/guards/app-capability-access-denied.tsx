import { EmptyState } from "@/components/ds";
import { PageShell } from "@/components/layout";

export function AppCapabilityAccessDenied({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageShell variant="content" title={title} description={description}>
      <EmptyState
        title="Access denied"
        description={description}
        className="border-y border-border py-16"
      />
    </PageShell>
  );
}

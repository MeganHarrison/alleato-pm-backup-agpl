"use client";

import { PageShell } from "@/components/layout";
import { ManpowerPageClient } from "@/features/manpower/manpower-page-client";

export default function ManpowerPage() {
  return (
    <PageShell
      variant="table"
      title="Manpower"
      description="Cross-project staffing plan persisted from Microsoft Project CSV imports."
    >
      <ManpowerPageClient />
    </PageShell>
  );
}

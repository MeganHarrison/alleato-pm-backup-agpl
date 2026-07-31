"use client";

import { RefreshCw } from "lucide-react";

import { Heading } from "@/components/ds";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { aiDashboardPageShellProps } from "../../ai-dashboard/page-shell-config";

export default function CompanyBrainError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <main className="mx-auto flex min-h-96 max-w-2xl flex-col items-start justify-center gap-4 px-4">
        <Heading level={1}>Company Brain is unavailable</Heading>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The page failed before the permission-scoped overview could be
          rendered.
        </p>
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </main>
    </PageShell>
  );
}

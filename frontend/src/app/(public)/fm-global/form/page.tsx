import type { ReactElement } from "react";
import { PageShell } from "@/components/layout";
import { FmGlobalClient } from "./fm-global-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public-facing FM Global ASRS sprinkler estimator. No auth required.
 */
export default function FMGlobalSpecsPage(): ReactElement {
  return (
    <PageShell
      variant="form"
      title="ASRS Sprinkler Details"
      description="Share your storage and racking details below and we'll estimate the FM Global 8-34 sprinkler configuration for your ASRS — including applicable tables, figures, and protection scheme."
    >
      <FmGlobalClient />
    </PageShell>
  );
}

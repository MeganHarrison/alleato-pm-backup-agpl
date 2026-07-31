import type { ReactElement } from "react";

import { SectionHeader, StatusBadge } from "@/components/ds";
import {
  formatAsrsCitation,
  getAsrsPendingRequirements,
  type AsrsEstimatorResponse,
} from "@/lib/fmds/asrs-estimator";

interface AsrsEstimatorResultsProps {
  result: AsrsEstimatorResponse | null;
}

export function AsrsEstimatorResults({
  result,
}: AsrsEstimatorResultsProps): ReactElement {
  const requirements = result?.requirements ?? getAsrsPendingRequirements();

  return (
    <section className="min-w-0 space-y-5" aria-live="polite">
      <div className="space-y-1">
        <SectionHeader title="Requirements" />
        <p className="text-sm text-muted-foreground">
          {result
            ? `${result.corpus.documentCode} ${result.corpus.revisionLabel} · ${result.corpus.revisionStatus} · reviewed Batch 1 coverage`
            : "Verified results will appear here. Unverified calculations remain visible as Pending Review."}
        </p>
      </div>
      <div className="divide-y">
        {requirements.map((requirement) => (
          <article key={requirement.id} className="space-y-3 py-5 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium text-foreground">{requirement.label}</p>
              <StatusBadge
                status={
                  requirement.status === "verified"
                    ? "Verified"
                    : "Pending Review"
                }
                variant={
                  requirement.status === "verified" ? "success" : "warning"
                }
              />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {requirement.value}
            </p>
            {requirement.citations.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Source:{" "}
                {requirement.citations.map((citation, index) => (
                  <span key={`${citation.sourceId ?? citation.label}-${index}`}>
                    {index > 0 ? "; " : null}
                    {citation.href ? (
                      <a
                        className="underline underline-offset-4 hover:text-foreground"
                        href={citation.href}
                      >
                        {formatAsrsCitation(citation)}
                      </a>
                    ) : (
                      formatAsrsCitation(citation)
                    )}
                    {citation.ruleKey ? ` · ${citation.ruleKey}` : null}
                  </span>
                ))}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

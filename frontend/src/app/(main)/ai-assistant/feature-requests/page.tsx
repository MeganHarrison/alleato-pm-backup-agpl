import type { ReactNode } from "react";

import { PageShell } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import { FeatureRequestList } from "@/components/feature-requests/FeatureRequestList";
import { listFeatureRequests } from "@/lib/feature-requests/server";

export const metadata = {
  title: "Feature Requests | Alleato",
  description: "AIS feature request packets and implementation handoffs",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatFeatureRequestLoadError(error: Error): string {
  return error.message.includes("<!DOCTYPE html>")
    ? "Failed to list feature requests: Supabase returned an upstream HTML error while loading request packets."
    : error.message;
}

export default async function FeatureRequestsPage() {
  let content: ReactNode;

  try {
    const requests = await listFeatureRequests();
    content = <FeatureRequestList requests={requests} />;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("Failed to list feature requests:")) {
      throw error;
    }

    content = (
      <ErrorState
        title="Feature requests could not load"
        error={`${formatFeatureRequestLoadError(error)} Prevention: verify Supabase availability and feature_requests table access before retrying.`}
        className="items-start py-2 text-left"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageShell
        variant="table"
        title="Feature Requests"
        description="Durable AIS request packets, readiness state, and implementation handoffs."
      >
        {content}
      </PageShell>
    </div>
  );
}

import Link from "next/link";

import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { ErrorState } from "@/components/ds";
import { PageShell } from "@/components/layout";
import {
  DailyDeepReadCentralReview,
  type CentralReviewCandidate,
  type CentralReviewProjectOption,
} from "@/features/intelligence/daily-deep-read-central-review";
import { loadCurrentUserExecutiveVisibility } from "@/lib/executive/executive-visibility";
import { loadCurrentDailyExecutiveBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import {
  createRagServiceClient,
  createServiceClient,
  isRagDatabaseReadsEnabled,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAILY_DEEP_READ_COMPILER_VERSION = "daily_deep_read_consumers_v1";

function cleanDisplayText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\[[A-Z0-9]{20,}(?:\s*,\s*[A-Z0-9]{20,})*\]/g, "")
    .replace(/\[[^\]]*(?:outlook|teams?|fireflies|sharepoint|daily_packet)[^\]]*\]/gi, "")
    .replace(/\b(?:outlook|teamsdm|sharepoint)_[A-Za-z0-9._-]{8,}\b/gi, "")
    .replace(/\b[A-Za-z0-9_=-]{40,}\b/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[[\]]+/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/[\s,:;-]+$/g, "")
    .trim();
}

async function loadReviewData(): Promise<{
  businessDate: string;
  packetId: string;
  candidates: CentralReviewCandidate[];
  projectOptions: CentralReviewProjectOption[];
  error: string | null;
}> {
  if (!isRagDatabaseReadsEnabled()) {
    return {
      businessDate: "unknown",
      packetId: "",
      candidates: [],
      projectOptions: [],
      error: "RAG database reads are disabled; candidate queue is unavailable.",
    };
  }

  let packet;
  try {
    packet = await loadCurrentDailyExecutiveBriefPacket();
  } catch (error) {
    return {
      businessDate: "unknown",
      packetId: "",
      candidates: [],
      projectOptions: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const ragSupabase = createRagServiceClient();
  const candidateResult = await ragSupabase
    .from("source_signal_candidates")
    .select("id, project_id, signal_type, status, title, summary, confidence, created_at")
    .eq("compiler_version", DAILY_DEEP_READ_COMPILER_VERSION)
    .eq("extraction_json->>daily_packet_id", packet.id)
    .in("status", ["needs_review", "candidate"])
    .order("created_at", { ascending: true })
    .limit(500);

  if (candidateResult.error) {
    return {
      businessDate: packet.businessDate,
      packetId: packet.id,
      candidates: [],
      projectOptions: [],
      error: candidateResult.error.message,
    };
  }

  const appSupabase = createServiceClient();
  const projectResult = await serviceDb.from("projects")
    .select("id, name, type")
    .not("name", "is", null)
    .order("name");

  if (projectResult.error) {
    return {
      businessDate: packet.businessDate,
      packetId: packet.id,
      candidates: [],
      projectOptions: [],
      error: projectResult.error.message,
    };
  }

  const projects = (projectResult.data ?? []).filter((project) => {
    const name = String(project.name ?? "");
    return (
      name.length > 0 &&
      !/^temporary project code/i.test(name) &&
      !/^budget audit seed/i.test(name) &&
      project.type !== "Internal"
    );
  });
  const projectNameById = new Map(projects.map((project) => [project.id, project.name as string]));

  const candidates: CentralReviewCandidate[] = (candidateResult.data ?? []).map((row) => ({
    id: row.id,
    signalType: row.signal_type,
    status: row.status === "candidate" ? "candidate" : "needs_review",
    title: cleanDisplayText(row.title) || "Daily Deep Read candidate",
    summary: cleanDisplayText(row.summary) || null,
    confidence: row.confidence ?? "medium",
    projectId: row.project_id,
    projectName:
      row.project_id !== null ? (projectNameById.get(row.project_id) ?? `Project ${row.project_id}`) : null,
  }));

  return {
    businessDate: packet.businessDate,
    packetId: packet.id,
    candidates,
    projectOptions: projects.map((project) => ({
      id: project.id,
      name: project.name as string,
    })),
    error: null,
  };
}

export default async function DailyDeepReadReviewPage() {
  const visibility = await loadCurrentUserExecutiveVisibility();

  if (visibility !== "detail") {
    return (
      <AppCapabilityAccessDenied
        title="Daily Deep Read review"
        description="This review queue requires executive detail access because it exposes candidate claims and promotion actions."
      />
    );
  }

  const { businessDate, candidates, projectOptions, error } = await loadReviewData();
  const needsReviewCount = candidates.filter(
    (candidate) => candidate.status === "needs_review",
  ).length;

  return (
    <PageShell
      variant="content"
      eyebrow={`${businessDate} · ${needsReviewCount} awaiting review`}
      title="Daily Deep Read Review"
      contentClassName="pb-16"
    >
      <div className="space-y-8">
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Every candidate from the current Daily Deep Read packet, including ones
          not assigned to a project. Accepting marks a candidate ready; the hourly
          promotion run then writes it into project intelligence or creates a task.
          Assign a project to unassigned candidates so promotion has somewhere to
          write. See the{" "}
          <Link
            href="/executive/intelligence-brief"
            className="text-foreground underline-offset-4 hover:underline"
          >
            executive brief
          </Link>{" "}
          for the packet these came from.
        </p>
        {error ? (
          <ErrorState
            title="Daily Deep Read candidate queue could not load"
            error={error}
            className="items-start justify-start gap-2 py-2 text-left"
          />
        ) : (
          <DailyDeepReadCentralReview
            candidates={candidates}
            projectOptions={projectOptions}
          />
        )}
      </div>
    </PageShell>
  );
}

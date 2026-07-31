"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Settings, UserRound } from "lucide-react";
import {
  Button,
  DetailField,
  DetailFieldGrid,
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { apiFetch } from "@/lib/api-client";
import {
  buildAiProfileContextAuditCategories,
  buildAiProfileContextPacket,
  buildAiProfileContextUsageSummary,
  type AiProfileContextAuditCategory,
  type AiProfileContextPacket,
} from "@/lib/ai/ai-profile-context-packet";
import {
  buildAiProfileMemorySummary,
  formatAiProfileMemoryType,
  type AiProfileMemory,
} from "@/lib/ai/ai-profile-summary";
import { cn } from "@/lib/utils";

type MemoriesResponse = {
  memories: AiProfileMemory[];
  total: number;
};

const memoryQueryKey = ["ai-profile", "memories"] as const;

async function loadMemories(): Promise<MemoriesResponse> {
  return apiFetch<MemoriesResponse>("/api/ai-assistant/memories?limit=200");
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Not set";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatVisibility(value: string): string {
  if (value === "team") {
    return "Team-visible";
  }

  if (value === "project") {
    return "Project";
  }

  return "Private";
}

function formatContextStatus(
  value:
    | AiProfileContextPacket["status"]
    | AiProfileContextAuditCategory["state"],
): string {
  switch (value) {
    case "ready":
      return "Ready";
    case "degraded":
      return "Needs attention";
    case "not_configured":
      return "Not configured";
  }
}

function formatWriteMode(
  value: AiProfileContextPacket["approvalPolicy"]["defaultWriteMode"],
): string {
  return value === "commit_allowed"
    ? "Commit allowed after preview"
    : "Preview only";
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium text-foreground",
          tone === "muted" && "font-normal text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function AiProfilePage() {
  const {
    profile,
    isLoading: profileLoading,
    error: profileError,
  } = useCurrentUserProfile();
  const memoriesQuery = useQuery({
    queryKey: memoryQueryKey,
    queryFn: loadMemories,
    staleTime: 60_000,
  });

  const memories = memoriesQuery.data?.memories ?? [];
  const summary = buildAiProfileMemorySummary(memories);
  const contextPacket = buildAiProfileContextPacket({
    user: profile,
    memories,
  });
  const contextCategories = buildAiProfileContextAuditCategories(contextPacket);
  const contextUsage = buildAiProfileContextUsageSummary(contextPacket);
  const isLoading = profileLoading || memoriesQuery.isLoading;
  const error =
    profileError ??
    (memoriesQuery.error instanceof Error ? memoriesQuery.error.message : null);

  if (isLoading) {
    return (
      <div className="space-y-8" aria-busy="true">
        <div className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full max-w-xl animate-pulse rounded bg-muted" />
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="h-48 animate-pulse rounded-md bg-muted" />
          <div className="h-48 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="AI profile could not load"
        error={error}
        onRetry={() => {
          void memoriesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/profile">
            <UserRound className="h-4 w-4" />
            Profile settings
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/memory">
            <Settings className="h-4 w-4" />
            Memory center
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/ai/teach">
            <BookOpen className="h-4 w-4" />
            Teach Alleato
          </Link>
        </Button>
      </div>

      <section className="space-y-4">
        <SectionRuleHeading label="Identity and Responsibility" />
        <DetailFieldGrid columns={2}>
          <DetailField label="Name">{profile?.fullName}</DetailField>
          <DetailField label="Email">{profile?.email}</DetailField>
          <DetailField label="Title">{profile?.title}</DetailField>
          <DetailField label="Company">{profile?.company}</DetailField>
          <DetailField label="Role">{profile?.role}</DetailField>
          <DetailField label="Region">{profile?.region}</DetailField>
          <DetailField label="Timezone">{profile?.timezone}</DetailField>
          <DetailField label="Profile readiness">
            {typeof profile?.profileCompleteness === "number"
              ? `${profile.profileCompleteness}% complete`
              : null}
          </DetailField>
        </DetailFieldGrid>
      </section>

      <section className="space-y-4">
        <SectionRuleHeading label="Prompt Context Audit" />
        <DetailFieldGrid columns={2}>
          <DetailField label="Context status">
            {formatContextStatus(contextPacket.status)}
          </DetailField>
          <DetailField label="Default write mode">
            {formatWriteMode(contextPacket.approvalPolicy.defaultWriteMode)}
          </DetailField>
          <DetailField label="Approval authority">
            {contextPacket.approvalPolicy.authority}
          </DetailField>
          <DetailField label="Memory selection">
            {contextPacket.memoryContext.selectionReason}
          </DetailField>
          <DetailField label="Notification routing">
            {contextPacket.notificationPreferences.defaultRouting}
          </DetailField>
          <DetailField label="Leadership context">
            {contextPacket.leadershipContext.state === "available"
              ? `Available from ${contextPacket.leadershipContext.source}`
              : "Not configured"}
          </DetailField>
          <DetailField label="Used by">{contextUsage.summary}</DetailField>
        </DetailFieldGrid>

        <div className="divide-y divide-border">
          {contextCategories.map((category) => (
            <div
              key={category.id}
              className="grid gap-2 py-3 text-sm md:grid-cols-[12rem_minmax(0,1fr)]"
            >
              <div>
                <p className="font-medium text-foreground">{category.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatContextStatus(category.state)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-foreground">{category.summary}</p>
                <p className="leading-6 text-muted-foreground">
                  {category.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {contextPacket.memoryContext.included.length > 0 && (
          <div className="space-y-2">
            <SectionRuleHeading label="Selected for prompts" />
            <div className="divide-y divide-border">
              {contextPacket.memoryContext.included.map((memory) => (
                <div key={memory.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {formatAiProfileMemoryType(memory.type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatVisibility(memory.visibility)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {memory.project_id
                        ? `Project ${memory.project_id}`
                        : "Global"}
                    </span>
                  </div>
                  <p className="mt-1 leading-6 text-muted-foreground">
                    {memory.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <SectionRuleHeading label="Recent Memories" />
          {summary.recent.length > 0 ? (
            <div className="divide-y divide-border">
              {summary.recent.map((memory) => (
                <article key={memory.id} className="space-y-2 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={formatAiProfileMemoryType(memory.type)}
                      variant="neutral"
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatVisibility(memory.visibility)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(memory.created_at)}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-foreground">
                    {memory.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source: {memory.source || "unknown"} | Confidence:{" "}
                    {formatPercent(memory.confidence)} | Importance:{" "}
                    {formatPercent(memory.importance)}
                    {memory.project_id ? ` | Project ${memory.project_id}` : ""}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No memories yet"
              description="Reviewed preferences and durable context will appear here after they are saved."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/settings/memory">Open memory center</Link>
                </Button>
              }
            />
          )}
        </div>

        <aside className="space-y-6">
          <div className="space-y-2 divide-y divide-border">
            <Row label="Total memories" value={String(summary.total)} />
            <Row label="Preferences" value={String(summary.preferenceCount)} />
            <Row label="Private" value={String(summary.privateCount)} />
            <Row label="Team-visible" value={String(summary.teamCount)} />
            <Row label="Project-scoped" value={String(summary.projectCount)} />
          </div>

          <div className="space-y-2">
            <SectionRuleHeading label="Governance" />
            <p className="text-sm leading-6 text-muted-foreground">
              Memories are inspectable and user-managed in Memory Center. Any
              RFI, commitment, change event, or other created record remains
              preview-first until the user explicitly commits it.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Leadership coaching context is not active in this MVP. It needs a
              named source, visibility policy, and audit trail before the AI can
              use it.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

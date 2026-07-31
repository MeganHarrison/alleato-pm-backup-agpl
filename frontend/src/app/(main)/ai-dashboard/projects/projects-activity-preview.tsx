"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Heading } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  formatDateTime,
  sourceError,
  usePortfolioState,
} from "../live-data";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
  WorkspaceSourceState,
} from "../workspace-primitives";

const ACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function ProjectsActivityPreview() {
  const [query, setQuery] = useState("");
  const portfolio = usePortfolioState();
  const normalizedQuery = query.trim().toLowerCase();

  const recentProjects = useMemo(() => {
    const cutoff = Date.now() - ACTIVITY_WINDOW_MS;
    return (portfolio.data?.projects ?? [])
      .filter((project) => {
        const updatedAt = project.projection?.updatedAt;
        if (!updatedAt) return false;
        const updatedTime = new Date(updatedAt).getTime();
        return Number.isFinite(updatedTime) && updatedTime >= cutoff;
      })
      .filter((project) =>
        [project.projectName, project.healthStatus ?? "", String(project.projectId)].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        ),
      )
      .sort(
        (a, b) =>
          new Date(b.projection?.updatedAt ?? 0).getTime() -
          new Date(a.projection?.updatedAt ?? 0).getTime(),
      );
  }, [normalizedQuery, portfolio.data?.projects]);

  const title = portfolio.isLoading
    ? "Loading recent project activity."
      : `${recentProjects.length} project${recentProjects.length === 1 ? "" : "s"} updated in the last 14 days.`;
  const limitedProjects = (portfolio.data?.projects ?? []).filter(
    (project) => project.coverage === "limited",
  );

  return (
    <>
      <WorkspacePageIntro
        eyebrow="Projects"
        title={title}
        statusLabel={
          portfolio.data?.canonicalPacket.generatedAt
            ? `Packet generated ${formatDateTime(portfolio.data.canonicalPacket.generatedAt)}`
            : "Live portfolio state"
        }
      >
        Activity comes from the controlled project operating projection. A
        project without current projection evidence remains visible as a
        coverage limitation on the portfolio dashboard instead of being
        presented as recent activity.
      </WorkspacePageIntro>

      <div className="mt-10 flex items-center justify-between gap-4 pb-4">
        <p className="text-xs text-muted-foreground">
          {recentProjects.length} current result{recentProjects.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <ExpandableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search projects"
            ariaLabel="Search active projects"
            triggerClassName="size-11"
            inputClassName="h-11"
          />
          <CanonicalLink href="/projects">All projects</CanonicalLink>
        </div>
      </div>

      {portfolio.isLoading ? (
        <WorkspaceSourceState source="Project portfolio" state="loading" />
      ) : portfolio.isError ? (
        <WorkspaceSourceState
          source="Project portfolio"
          state="error"
          detail={sourceError(portfolio.error, "Project portfolio")}
        />
      ) : recentProjects.length > 0 ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {recentProjects.map((project) => (
            <article key={project.projectId} className="rounded-xl bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {project.coverage === "ready" ? "Current coverage" : "Limited coverage"}
                  </p>
                  <Heading
                    level={4}
                    as="h2"
                    className="mt-2 text-xl font-semibold tracking-tight text-foreground"
                  >
                    {project.projectName}
                  </Heading>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Project {project.projectId} · Updated {formatDateTime(project.projection?.updatedAt)}
                  </p>
                </div>
                <Link
                  href={`/${project.projectId}/home`}
                  aria-label={`Open ${project.projectName}`}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6 pt-5">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-foreground">
                    {project.sourceEvidenceCount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">source records</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-foreground">
                    {project.openAttentionIds.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">open attention items</p>
                </div>
              </div>

              <div className="mt-5 text-sm leading-relaxed text-muted-foreground">
                {project.healthStatus ? (
                  <p>{project.healthStatus}</p>
                ) : project.limitedReasons[0] ? (
                  <p>
                    {project.limitedReasons[0].owner}: {project.limitedReasons[0].recoveryPath}
                  </p>
                ) : (
                  <p>No written health status is present in the current projection.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="py-12 text-sm leading-relaxed text-muted-foreground">
          {query
            ? `No recently updated projects match “${query}”.`
            : "No controlled project projection was updated in the last 14 days. Check the portfolio coverage chart for projects that need projection recovery."}
        </div>
      )}

      {limitedProjects.length > 0 ? (
        <WorkspaceSection
          eyebrow="Coverage gaps"
          title="Current projects that need projection recovery"
          className="mt-8"
        >
          <div className="divide-y divide-border">
            {limitedProjects.map((project) => (
              <article
                key={project.projectId}
                className="grid gap-3 py-5 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1.6fr)_8rem] sm:items-start"
              >
                <div>
                  <Heading level={6} as="h2" className="text-sm font-medium text-foreground">
                    {project.projectName}
                  </Heading>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Project {project.projectId} · {project.sourceEvidenceCount} packet sources
                  </p>
                </div>
                <div className="text-sm leading-relaxed text-muted-foreground">
                  {project.limitedReasons.length > 0 ? (
                    project.limitedReasons.map((reason) => (
                      <p key={reason.code}>
                        <span className="font-medium text-foreground/80">{reason.owner}:</span>{" "}
                        {reason.recoveryPath}
                      </p>
                    ))
                  ) : (
                    <p>The portfolio source marked this project limited without a recovery reason.</p>
                  )}
                </div>
                <Link
                  href={`/${project.projectId}/home`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary sm:justify-end"
                >
                  Open project <ArrowUpRight className="size-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </WorkspaceSection>
      ) : null}
    </>
  );
}

"use client";

import { Heading } from "@/components/ds";
import {
  formatDate,
  formatDateTime,
  sourceError,
  useAttentionFeed,
} from "../live-data";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
  WorkspaceSourceState,
} from "../workspace-primitives";

export function DecisionsPreview() {
  const attention = useAttentionFeed();
  const items = attention.data?.items ?? [];

  return (
    <>
      <WorkspacePageIntro
        eyebrow="Decisions"
        title={
          attention.isLoading
            ? "Loading the executive action queue."
            : `${items.length} decision${items.length === 1 ? "" : "s"} ${items.length === 1 ? "is" : "are"} waiting on action.`
        }
        statusLabel={
          attention.data?.canonicalPacket.generatedAt
            ? `Packet generated ${formatDateTime(attention.data.canonicalPacket.generatedAt)}`
            : "Live executive attention"
        }
      >
        Every item is read from the controlled executive attention feed. The
        queue names the accountable owner, timing, and impact of delay without
        inventing a local status.
      </WorkspacePageIntro>

      <WorkspaceSection
        eyebrow="Waiting on action"
        title="Decisions that change the plan"
        className="mt-12"
        action={<CanonicalLink href="/daily-brief">Open daily brief</CanonicalLink>}
      >
        {attention.isLoading ? (
          <WorkspaceSourceState source="Executive attention" state="loading" />
        ) : attention.isError ? (
          <WorkspaceSourceState
            source="Executive attention"
            state="error"
            detail={sourceError(attention.error, "Executive attention")}
          />
        ) : items.length > 0 ? (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 py-5 sm:grid-cols-[minmax(10rem,0.55fr)_minmax(0,1.6fr)_minmax(9rem,0.55fr)] sm:items-start"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.projectId ? `Project ${item.projectId}` : "Portfolio"}
                  </p>
                  <p className="mt-1 text-xs text-primary">
                    {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No due date recorded"}
                  </p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {item.priority || "Unranked"} priority
                  </p>
                </div>
                <div>
                  <Heading level={6} as="h2" className="text-sm font-medium text-foreground">
                    {item.title}
                  </Heading>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>
                  {item.impactOfDelay && item.impactOfDelay !== "Not specified" ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Impact of delay: {item.impactOfDelay}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground/70">
                    Accountable owner
                  </span>
                  <p className="mt-1">{item.accountableOwnerLabel || "Unassigned"}</p>
                  <p className="mt-2 text-xs">{item.evidence.length} evidence link{item.evidence.length === 1 ? "" : "s"}</p>
                  <CanonicalLink
                    href={item.projectId ? `/${item.projectId}/home` : "/daily-brief"}
                    className="mt-1 sm:justify-end"
                  >
                    {item.projectId ? "Open project" : "Open brief"}
                  </CanonicalLink>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <WorkspaceSourceState source="Executive attention" state="empty" />
        )}
      </WorkspaceSection>
    </>
  );
}

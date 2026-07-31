"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ExecutiveAttentionWorkflow,
  type ExecutiveAttentionDraft,
} from "@/components/executive/executive-attention-workflow";
import { GovernedExecutiveArtifactStatus } from "@/components/executive/governed-executive-artifact-status";
import { Button } from "@/components/ui/button";
import { BriefMarkdown } from "@/features/daily-briefs/brief-markdown";
import type {
  BriefNarrativeKind,
  BriefNarrativeSection,
  BriefSeverity,
  DecisionItem,
  ExecutiveBriefViewModel,
  InlineSegment,
  RecommendedSystemItem,
} from "@/lib/daily-briefs/brief-view-model";
import type { GovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";

const DECISION_CLASS: Record<BriefSeverity, string> = {
  critical: "is-critical",
  amber: "is-amber",
  positive: "is-positive",
  info: "",
};

const SECTION_LABEL: Record<BriefNarrativeKind, string> = {
  assessment: "Executive assessment",
  change: "What changed",
  portfolio: "Portfolio intelligence",
  action: "Action plan",
  risk: "Risk and early warning",
  system: "Operating system",
  opportunity: "Leverage",
  evidence: "Evidence quality",
  analysis: "Analysis",
};

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.bold ? (
          <b key={index}>{segment.text}</b>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function ExecutiveBriefView({
  model,
  fontClassName,
  governedArtifact,
}: {
  model: ExecutiveBriefViewModel;
  fontClassName: string;
  governedArtifact?: GovernedExecutiveArtifact;
}) {
  const [attentionDraft, setAttentionDraft] =
    useState<ExecutiveAttentionDraft | null>(null);
  const sources = governedArtifact?.packet.sources;
  const fullReportHref = governedArtifact
    ? `/daily-briefs/${governedArtifact.packet.id}`
    : null;
  const assessment = model.narrativeSections.find(
    (section) => section.kind === "assessment",
  );
  const actionSections = model.narrativeSections.filter(
    (section) => section.kind === "action",
  );
  const evidenceSections = model.narrativeSections.filter(
    (section) => section.kind === "evidence",
  );
  // The structured recommended-systems block below supersedes the prose
  // "Preventable failures and system improvements" narrative. Render one or the
  // other, never both — the same finding twice is duplicate ink.
  const hasRecommendedSystems = model.recommendedSystems.length > 0;
  const analysisSections = model.narrativeSections.filter(
    (section) =>
      section.id !== assessment?.id &&
      section.kind !== "action" &&
      section.kind !== "evidence" &&
      !(hasRecommendedSystems && section.kind === "system"),
  );

  return (
    <div className={`exec-brief ${fontClassName}`}>
      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__meta">
            <span>Daily executive brief</span>
            {model.asOfLabel ? <span>Issued {model.asOfLabel}</span> : null}
          </div>
          <h1 className="masthead__date">
            {model.weekday ? <small>{model.weekday}</small> : null}
            {model.dateLabel}
          </h1>
          {model.thesis ? <p className="thesis">{model.thesis}</p> : null}
          <div className="masthead__footer">
            <CoverageSummary model={model} />
            {fullReportHref ? (
              <Link className="report-link" href={fullReportHref}>
                Open complete source brief
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="content">
        <section className="brief-overview" id="overview">
          <SectionHeading eyebrow="Start here" title="Executive read" />
          {model.read.lead.length ? (
            <p className="lead">
              <Inline segments={model.read.lead} />
            </p>
          ) : null}
          {model.read.supporting.map((paragraph, index) => (
            <p className="read-sub" key={index}>
              <Inline segments={paragraph} />
            </p>
          ))}
          {model.read.items.length ? (
            <div className="watchouts" aria-label="What to watch">
              {model.read.items.map((item, index) => (
                <div className={`watchout watchout--${item.tone}`} key={index}>
                  <span>{item.eyebrow}</span>
                  <p>
                    <Inline segments={item.body} />
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {assessment ? (
            <div className="assessment-copy">
              <BriefMarkdown content={assessment.body} sources={sources} />
            </div>
          ) : null}
        </section>

        {actionSections.length ? (
          <div className="priority-sections">
            {actionSections.map((section, index) => (
              <NarrativeSectionView
                key={section.id}
                section={section}
                sources={sources}
                index={index + 1}
                priority
              />
            ))}
          </div>
        ) : null}

        {model.decisions.length ? (
          <section className="brief-section decision-section" id="decisions">
            <SectionHeading
              eyebrow="Decision queue"
              title="What needs your confirmation"
              meta={`${model.decisions.length} open`}
            />
            <p className="section-intro">
              Each decision stays attached to its supporting evidence and can be
              assigned without leaving the brief.
            </p>
            <div className="decisions">
              {model.decisions.map((decision, index) => (
                <DecisionCard
                  key={`${decision.title}-${index}`}
                  decision={decision}
                  priority={index === 0}
                  onPrepareAttention={setAttentionDraft}
                />
              ))}
            </div>
          </section>
        ) : null}

        {hasRecommendedSystems ? (
          <section className="brief-section" id="recommended-systems">
            <SectionHeading
              title="How to prevent these"
              meta={`${model.recommendedSystems.length} recommended`}
            />
            <div className="recommended-systems">
              {model.recommendedSystems.map((item) => (
                <RecommendedSystemRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {analysisSections.map((section, index) => (
          <NarrativeSectionView
            key={section.id}
            section={section}
            sources={sources}
            index={actionSections.length + index + 1}
          />
        ))}

        {evidenceSections.map((section, index) => (
          <NarrativeSectionView
            key={section.id}
            section={section}
            sources={sources}
            index={actionSections.length + analysisSections.length + index + 1}
          />
        ))}

        <div className="brief-workflow" id="follow-through">
          <ExecutiveAttentionWorkflow draft={attentionDraft} />
        </div>

        {governedArtifact ? (
          <div className="brief-artifact">
            <GovernedExecutiveArtifactStatus artifact={governedArtifact} />
          </div>
        ) : null}
      </main>

      <footer className="brief-footer">
        <div>
          <b>Canonical packet</b>
          <span>
            {model.counts.meetings} meetings · {model.counts.emails} emails ·{" "}
            {model.counts.teams} Teams messages · {model.counts.documents}{" "}
            documents
          </span>
        </div>
        <p>
          This page presents the persisted executive report. Evidence gaps
          remain visible instead of being converted into implied certainty.
        </p>
      </footer>
    </div>
  );
}

function CoverageSummary({ model }: { model: ExecutiveBriefViewModel }) {
  return (
    <div className="coverage-summary" aria-label="Brief coverage">
      <span>
        <b>{model.decisions.length}</b> decisions
      </span>
      <span>
        <b>{model.projects.length}</b> projects
      </span>
      <span>
        <b>{model.operations.length}</b> named actions
      </span>
      <span>
        <b>
          {model.counts.meetings +
            model.counts.emails +
            model.counts.teams +
            model.counts.documents}
        </b>{" "}
        sources
      </span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  meta,
}: {
  // Optional: a section may stand on its title alone (one heading level).
  eyebrow?: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <div className="section-title" role="heading" aria-level={2}>
          {title}
        </div>
      </div>
      {meta ? <span className="section-meta">{meta}</span> : null}
    </div>
  );
}

/**
 * One prevention finding, rendered as the fix rather than the complaint:
 * the problem, the control that is missing, and the system that closes it.
 * Null owner/indicator render nothing at all — never a placeholder dash.
 */
function RecommendedSystemRow({ item }: { item: RecommendedSystemItem }) {
  return (
    <div className={`recommended-system ${DECISION_CLASS[item.severity]}`}>
      <div className="recommended-system-problem">{item.title}</div>
      <p className="recommended-system-gap">
        <span>Missing control</span>
        {item.missingControl}
      </p>
      <p className="recommended-system-fix">
        <span>Recommended system</span>
        {item.recommendedSystem}
      </p>
      {item.accountableRole || item.leadingIndicator ? (
        <p className="recommended-system-meta">
          {item.accountableRole ? <b>{item.accountableRole}</b> : null}
          {item.leadingIndicator ? item.leadingIndicator : null}
        </p>
      ) : null}
    </div>
  );
}

function NarrativeSectionView({
  section,
  sources,
  index,
  priority = false,
}: {
  section: BriefNarrativeSection;
  sources: GovernedExecutiveArtifact["packet"]["sources"] | undefined;
  index: number;
  priority?: boolean;
}) {
  return (
    <section
      className={`brief-section narrative-section narrative-section--${section.kind}${priority ? " is-priority" : ""}`}
      id={section.id}
    >
      <SectionHeading
        eyebrow={`${String(index).padStart(2, "0")} · ${SECTION_LABEL[section.kind]}`}
        title={section.title}
      />
      <div className="brief-narrative">
        <BriefMarkdown content={section.body} sources={sources} />
      </div>
    </section>
  );
}

function DecisionCard({
  decision,
  priority,
  onPrepareAttention,
}: {
  decision: DecisionItem;
  priority: boolean;
  onPrepareAttention: (draft: ExecutiveAttentionDraft) => void;
}) {
  return (
    <article className={`decision ${DECISION_CLASS[decision.severity]}`}>
      <div className="decision__head">
        <div className="decision__eyebrow">
          {priority ? <span>Start here</span> : null}
          {decision.reference ? <span>{decision.reference}</span> : null}
        </div>
        <div className="decision__title" role="heading" aria-level={3}>
          {decision.title}
        </div>
        {decision.body.length ? (
          <p className="decision__question">
            <Inline segments={decision.body} />
          </p>
        ) : null}
        {decision.context.length ? (
          <p className="decision__context">
            <Inline segments={decision.context} />
          </p>
        ) : null}
      </div>
      <div className="decision__due">
        <span className="decision__status">{decision.badge}</span>
        {decision.due ? (
          <span className="due-when">
            {decision.due.label}{" "}
            {decision.due.value ? <b>{decision.due.value}</b> : null}
          </span>
        ) : null}
      </div>
      <div className="decision__sources" aria-label="Decision evidence">
        <span className="decision__sources-label">Evidence</span>
        {decision.sourceRefs.length ? (
          decision.sourceRefs.map((source) =>
            source.url ? (
              <a
                key={`${source.title}-${source.url}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title}
              </a>
            ) : (
              <span
                key={source.title}
                title="This source has no addressable link"
              >
                {source.title} <em>(no direct link)</em>
              </span>
            ),
          )
        ) : (
          <span className="decision__sources-missing">
            Source reference unavailable
          </span>
        )}
      </div>
      <div className="decision__action">
        <Button
          size="sm"
          onClick={() =>
            onPrepareAttention({
              title: decision.title,
              summary: decision.body.map((segment) => segment.text).join(""),
              priority: decision.severity === "critical" ? "critical" : "high",
            })
          }
        >
          Assign follow-through
        </Button>
      </div>
    </article>
  );
}

import { SectionRuleHeading } from "@/components/layout/spacing";
import type { ExecutivePortfolioState } from "@/lib/executive/executive-portfolio-state";

const label = (value: string) => value.replaceAll("_", " ");

/** Current portfolio coverage consumer for the governed Weekly Operating Review. */
export function ExecutivePortfolioStateSection({ portfolio }: { portfolio: ExecutivePortfolioState }) {
  return <section className="space-y-3" aria-labelledby="portfolio-state-heading">
    <div>
      <SectionRuleHeading label="Portfolio coverage" />
      <p id="portfolio-state-heading" className="mt-1 text-sm text-muted-foreground">Every active Current project is listed. Limited rows name the source owner and recovery action rather than disappearing from executive review.</p>
    </div>
    <>
      <p className="text-sm text-muted-foreground">{portfolio.summary.eligibleProjectCount} eligible · {portfolio.summary.readyProjectCount} ready · {portfolio.summary.limitedProjectCount} limited · {portfolio.summary.openAttentionCount} open attention · {portfolio.summary.openConflictCount} open conflicts</p>
      {portfolio.projects.length ? <div className="divide-y divide-border" aria-label="Executive portfolio projects">{portfolio.projects.map((project) => <div key={project.projectId} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div><p className="text-sm font-medium text-foreground">{project.projectName}</p><p className="mt-1 text-xs text-muted-foreground">{project.coverage === "ready" ? `${project.sourceEvidenceCount} canonical source reference${project.sourceEvidenceCount === 1 ? "" : "s"} · ${project.healthStatus ?? "Projection healthy"}` : "Limited executive coverage"} · {project.openAttentionIds.length} attention · {project.openConflictIds.length} conflicts</p>
          {project.limitedReasons.length ? <div className="mt-2 space-y-1" role="alert">{project.limitedReasons.map((reason) => <p className="text-xs text-muted-foreground" key={reason.code}><span className="font-medium text-foreground">{label(reason.code)}</span> — Owner: {reason.owner}. Recovery: {reason.recoveryPath}</p>)}</div> : null}</div>
        <p className="text-xs text-muted-foreground sm:text-right">{project.coverage === "ready" ? "Ready" : "Limited"} · {project.freshness}</p>
      </div>)}</div> : <p className="text-sm text-muted-foreground">No eligible Current projects are recorded. Eligibility is owned by active `projects` rows with phase `Current`.</p>}
      {portfolio.summary.portfolioAttentionIds.length || portfolio.summary.portfolioConflictIds.length ? <p className="text-xs text-muted-foreground">Portfolio-level action retained without a project evidence link: {portfolio.summary.portfolioAttentionIds.length} attention · {portfolio.summary.portfolioConflictIds.length} conflicts.</p> : null}
    </>
  </section>;
}

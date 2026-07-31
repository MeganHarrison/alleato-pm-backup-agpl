import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Database,
  FileCheck2,
  GitBranch,
  ScanSearch,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  AiFeatureDetail,
  AiFeaturePoint,
} from "@/features/ai/ai-feature-catalog";

const categoryLabels: Record<AiFeatureDetail["category"], string> = {
  assistant: "Assistant",
  financial: "Financial intelligence",
  governance: "Governance",
  knowledge: "Knowledge",
  personalization: "Personalization",
};

function DetailPoints({
  points,
  columns = 3,
}: {
  points: AiFeaturePoint[];
  columns?: 3 | 4;
}) {
  return (
    <div
      className={
        columns === 4
          ? "grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4"
          : "grid gap-x-8 gap-y-6 sm:grid-cols-3"
      }
    >
      {points.map((point) => (
        <div key={point.title} className="border-t border-border/70 pt-4">
          <p className="text-sm font-semibold text-foreground">{point.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {point.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProcessMap({ feature }: { feature: AiFeatureDetail }) {
  const icons = [Database, ScanSearch, GitBranch, UsersRound, FileCheck2];

  return (
    <div
      id="process"
      className="overflow-hidden rounded-xl bg-surface-inverse px-5 py-8 text-background sm:px-8"
      aria-label={`Sample process for ${feature.name}`}
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-background/60">
            Sample process
          </p>
          <p className="mt-2 text-lg font-semibold tracking-tight">
            Evidence to operating decision
          </p>
        </div>
        <span className="text-xs text-background/60">Human-controlled</span>
      </div>

      <ol className="grid gap-3 lg:grid-cols-5">
        {feature.process.map((step, index) => {
          const Icon = icons[index] ?? Check;
          return (
            <li key={step.title} className="relative">
              <div className="h-full rounded-lg bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="font-mono text-xs text-background/50">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-8 text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-background/60">
                  {step.description}
                </p>
              </div>
              {index < feature.process.length - 1 ? (
                <ChevronRight
                  className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-background/40 lg:block"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AiFeatureDetailPage({ feature }: { feature: AiFeatureDetail }) {
  return (
    <article className="min-h-full overflow-x-clip">
      <header className="bg-surface-inverse text-background">
        <div className="grid w-full gap-12 px-6 pb-24 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)] lg:px-10 lg:pb-32 lg:pt-12 2xl:px-16">
          <div className="flex flex-col justify-between">
            <div>
              <Link
                href="/ai/features"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-background/70 transition-colors hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                All AI features
              </Link>
              <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-wider text-background/60">
                <span>{categoryLabels[feature.category]}</span>
                <span aria-hidden="true">/</span>
                <span>{feature.workflow}</span>
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
                {feature.title}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-background/70 sm:text-lg">
                {feature.summary}
              </p>
            </div>

            <Button asChild className="mt-10 w-fit">
              <Link href={feature.launchHref}>
                {feature.launchLabel}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative min-h-64 overflow-hidden rounded-xl bg-background sm:row-span-2">
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-success-surface" />
              <div className="absolute inset-8 grid rotate-[-8deg] place-items-center rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-2">
                  {feature.process.slice(0, 4).map((step, index) => (
                    <div
                      key={step.title}
                      className={
                        index === 1
                          ? "grid size-16 place-items-center rounded-md bg-success-surface text-success"
                          : "grid size-16 place-items-center rounded-md bg-surface-inverse text-background"
                      }
                    >
                      <span className="px-2 text-center text-xs font-semibold leading-tight">
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {feature.proof.map((item) => (
              <div
                key={item.value}
                className="flex min-h-32 flex-col justify-between rounded-xl bg-success-surface p-5 text-success"
              >
                <p className="text-2xl font-semibold tracking-tight">
                  {item.value}
                </p>
                <p className="text-sm leading-relaxed">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="relative -mt-8 rounded-t-3xl bg-background">
        <div className="w-full px-6 pb-20 pt-5 lg:px-10 2xl:px-16">
          <nav
            aria-label="Feature sections"
            className="sticky top-0 z-20 rounded-full bg-muted p-1"
          >
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {[
                ["Overview", "#overview"],
                ["Humans in the loop", "#humans"],
                ["Deployments", "#deployments"],
                ["Sample process", "#process"],
              ].map(([label, href], index) => (
                <Link
                  key={href}
                  href={href}
                  className={
                    index === 0
                      ? "rounded-full bg-success-surface px-3 py-2 text-center text-xs font-medium text-success"
                      : "rounded-full px-3 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  }
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          <div id="overview" className="scroll-mt-24 space-y-20 pt-16">
            <section aria-labelledby="challenge-heading">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                01
              </p>
              <div
                role="heading"
                aria-level={2}
                id="challenge-heading"
                className="mt-3 text-3xl font-semibold uppercase tracking-tight text-foreground"
              >
                Challenge
              </div>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-foreground">
                {feature.challenge.description}
              </p>
              <div className="mt-10">
                <DetailPoints points={feature.challenge.points} />
              </div>
            </section>

            <section aria-labelledby="solution-heading">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                02
              </p>
              <div
                role="heading"
                aria-level={2}
                id="solution-heading"
                className="mt-3 text-3xl font-semibold uppercase tracking-tight text-foreground"
              >
                Solution
              </div>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-foreground">
                {feature.solution.description}
              </p>
              <div className="mt-10">
                <DetailPoints points={feature.solution.points} columns={4} />
              </div>
            </section>

            <ProcessMap feature={feature} />

            <section
              id="humans"
              aria-labelledby="humans-heading"
              className="scroll-mt-24"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Operating model
              </p>
              <div
                role="heading"
                aria-level={2}
                id="humans-heading"
                className="mt-3 text-2xl font-semibold tracking-tight text-foreground"
              >
                Humans in the loop
              </div>
              <div className="mt-8">
                <DetailPoints points={feature.humansInTheLoop} />
              </div>
            </section>

            <section
              id="deployments"
              aria-labelledby="deployments-heading"
              className="scroll-mt-24"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Where it fits
              </p>
              <div
                role="heading"
                aria-level={2}
                id="deployments-heading"
                className="mt-3 text-2xl font-semibold tracking-tight text-foreground"
              >
                Deployments
              </div>
              <div className="mt-8">
                <DetailPoints points={feature.deployments} />
              </div>
            </section>

            <section aria-labelledby="result-heading">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                03
              </p>
              <div
                role="heading"
                aria-level={2}
                id="result-heading"
                className="mt-3 text-3xl font-semibold uppercase tracking-tight text-foreground"
              >
                Result
              </div>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-foreground">
                {feature.result.description}
              </p>
              <div className="mt-10">
                <DetailPoints points={feature.result.points} />
              </div>
            </section>

            <section className="flex flex-col items-start justify-between gap-6 border-t border-border pt-10 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ready to use this capability?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open the governed workflow, or return to compare features.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/ai/features">All AI features</Link>
                </Button>
                <Button asChild>
                  <Link href={feature.launchHref}>
                    {feature.launchLabel}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </article>
  );
}

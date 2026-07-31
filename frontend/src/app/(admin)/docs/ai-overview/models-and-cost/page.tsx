import type { Metadata } from "next";
import { Activity, DollarSign, GitBranch } from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";
import { loadModelRegistry } from "../_lib/ai-stats";

export const metadata: Metadata = {
  title: "Models & cost",
  description:
    "Which model handles which job, why we picked it, and what each request costs.",
};

export const dynamic = "force-dynamic";

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default async function ModelsAndCostPage() {
  const models = loadModelRegistry();

  return (
    <PageShell
      variant="content"
      title="Models & cost"
      titleContent={<SectionTitleContent title="Models & cost" subtitle="Different jobs use different models. The system picks the cheapest one that can do the work, and we pay only for what we use." />}
    >
      <SectionNav />
      <div className="space-y-14">
      {/* Section 1: Model registry */}
      <Section
        eyebrow="Routing"
        title="Model registry"
        description="Each role in the system has a default model assigned in `frontend/src/lib/ai/providers.ts`. The model registry below shows what's wired today."
      >
        <div className="rounded-lg bg-muted/40 p-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Role
                  </th>
                  <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Model
                  </th>
                  <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Why this one
                  </th>
                  <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cost / 1M tokens
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((entry) => (
                  <tr
                    key={entry.role}
                    className="border-b border-border/30 last:border-b-0"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {entry.role}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center rounded-md bg-card px-2 py-0.5 font-mono text-xs text-foreground">
                        {entry.model}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {entry.why}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-sm text-muted-foreground">
                      {entry.outputCostPer1M === null ? (
                        <span>
                          {entry.inputCostPer1M !== null
                            ? `${formatCost(entry.inputCostPer1M)} input only`
                            : "—"}
                        </span>
                      ) : (
                        <span>
                          {entry.inputCostPer1M !== null
                            ? formatCost(entry.inputCostPer1M)
                            : "—"}{" "}
                          in /{" "}
                          {formatCost(entry.outputCostPer1M)} out
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 2: Spend placeholder */}
      <Section eyebrow="Spend" title="What we paid recently">
        <div className="rounded-lg bg-muted/40 p-8">
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="inline-flex items-center gap-2 rounded-md bg-card px-2.5 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              Connecting to Langfuse
            </span>
            <p className="max-w-md text-sm text-muted-foreground">
              Daily, weekly, and per-model spend will appear here once the
              Langfuse cost API is wired. The model registry above shows current
              per-1M-token rates.
            </p>
            <div className="mt-2 grid w-full grid-cols-3 gap-4">
              <PlaceholderStat label="Today" />
              <PlaceholderStat label="Last 7 days" />
              <PlaceholderStat label="Last 30 days" />
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: Gateway architecture */}
      <Section
        eyebrow="Architecture"
        title="How a request flows through the gateway"
        description="Every model call routes through the Vercel AI Gateway in BYOK mode (`ai-gateway.vercel.sh`). Authentication uses `AI_GATEWAY_API_KEY`; if unset, the system falls back to direct provider keys (`OPENAI_API_KEY`). This means billing stays on the OpenAI account and we get one observability pane across all providers."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BenefitCard
            icon={GitBranch}
            title="One key, many providers"
            description="Switch providers without touching app code."
          />
          <BenefitCard
            icon={DollarSign}
            title="Billing transparency"
            description="Costs flow through one bill, regardless of which model handled the request."
          />
          <BenefitCard
            icon={Activity}
            title="Observability built in"
            description="Every call is traced in Langfuse for debugging and eval."
          />
        </div>
      </Section>
    </div>
    </PageShell>
  );
}

function PlaceholderStat({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl text-muted-foreground">&mdash;</p>
    </div>
  );
}

function BenefitCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

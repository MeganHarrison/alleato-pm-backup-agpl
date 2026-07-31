import type { Metadata } from "next";

import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";
import { loadToolDomains, loadTotalToolCount } from "../_lib/ai-stats";

export const metadata: Metadata = {
  title: "Tools: AI Overview",
  description:
    "Every read, write, and search the Alleato assistant can perform: grouped by domain, with live counts from the registry.",
};

export const dynamic = "force-dynamic";

const WRITE_ACTIONS: {
  label: string;
  chip: string;
}[] = [
  { label: "Create a task on behalf of the user", chip: "Preview + confirm" },
  { label: "Send an Outlook reply draft", chip: "Review only" },
  { label: "Mark an insight as approved/rejected", chip: "Admin confirm" },
  { label: "Create a meeting follow-up artifact", chip: "Preview + confirm" },
  { label: "Update memory with a new fact", chip: "Admin confirm" },
  { label: "Trigger a deep agent project status run", chip: "Admin confirm" },
];

export default async function ToolsPage() {
  const [domains, totalToolCount] = await Promise.all([
    loadToolDomains(),
    loadTotalToolCount(),
  ]);

  const largestDomain = domains.reduce(
    (max, domain) => (domain.count > max.count ? domain : max),
    domains[0],
  );

  return (
    <PageShell
      variant="content"
      title="Tools"
      titleContent={<SectionTitleContent title="Tools" subtitle="Everything the assistant can do. Each tool is a typed function the model can call to read data, search documents, or take an action." />}
    >
      <SectionNav />
      <div className="space-y-14">
      {/* Section 1: At a glance */}
      <Section eyebrow="At a glance" title="The catalog by the numbers">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatBlock
            label="Total tools"
            value={totalToolCount}
          />
          <StatBlock
            label="Domains"
            value={domains.length}
          />
          <StatBlock
            label="Largest domain"
            value={largestDomain?.label ?? "—"}
            suffix={largestDomain ? `${largestDomain.count} tools` : undefined}
          />
        </div>
      </Section>

      {/* Section 2: Catalog */}
      <Section
        eyebrow="Catalog"
        title="All tools, grouped by domain"
        description="Each domain corresponds to a tool file in `frontend/src/lib/ai/tools/`. The model picks tools based on what your question needs."
      >
        <div className="space-y-3">
          {domains.map((domain) => (
            <div key={domain.id} className="rounded-lg bg-muted/40 p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-base font-semibold text-foreground">
                  {domain.label}
                </h3>
                <span className="inline-flex shrink-0 items-center rounded-md bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
                  {domain.count} tools
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {domain.description}
              </p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
                frontend/src/lib/ai/tools/{domain.file}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 3: Safety */}
      <Section
        eyebrow="Safety"
        title="What requires human approval"
        description="Most tools are read-only. The ones below can change state and are gated behind an explicit confirmation in the chat UI before they fire."
      >
        <div className="divide-y divide-border/50 rounded-lg bg-muted/40">
          {WRITE_ACTIONS.map((action) => (
            <div
              key={action.label}
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              <p className="text-sm font-medium text-foreground">
                {action.label}
              </p>
              <span className="inline-flex shrink-0 items-center rounded-md bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {action.chip}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
    </PageShell>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {suffix ? (
        <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
      ) : null}
    </div>
  );
}

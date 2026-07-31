import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";

import { DetailField } from "@/components/ds";
import { PageShell } from "@/components/layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isOwnerEmail } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "AI capabilities | Alleato",
  description: "What Alleato AI solves today, what is being activated, and what is planned next.",
};

export const dynamic = "force-dynamic";

type AiCapability = Database["public"]["Tables"]["ai_agents"]["Row"];

type CapabilityStatus = AiCapability["status"];

const STATUS_COPY: Record<CapabilityStatus, { label: string; className: string }> = {
  production: { label: "Available now", className: "text-status-success" },
  beta: { label: "Ready to validate", className: "text-status-info" },
  building: { label: "In progress", className: "text-status-warning" },
  planned: { label: "Planned", className: "text-muted-foreground" },
};

function toTextList(value: Json | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function CapabilityRow({ capability }: { capability: AiCapability }) {
  const status = STATUS_COPY[capability.status] ?? {
    label: "Not active",
    className: "text-muted-foreground",
  };
  const sources = toTextList(capability.data_sources);
  const detail = capability.output_destination ?? capability.trigger_detail;

  return (
    <article className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{capability.name}</h3>
          <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {capability.purpose ?? "Capability purpose has not been defined in the registry."}
        </p>
      </div>
      <div className="space-y-3 sm:w-44 sm:shrink-0">
        <DetailField
          label="Runs"
          value={capability.trigger_detail ?? capability.trigger_type ?? "Not defined"}
          className="grid-cols-1 gap-1 sm:grid-cols-1"
        />
        <DetailField
          label="Uses"
          value={sources.length > 0 ? sources.slice(0, 2).join(", ") : "Not defined"}
          className="grid-cols-1 gap-1 sm:grid-cols-1"
        />
        {detail ? (
          <DetailField label="Produces" value={detail} className="grid-cols-1 gap-1 sm:grid-cols-1" />
        ) : null}
      </div>
    </article>
  );
}

function CapabilitySection({
  title,
  description,
  capabilities,
  emptyMessage,
}: {
  title: string;
  description: string;
  capabilities: AiCapability[];
  emptyMessage: string;
}) {
  return (
    <section aria-labelledby={title.toLowerCase().replaceAll(" ", "-")} className="space-y-4">
      <div className="max-w-3xl">
        <h2 id={title.toLowerCase().replaceAll(" ", "-")} className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {capabilities.length > 0 ? (
        <div className="divide-y divide-border/60 border-y border-border/60">
          {capabilities.map((capability) => (
            <CapabilityRow key={capability.id} capability={capability} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}

export default async function AiVisionPage() {
  const user = await getCurrentUser();
  if (!isOwnerEmail(user?.email)) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_agents")
    .select("*")
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("name");

  if (error) {
    return (
      <PageShell
        variant="content"
        title="AI capabilities"
        description="Capability status and planned work are maintained in the AI registry."
      >
        <section role="alert" className="max-w-2xl space-y-3 border-y border-border/60 py-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">AI capability registry unavailable</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This page intentionally does not show a static fallback, because that could misrepresent what is live or planned. Verify the `ai_agents` migration and authenticated Supabase access, then reload this page.
          </p>
          <Link href="/ai/admin/agents" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Open agent registry
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </PageShell>
    );
  }

  const capabilities = data ?? [];
  const available = capabilities.filter(
    (capability) => capability.status === "production" || capability.status === "beta",
  );
  const inProgress = capabilities.filter((capability) => capability.status === "building");
  const planned = capabilities.filter((capability) => capability.status === "planned");

  return (
    <PageShell
      variant="content"
      title="AI capabilities"
      description="Capability status and planned work are maintained in the AI registry."
      actions={
        <Link href="/ai/admin/agents" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          Open registry
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    >
      <div className="space-y-12">
        <section className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">The problem</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Project knowledge is plentiful, but timely, accountable answers are hard to get.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Teams lose time searching across meetings, documents, financial systems, and project records. The bigger risk is not just delay, it is acting on an answer without knowing its source, freshness, owner, or safe next action.
          </p>
        </section>

        <section className="space-y-5" aria-labelledby="ai-solution">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">The solution</p>
            <h2 id="ai-solution" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              A governed operating layer for reading, reasoning, and proposing work.
            </h2>
          </div>
          <ol className="divide-y divide-border/60 border-y border-border/60">
            <li className="flex gap-4 py-5">
              <span className="shrink-0 font-mono text-sm text-muted-foreground">01</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Read the right operational context</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Capabilities draw from named systems and sources rather than making unsupported generalizations.</p>
              </div>
            </li>
            <li className="flex gap-4 py-5">
              <span className="shrink-0 font-mono text-sm text-muted-foreground">02</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Turn information into a usable recommendation or draft</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Each registry entry names what it produces and where that output belongs in the workflow.</p>
              </div>
            </li>
            <li className="flex gap-4 py-5">
              <span className="shrink-0 font-mono text-sm text-muted-foreground">03</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Keep consequential work reviewable</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Approval requirements, confidence thresholds, and failure behavior are explicit registry fields, not hidden product assumptions.</p>
              </div>
            </li>
          </ol>
        </section>

        <CapabilitySection
          title="Available now"
          description="Production capabilities are live. Beta capabilities are built enough for deliberate validation, but should not be mistaken for general availability."
          capabilities={available}
          emptyMessage="No capabilities are currently marked production or beta. Update the registry before claiming a live AI feature."
        />

        <CapabilitySection
          title="In progress"
          description="These capabilities are actively being built. Their intended trigger, data sources, and output are visible here so delivery can be judged against a concrete operational contract."
          capabilities={inProgress}
          emptyMessage="No capabilities are currently marked in progress."
        />

        <CapabilitySection
          title="Roadmap"
          description="Planned work remains visible without being presented as a shipped feature. Priority order, effort, impact, dependencies, and blockers live in the registry."
          capabilities={planned}
          emptyMessage="No capabilities are currently marked planned."
        />

        <section className="space-y-6 border-t border-border/60 pt-8">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">The intended result</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">People spend less time locating facts and more time reviewing evidence-backed drafts and acting on the next correct step.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Failure is visible</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">If the registry cannot load, this page fails rather than showing a stale roadmap. The agent registry exposes each capability&apos;s missing trust controls for follow-up.</p>
            </div>
          </div>
        </section>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
          Status is intentionally descriptive, not a promise of autonomous action. Open the registry to inspect or update the implementation contract.
        </p>
      </div>
    </PageShell>
  );
}

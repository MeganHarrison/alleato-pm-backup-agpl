import type { Metadata } from "next";
import {
  ArrowRight,
  Briefcase,
  FileText,
  LineChart,
  Mail,
  MessageSquare,
  Mic,
} from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";

export const metadata: Metadata = {
  title: "Data sources",
  description:
    "Six external systems sync into Alleato's knowledge base. Every chunk the AI retrieves is traceable back to one of these sources.",
};

export const dynamic = "force-dynamic";

type SourceStatus = "live" | "manual";

interface DataSource {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  sync: string;
  landsIn: string;
  lastSync: string;
  status: SourceStatus;
  statusNote?: string;
}

const SOURCES: DataSource[] = [
  {
    name: "Microsoft Outlook (Email)",
    icon: Mail,
    description:
      "Every inbound and outbound email gets pulled via Microsoft Graph. Subject, body, sender, recipients, attachments, and thread context are all indexed.",
    sync: "Every 30 min via Render cron alleato-graph-sync",
    landsIn:
      "outlook_email_intake → filtered into document_metadata → embedded into document_chunks",
    lastSync: "—",
    status: "live",
  },
  {
    name: "Microsoft Teams",
    icon: MessageSquare,
    description:
      "Chat messages, channel posts, and meeting metadata across the workspace. 1:1 and group DMs included where Graph permits.",
    sync: "Every 30 min, same cron",
    landsIn: "teams_messages → document_chunks",
    lastSync: "—",
    status: "live",
    statusNote: "10 known cross-tenant 403s",
  },
  {
    name: "Fireflies meetings",
    icon: Mic,
    description:
      "Meeting transcripts with speaker labels, decisions, action items, and risks. Compiled into structured project intelligence.",
    sync: "Every 30 min, end of alleato-graph-sync",
    landsIn:
      "meetings → meeting_intelligence (decisions, risks, tasks, opportunities) → document_chunks",
    lastSync: "—",
    status: "live",
  },
  {
    name: "Acumatica ERP",
    icon: LineChart,
    description:
      "Live accounting data: vendors, customer invoices, GL accounts, journal entries. Queried on demand, not synced to vector store.",
    sync: "Live REST API (read-through, cookie-auth, company Alleato Group LLC)",
    landsIn: "queried in real-time via 9 Acumatica tools",
    lastSync: "—",
    status: "live",
  },
  {
    name: "Uploaded documents",
    icon: FileText,
    description:
      "PDFs, Word docs, contracts, drawings. Text-extracted (or OCR'd via Azure for scanned PDFs) then chunked and embedded.",
    sync: "Manual upload via /documents",
    landsIn: "documents → document_chunks",
    lastSync: "—",
    status: "manual",
  },
  {
    name: "Procore",
    icon: Briefcase,
    description:
      "Project-level RFIs, submittals, change orders, daily logs synced from the Procore instance. Mirrors the project management tools side.",
    sync: "Triggered crawls",
    landsIn:
      "domain tables (rfis, submittals, etc.): queried directly, not embedded",
    lastSync: "—",
    status: "live",
  },
];

const PIPELINE_STEPS = [
  {
    label: "Sync",
    detail: "Pull new records from each source's API",
  },
  {
    label: "Filter",
    detail:
      "Drop noise (newsletters, automated notifications), keep operator-relevant content",
  },
  {
    label: "Chunk & embed",
    detail:
      "Split into ~500-token chunks, embed with text-embedding-3-large (halfvec 3072)",
  },
  {
    label: "Compile",
    detail:
      "Generate intelligence packets, insights, and tasks from the new content",
  },
];

const CRONS = [
  {
    name: "alleato-graph-sync",
    schedule: "Every 30 min",
    description: "Outlook + Teams + OneDrive sync, embed, compile",
  },
  {
    name: "alleato-project-synthesis-sweep",
    schedule: "Configured in Render",
    description: "Build current project intelligence synthesis from embedded communications",
  },
  {
    name: "alleato-rag-health",
    schedule: "Daily 12:15 UTC",
    description: "RAG embedding health check, Slack alert on failure",
  },
];

export default async function DataSourcesPage() {
  return (
    <PageShell
      variant="content"
      title="Where the data comes from"
      titleContent={<SectionTitleContent title="Where the data comes from" subtitle="Six external systems sync into Alleato's knowledge base. Every chunk the AI retrieves is traceable back to one of these sources." />}
    >
      <SectionNav />
      <div className="space-y-14">
      {/* Section 1: Sources */}
      <Section
        eyebrow="Sync overview"
        title="The sources and what they bring"
      >
        <div className="space-y-3">
          {SOURCES.map((source) => (
            <div
              key={source.name}
              className="rounded-lg bg-muted/40 p-5"
            >
              <div className="flex items-start gap-4">
                {/* Icon tile */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card text-primary">
                  <source.icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">
                    {source.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {source.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Sync: {source.sync}</span>
                    <span>Lands in: {source.landsIn}</span>
                    <span>Last sync: {source.lastSync}</span>
                  </div>
                </div>

                {/* Status pill */}
                <div className="shrink-0">
                  {source.status === "live" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      {source.statusNote ? source.statusNote : "Live"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      Manual
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 2: Pipeline */}
      <Section
        eyebrow="Pipeline"
        title="From source to answer"
        description="Every source funnels through the same three stages. The pipeline runs end-to-end every 30 minutes on Render."
      >
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch">
          {PIPELINE_STEPS.map((step, index) => (
            <div key={step.label} className="contents">
              <div className="flex-1 rounded-lg bg-muted/40 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {step.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
              {index < PIPELINE_STEPS.length - 1 && (
                <div className="hidden shrink-0 items-center sm:flex" aria-hidden="true">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Section 3: Crons */}
      <Section
        eyebrow="Operations"
        title="Cron jobs that keep this running"
        description="All backend syncs run on Render as Docker cron jobs. Each cron writes to a status table; failures alert via Slack."
      >
        <div className="rounded-lg bg-muted/40 p-1">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cron
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Schedule
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {CRONS.map((cron, index) => (
                <tr
                  key={cron.name}
                  className={
                    index < CRONS.length - 1
                      ? "border-b border-border/40"
                      : undefined
                  }
                >
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-card px-2 py-0.5 font-mono text-xs text-foreground">
                      {cron.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs text-foreground">
                    {cron.schedule}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {cron.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
    </PageShell>
  );
}
